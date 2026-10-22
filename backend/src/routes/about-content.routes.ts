import { Router } from 'express';
import type { PostType } from '@prisma/client';
import type { z } from 'zod';
import { contentHandlers } from '../controllers/content.controller';
import { uploadContentImage } from '../controllers/content-media.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { imageUpload } from '../middleware/upload.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { postRepository } from '../repositories/post.repository';
import { contentService } from '../services/content.service';
import { sendSuccess } from '../utils/api-response';
import { postIdParamSchema } from '../validators/post.validator';
import { imageVersionSchema } from '../validators/account.validator';
import {
  aboutListQuerySchema, aboutVersionSchema, aboutDeletionSchema,
  createHistorySchema, updateHistorySchema, createLeaderSchema, updateLeaderSchema,
} from '../validators/about-content.validator';
import { sensitiveLimiter } from './account.routes';

function aboutContentRouter(type: PostType, createSchema: z.ZodTypeAny, updateSchema: z.ZodTypeAny) {
  const router = Router();
  const handlers = contentHandlers(type);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', optionalAuth, validateQuery(aboutListQuerySchema), async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof aboutListQuerySchema>;
      const result = await contentService.list(type, req.user, query.page, query.limit, query);
      return sendSuccess(res, 200, 'Content retrieved', result.posts, result.pagination);
    } catch (error) { next(error); }
  });
  router.get('/:id', optionalAuth, validateParams(postIdParamSchema), handlers.detail);

  router.use(requireAuth, requirePermission('SCHOOL_MANAGE'));
  router.post('/', validateBody(createSchema), async (req, res, next) => {
    try {
      const post = await postRepository.create({ ...req.body, type, createdBy: req.user!.userId, isPublished: false });
      return sendSuccess(res, 201, 'Draft created', post);
    } catch (error) { next(error); }
  });
  router.patch('/:id', validateParams(postIdParamSchema), validateBody(updateSchema), handlers.update);
  router.delete('/:id', validateParams(postIdParamSchema), validateQuery(aboutDeletionSchema), handlers.remove);
  router.patch('/:id/publish', validateParams(postIdParamSchema), validateBody(aboutVersionSchema), handlers.publish);
  router.patch('/:id/unpublish', validateParams(postIdParamSchema), validateBody(aboutVersionSchema), handlers.unpublish);
  router.post('/:id/image', sensitiveLimiter, validateParams(postIdParamSchema), imageUpload, validateBody(imageVersionSchema), uploadContentImage(type));
  return router;
}

export const historyRouter = aboutContentRouter('HISTORY', createHistorySchema, updateHistorySchema);
export const schoolLeadershipRouter = aboutContentRouter('SCHOOL_LEADER', createLeaderSchema, updateLeaderSchema);
export const alumniLeadershipRouter = aboutContentRouter('ALUMNI_LEADER', createLeaderSchema, updateLeaderSchema);
