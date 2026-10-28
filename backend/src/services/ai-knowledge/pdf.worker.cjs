const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const raw = Buffer.from(workerData.bytes).toString('latin1');
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|XFA)\b/.test(raw)) throw new Error('UNSAFE');
  const { getDocumentProxy } = require('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), {
    isEvalSupported: false, enableXfa: false, disableFontFace: true,
    useSystemFonts: false, maxImageSize: 16777216, stopAtErrors: true,
    verbosity: 0, useWorkerFetch: false,
  });
  try {
    if (pdf.numPages > 200) throw new Error('LIMIT');
    if (await pdf.getJSActions() || await pdf.getAttachments()) throw new Error('UNSAFE');
    const pages = []; let length = 0;
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      if (await page.getJSActions()) throw new Error('UNSAFE');
      const annotations = await page.getAnnotations();
      if (annotations.some(item => item.actions || /^(?:javascript|data):/i.test(item.unsafeUrl || item.url || '') || ['FileAttachment', 'RichMedia', 'Screen', 'Widget'].includes(item.subtype))) throw new Error('UNSAFE');
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      length += text.length;
      if (length > 1000000) throw new Error('LIMIT');
      pages.push({ pageNumber: index, text });
      page.cleanup();
    }
    parentPort.postMessage({ pages });
  } finally { await pdf.destroy(); }
})().catch(error => parentPort.postMessage({ error: error.message === 'UNSAFE' ? 'The PDF contains active content or embedded files and cannot be approved. Upload a flattened, text-only PDF.' : error.message === 'LIMIT' ? 'The PDF exceeds 200 pages or one million extracted characters.' : 'PDF extraction failed. Upload an unencrypted, valid PDF or reprocess the document.' }));
