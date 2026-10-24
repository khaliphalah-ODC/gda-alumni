import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../policies/permission.policy';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { contentListQuerySchema, postIdParamSchema, deletionQuerySchema } from '../validators/post.validator';
import { gallerySchema, galleryUpdateSchema, achievementSchema, achievementUpdateSchema } from '../validators/showcase.validator';
import { imageVersionSchema } from '../validators/account.validator';
import { contentService } from '../services/content.service';
import { contentHandlers } from '../controllers/content.controller';
import { uploadContentImage } from '../controllers/content-media.controller';
import { imageUpload } from '../middleware/upload.middleware';
import { sensitiveLimiter } from './account.routes';
import { sendSuccess } from '../utils/api-response';
import { postSelection } from '../repositories/post.repository';

function showcaseRouter(type: 'GALLERY' | 'ACHIEVEMENT') {
  const router = Router(), handlers = contentHandlers(type);
  router.get('/', optionalAuth, validateQuery(contentListQuerySchema), async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof contentListQuerySchema>;
      const [result, settings] = await Promise.all([contentService.list(type, req.user, query.page, query.limit, query), prisma.platformSettings.findUnique({ where: { id: 1 } })]);
      return sendSuccess(res, 200, 'Collection retrieved', { items: result.posts, managed: type === 'GALLERY' ? Boolean(settings?.galleryManaged) : Boolean(settings?.achievementsManaged) }, result.pagination);
    } catch (error) { next(error); }
  });
  router.use(requireAuth, requirePermission('SCHOOL_MANAGE'));
  router.post('/', validateBody(type === 'GALLERY' ? gallerySchema : achievementSchema), async (req, res, next) => {
    try {
      const result = await prisma.$transaction(async tx => {
        const post = await tx.post.create({ data: { ...req.body, type, createdBy: req.user!.userId, isPublished: false }, select: postSelection });
        await tx.auditRecord.create({ data: { actorId: req.user!.userId, action: `${type}_CREATED`, targetId: post.id } });
        return post;
      });
      return sendSuccess(res, 201, 'Draft saved', result);
    } catch (error) { next(error); }
  });
  router.patch('/:id', validateParams(postIdParamSchema), validateBody(type === 'GALLERY' ? galleryUpdateSchema : achievementUpdateSchema), handlers.update);
  router.delete('/:id', validateParams(postIdParamSchema), validateQuery(deletionQuerySchema), handlers.remove);
  const version = z.object({ version: z.number().int().nonnegative() }).strict();
  router.patch('/:id/publish', validateParams(postIdParamSchema), validateBody(version), handlers.publish);
  router.patch('/:id/unpublish', validateParams(postIdParamSchema), validateBody(version), handlers.unpublish);
  router.post('/:id/image', sensitiveLimiter, validateParams(postIdParamSchema), imageUpload, validateBody(imageVersionSchema), uploadContentImage(type));
  return router;
}
export const galleryRouter = showcaseRouter('GALLERY');
export const achievementsRouter = showcaseRouter('ACHIEVEMENT');
