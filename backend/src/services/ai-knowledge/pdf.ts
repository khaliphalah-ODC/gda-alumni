import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
export interface PdfPage { pageNumber: number; text: string }
export function validatePdf(file?: Express.Multer.File) {
  if (!file) throw new AppError(400, 'Choose a PDF document.');
  if (!file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf' || !file.buffer.subarray(0, 8).toString('ascii').match(/^%PDF-\d\.\d/) || !file.buffer.subarray(-2048).toString('latin1').includes('%%EOF')) throw new AppError(400, 'Only genuine, complete PDF documents are accepted.');
  if (file.size > env.AI_PDF_MAX_BYTES) throw new AppError(413, 'The PDF exceeds the configured upload limit.');
  const originalFilename = file.originalname.replace(/\\/g, '/').split('/').pop()!.replace(/[^\w .()-]/g, '_').slice(-150);
  return { originalFilename, fileHash: createHash('sha256').update(file.buffer).digest('hex') };
}
export function extractPdf(bytes: Uint8Array): Promise<PdfPage[]> {
  return new Promise((resolve, reject) => {
    const localWorker = path.join(__dirname, 'pdf.worker.cjs');
    const worker = new Worker(existsSync(localWorker) ? localWorker : path.join(process.cwd(), 'src/services/ai-knowledge/pdf.worker.cjs'), { workerData: { bytes }, env: {}, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 }, stdout: true, stderr: true });
    // Drain parser diagnostics without logging PDF text, secrets or internal paths.
    worker.stdout?.resume(); worker.stderr?.resume();
    const timer = setTimeout(() => { void worker.terminate(); reject(new AppError(422, 'PDF processing timed out. Use a smaller PDF and reprocess.')); }, 20000);
    worker.once('message', (result: { pages?: PdfPage[]; error?: string }) => { clearTimeout(timer); void worker.terminate(); if (result.pages) resolve(result.pages); else reject(new AppError(422, result.error || 'PDF processing failed.')); });
    worker.once('error', () => { clearTimeout(timer); reject(new AppError(422, 'PDF processing failed safely. Try a smaller, unencrypted PDF.')); });
    worker.once('exit', () => { clearTimeout(timer); reject(new AppError(422, 'PDF processing stopped. Try a smaller PDF.')); });
  });
}
export function chunkPages(pages: PdfPage[], edition: number) {
  const chunks: { text: string; pageNumber: number; ordering: number; edition: number }[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' ').trim();
    if (text.length < 30) continue;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + 1200, text.length);
      if (end < text.length) { const boundary = text.lastIndexOf(' ', end); if (boundary > start + 600) end = boundary; }
      chunks.push({ text: text.slice(start, end).trim(), pageNumber: page.pageNumber, ordering: chunks.length, edition });
      if (end === text.length) break;
      start = end - 150;
    }
  }
  return chunks;
}
