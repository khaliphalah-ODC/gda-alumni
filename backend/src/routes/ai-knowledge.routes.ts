import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../policies/permission.policy';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { createLimiter } from '../utils/shared-rate-limit';
import { documentSelect, knowledgeCategories, metadataSchema, reprocessKnowledge, reviewKnowledge, reviewSchema, uploadKnowledge, versionSchema } from '../services/ai-knowledge/service';
const handle = (fn: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
const idSchema = z.object({ id: z.string().cuid() });
const listSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), search: z.string().trim().max(150).default(''), category: z.enum(knowledgeCategories).optional(), status: z.enum(['PENDING','APPROVED','REJECTED','ARCHIVED','SUPERSEDED']).optional() }).strict();
const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
export const pdfMaxBytes = Math.min(env.AI_PDF_MAX_BYTES, env.VERCEL === '1' ? 4 * 1024 * 1024 : env.AI_PDF_MAX_BYTES);
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: pdfMaxBytes, files: 1, fields: 5, fieldSize: 4096, parts: 6 }, fileFilter: (_req, file, cb) => { if (file.mimetype !== 'application/pdf') cb(new AppError(400, 'Only PDF documents are accepted.')); else cb(null, true); } }).single('document');
const upload: RequestHandler = (req,res,next) => parser(req,res,error => next(error ? new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? `PDF limit is ${pdfMaxBytes / 1048576} MB.` : 'Invalid PDF upload. Choose one PDF and valid metadata.') : undefined));
const processingLimiter = createLimiter('knowledge-processing', { windowMs: 3600000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'PDF processing limit reached. Try again later.', data: null, pagination: null } });
export const aiKnowledgeRouter = Router();
aiKnowledgeRouter.use(requireAuth, requirePermission('SCHOOL_MANAGE'));
aiKnowledgeRouter.get('/', validateQuery(listSchema), handle(async (req,res) => {
 const q = req.query as unknown as z.infer<typeof listSchema>;
 const where = { ...(q.search ? { OR: [{ title: { contains: q.search, mode: 'insensitive' as const } }, { originalFilename: { contains: q.search, mode: 'insensitive' as const } }] } : {}), ...(q.category ? { category: q.category } : {}), ...(q.status ? { approvalStatus: q.status } : {}) };
 const [items,total] = await Promise.all([prisma.aiKnowledgeDocument.findMany({ where, select: documentSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12, skip: (q.page-1)*12 }), prisma.aiKnowledgeDocument.count({ where })]);
 return sendSuccess(res,200,'Private PDF library',{ items, categories: knowledgeCategories, maxBytes: pdfMaxBytes, page: q.page, total, totalPages: Math.ceil(total/12) });
}));
aiKnowledgeRouter.post('/', processingLimiter, upload, handle(async (req,res) => sendSuccess(res,201,'PDF stored in quarantine; review extraction before approval',await uploadKnowledge(req.file,req.body,req.user!.userId))));
aiKnowledgeRouter.post('/:id/replace', validateParams(idSchema), processingLimiter, upload, handle(async (req,res) => {
 const { version, ...metadata } = req.body;
 const expected = z.coerce.number().int().nonnegative().parse(version);
 return sendSuccess(res,201,'Replacement quarantined; the current approved edition remains active until approval',await uploadKnowledge(req.file,metadata,req.user!.userId,req.params.id as string,expected));
}));
aiKnowledgeRouter.get('/:id', validateParams(idSchema), validateQuery(pageSchema), handle(async (req,res) => {
 const doc = await prisma.aiKnowledgeDocument.findUnique({ where: { id: req.params.id as string }, select: documentSelect });
 if (!doc) throw new AppError(404,'Document not found.');
 const page = Number(req.query.page);
 const chunks = await prisma.aiKnowledgeChunk.findMany({ where: { documentId: doc.id, edition: doc.edition }, orderBy: { ordering: 'asc' }, skip: (page-1)*12, take: 12 });
 return sendSuccess(res,200,'Document extraction preview',{ ...doc, chunks, page, totalPages: Math.ceil(doc._count.chunks/12) });
}));
aiKnowledgeRouter.patch('/:id', validateParams(idSchema), validateBody(metadataSchema.extend({ version: z.number().int().nonnegative() })), handle(async (req,res) => {
 const { version, ...data } = req.body;
 await prisma.$transaction(async tx => {
  const changed = await tx.aiKnowledgeDocument.updateMany({ where: { id: req.params.id as string, version, processingStatus: { not: 'PROCESSING' }, approvalStatus: { notIn: ['SUPERSEDED','ARCHIVED'] } }, data: { ...data, approvalStatus: 'PENDING', securityReviewed: false, publicOriginal: false, reviewedAt: null, reviewedBy: null, version: { increment: 1 } } });
  if (!changed.count) throw new AppError(409,'The document changed or is inactive. Reload it.');
  await tx.auditRecord.create({ data: { actorId: req.user!.userId, action: 'AI_KNOWLEDGE_METADATA_UPDATED', targetId: req.params.id as string } });
 });
 return sendSuccess(res,200,'Metadata saved; approval is required again',null);
}));
aiKnowledgeRouter.post('/:id/review', validateParams(idSchema), validateBody(reviewSchema), handle(async (req,res) => sendSuccess(res,200,'Document review saved',await reviewKnowledge(req.params.id as string,req.body,req.user!.userId))));
aiKnowledgeRouter.post('/:id/reprocess', validateParams(idSchema), processingLimiter, validateBody(versionSchema), handle(async (req,res) => sendSuccess(res,200,'PDF reprocessed; review is required',await reprocessKnowledge(req.params.id as string,req.body.version,req.user!.userId))));
aiKnowledgeRouter.delete('/:id', validateParams(idSchema), validateBody(versionSchema), handle(async (req,res) => {
 await prisma.$transaction(async tx => {
  const deleted = await tx.aiKnowledgeDocument.deleteMany({ where: { id: req.params.id as string, version: req.body.version, processingStatus: { not: 'PROCESSING' } } });
  if (!deleted.count) throw new AppError(409,'This document changed or is processing. Reload it.');
  await tx.auditRecord.create({ data: { actorId: req.user!.userId, action: 'AI_KNOWLEDGE_REMOVED', targetId: req.params.id as string } });
 });
 return sendSuccess(res,200,'Original PDF and extracted passages removed',null);
}));
const original = (isPublic: boolean): RequestHandler => handle(async (req,res) => {
 const doc = await prisma.aiKnowledgeDocument.findFirst({ where: { id: req.params.id as string, ...(isPublic ? { ...eligibleDocument, publicOriginal: true } : {}) }, select: { originalBytes: true, originalFilename: true } });
 if (!doc) throw new AppError(404,'Document not found or original access is not authorized.');
 res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalFilename)}`, 'Content-Security-Policy': "sandbox; default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
 return res.send(Buffer.from(doc.originalBytes));
});
aiKnowledgeRouter.get('/:id/original', validateParams(idSchema), original(false));
export const eligibleDocument = { approvalStatus: 'APPROVED' as const, processingStatus: { in: ['READY','NEEDS_REVIEW'] as ('READY'|'NEEDS_REVIEW')[] }, securityReviewed: true };
export const publicKnowledgeRouter = Router();
publicKnowledgeRouter.get('/:id', validateParams(idSchema), validateQuery(pageSchema), handle(async (req,res) => {
 const doc = await prisma.aiKnowledgeDocument.findFirst({ where: { id: req.params.id as string, ...eligibleDocument }, select: { id: true, title: true, description: true, category: true, pageCount: true, edition: true, publicOriginal: true, updatedAt: true } });
 if (!doc) throw new AppError(404,'Approved document not found.');
 const page = Number(req.query.page), where = { documentId: doc.id, edition: doc.edition, document: eligibleDocument };
 const [chunks,total] = await Promise.all([prisma.aiKnowledgeChunk.findMany({ where, select: { id: true, text: true, pageNumber: true, ordering: true }, orderBy: { ordering: 'asc' }, skip: (page-1)*12, take: 12 }),prisma.aiKnowledgeChunk.count({ where })]);
 return sendSuccess(res,200,'Approved public school information',{ ...doc, chunks, page, totalPages: Math.ceil(total/12) });
}));
publicKnowledgeRouter.get('/:id/original',validateParams(idSchema),original(true));
