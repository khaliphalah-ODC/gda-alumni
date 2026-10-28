import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/app-error';
import { chunkPages, extractPdf, validatePdf } from './pdf';
export const knowledgeCategories = ['School History', 'Academic Achievements', 'Cadet Drill and Parade History', 'Alumni Association', 'Alumni Membership Guidelines', 'School Rules and Policies', 'Announcements', 'Events and Homecoming Programs', 'Public Document Request Instructions', 'Frequently Asked Questions'] as const;
export const metadataSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().max(1200).default(''), category: z.enum(knowledgeCategories) }).strict();
export const versionSchema = z.object({ version: z.number().int().nonnegative() }).strict();
export const reviewSchema = versionSchema.extend({ decision: z.enum(['APPROVED', 'REJECTED', 'ARCHIVED']), publicOriginal: z.boolean().default(false), confirmedPublicAndSafe: z.boolean().default(false) }).strict();
export const documentSelect = Prisma.validator<Prisma.AiKnowledgeDocumentSelect>()({ id: true, title: true, description: true, category: true, originalFilename: true, fileSize: true, fileHash: true, mimeType: true, processingStatus: true, approvalStatus: true, securityReviewed: true, publicOriginal: true, processingError: true, warnings: true, pageCount: true, emptyPages: true, edition: true, version: true, supersedesId: true, uploadedBy: true, reviewedBy: true, reviewedAt: true, createdAt: true, updatedAt: true, _count: { select: { chunks: true } } });
export async function processDocument(id: string, version: number, bytes: Uint8Array, edition: number) {
  try {
    const pages = await extractPdf(bytes);
    const chunks = chunkPages(pages, edition);
    const emptyPages = pages.filter(p => p.text.trim().length < 30).map(p => p.pageNumber);
    const processingStatus = !chunks.length ? 'OCR_REQUIRED' : emptyPages.length ? 'NEEDS_REVIEW' : 'READY';
    await prisma.$transaction(async tx => {
      const changed = await tx.aiKnowledgeDocument.updateMany({ where: { id, version, processingStatus: 'PROCESSING' }, data: { processingStatus, pageCount: pages.length, emptyPages, warnings: emptyPages.length ? ['Some pages have little or no text. OCR is required for those pages; review extracted passages before approval.'] : [], version: { increment: 1 } } });
      if (!changed.count) throw new AppError(409, 'The document changed during processing. Reload it.');
      await tx.aiKnowledgeChunk.deleteMany({ where: { documentId: id } });
      if (chunks.length) await tx.aiKnowledgeChunk.createMany({ data: chunks.map(c => ({ ...c, documentId: id })) });
    });
  } catch (error) {
    await prisma.aiKnowledgeDocument.updateMany({ where: { id, version, processingStatus: 'PROCESSING' }, data: { processingStatus: 'FAILED', processingError: error instanceof AppError ? error.message : 'Document processing failed. Try reprocessing or replace the PDF.', version: { increment: 1 } } });
  }
  return prisma.aiKnowledgeDocument.findUniqueOrThrow({ where: { id }, select: documentSelect });
}
export async function uploadKnowledge(file: Express.Multer.File | undefined, input: unknown, actorId: string, supersedesId?: string, supersedesVersion?: number) {
  const data = metadataSchema.parse(input), validated = validatePdf(file);
  const doc = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(742623)`;
    if (await tx.aiKnowledgeDocument.count() >= 200) throw new AppError(400, 'The PDF library is limited to 200 documents. Remove an unused document first.');
    if (await tx.aiKnowledgeDocument.count({ where: { processingStatus: 'PROCESSING', updatedAt: { gt: new Date(Date.now() - 60000) } } }) >= 2) throw new AppError(429, 'Two PDFs are processing. Wait and retry.');
    const old = supersedesId ? await tx.aiKnowledgeDocument.findFirst({ where: { id: supersedesId, version: supersedesVersion, approvalStatus: 'APPROVED' }, select: { edition: true } }) : null;
    if (supersedesId && !old) throw new AppError(409, 'Only the current approved document can be replaced. Reload it.');
    const created = await tx.aiKnowledgeDocument.create({ data: { ...data, ...validated, fileSize: file!.size, originalBytes: new Uint8Array(file!.buffer), uploadedBy: actorId, supersedesId, supersedesVersion, edition: old ? old.edition + 1 : 1 }, select: { id: true, version: true, edition: true } });
    await tx.auditRecord.create({ data: { actorId, action: supersedesId ? 'AI_KNOWLEDGE_REPLACEMENT_UPLOADED' : 'AI_KNOWLEDGE_UPLOADED', targetId: created.id } });
    return { id: created.id, version: created.version, edition: created.edition };
  });
  return processDocument(doc.id, doc.version, file!.buffer, doc.edition);
}
export async function reviewKnowledge(id: string, input: unknown, actorId: string) {
  const data = reviewSchema.parse(input);
  return prisma.$transaction(async tx => {
    const doc = await tx.aiKnowledgeDocument.findUnique({ where: { id }, select: { version: true, processingStatus: true, supersedesId: true, supersedesVersion: true, approvalStatus: true } });
    if (!doc || doc.version !== data.version) throw new AppError(409, 'The document changed. Reload before reviewing.');
    if (doc.processingStatus === 'PROCESSING') throw new AppError(409, 'Wait for PDF processing to finish before reviewing this document.');
    if (doc.approvalStatus === 'SUPERSEDED') throw new AppError(409, 'A superseded document cannot be restored. Upload a new version.');
    if (data.decision === 'APPROVED') {
      if (!data.confirmedPublicAndSafe) throw new AppError(400, 'Confirm security review and that this document contains only verified public school information.');
      if (!['READY', 'NEEDS_REVIEW'].includes(doc.processingStatus)) throw new AppError(400, 'Only readable, processed PDFs can be approved. Use FAQs for scanned documents until OCR is available.');
      if (doc.supersedesId) {
        const previous = await tx.aiKnowledgeDocument.findUnique({ where: { id: doc.supersedesId }, select: { approvalStatus: true, version: true } });
        if (previous?.approvalStatus !== 'SUPERSEDED') {
          const changed = await tx.aiKnowledgeDocument.updateMany({ where: { id: doc.supersedesId, version: doc.supersedesVersion!, approvalStatus: 'APPROVED' }, data: { approvalStatus: 'SUPERSEDED', publicOriginal: false, version: { increment: 1 } } });
          if (!changed.count) throw new AppError(409, 'The original document changed. Review a new replacement.');
        }
      }
    }
    const changed = await tx.aiKnowledgeDocument.updateMany({ where: { id, version: data.version }, data: { approvalStatus: data.decision, securityReviewed: data.decision === 'APPROVED', publicOriginal: data.decision === 'APPROVED' && data.publicOriginal, reviewedBy: actorId, reviewedAt: new Date(), version: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, 'The document changed. Reload it.');
    await tx.auditRecord.create({ data: { actorId, action: `AI_KNOWLEDGE_${data.decision}`, targetId: id } });
    return tx.aiKnowledgeDocument.findUniqueOrThrow({ where: { id }, select: documentSelect });
  });
}
export async function reprocessKnowledge(id: string, version: number, actorId: string) {
  const doc = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(742623)`;
    if (await tx.aiKnowledgeDocument.count({ where: { processingStatus: 'PROCESSING', updatedAt: { gt: new Date(Date.now() - 60000) } } }) >= 2) throw new AppError(429, 'Two PDFs are processing. Wait and retry.');
    const changed = await tx.aiKnowledgeDocument.updateMany({ where: { id, version, approvalStatus: { notIn: ['ARCHIVED', 'SUPERSEDED'] }, OR: [{ processingStatus: { not: 'PROCESSING' } }, { updatedAt: { lt: new Date(Date.now() - 60000) } }] }, data: { processingStatus: 'PROCESSING', approvalStatus: 'PENDING', securityReviewed: false, publicOriginal: false, processingError: null, reviewedAt: null, reviewedBy: null, version: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, 'This document changed, is archived, or is still processing. Reload it.');
    await tx.auditRecord.create({ data: { actorId, action: 'AI_KNOWLEDGE_REPROCESSED', targetId: id } });
    return tx.aiKnowledgeDocument.findUniqueOrThrow({ where: { id }, select: { originalBytes: true, edition: true } });
  });
  return processDocument(id, version + 1, doc.originalBytes, doc.edition);
}
