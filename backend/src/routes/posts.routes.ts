import { uploadContentImage } from '../controllers/content-media.controller';
import { imageUpload } from '../middleware/upload.middleware';
import { imageVersionSchema } from '../validators/account.validator';
import { sensitiveLimiter } from './account.routes';
import { contentHandlers } from '../controllers/content.controller';
import { Role } from '@prisma/client';
import { Router } from 'express';
import { createAnnouncement, listAnnouncements } from '../controllers/posts.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { contentListQuerySchema, createAnnouncementSchema, postIdParamSchema, updateStorySchema, publicationSchema, deletionQuerySchema } from '../validators/post.validator';

export const postsRouter = Router();
postsRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

postsRouter.get('/announcements', optionalAuth, validateQuery(contentListQuerySchema), listAnnouncements);
postsRouter.post('/announcements', requireAuth, requirePermission('SCHOOL_MANAGE'), validateBody(createAnnouncementSchema), createAnnouncement);

const handlers = contentHandlers('ANNOUNCEMENT');
postsRouter.get('/announcements/:id', optionalAuth, validateParams(postIdParamSchema), handlers.detail);
postsRouter.patch('/announcements/:id', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(updateStorySchema), handlers.update);
postsRouter.delete('/announcements/:id', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateQuery(deletionQuerySchema), handlers.remove);
postsRouter.patch('/announcements/:id/publish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), handlers.publish);
postsRouter.patch('/announcements/:id/unpublish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), handlers.unpublish);

postsRouter.post('/announcements/:id/image', requireAuth, requirePermission('SCHOOL_MANAGE'), sensitiveLimiter, validateParams(postIdParamSchema), imageUpload, validateBody(imageVersionSchema), uploadContentImage('ANNOUNCEMENT'));
