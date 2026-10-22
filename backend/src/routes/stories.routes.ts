import { uploadContentImage } from '../controllers/content-media.controller';
import { imageUpload } from '../middleware/upload.middleware';
import { imageVersionSchema } from '../validators/account.validator';
import { sensitiveLimiter } from './account.routes';
import { contentHandlers } from '../controllers/content.controller';
import { Role } from '@prisma/client';
import { Router } from 'express';
import { createStory, deleteStory, listStories, publishStory, updateStory } from '../controllers/stories.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { contentListQuerySchema, createStorySchema, postIdParamSchema, publicationSchema, deletionQuerySchema, updateStorySchema } from '../validators/post.validator';

export const storiesRouter = Router();
storiesRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

storiesRouter.get('/', optionalAuth, validateQuery(contentListQuerySchema), listStories);
storiesRouter.post('/', requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'), validateBody(createStorySchema), createStory);
storiesRouter.patch('/:id', requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(updateStorySchema), updateStory);
storiesRouter.delete('/:id', requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateQuery(deletionQuerySchema), deleteStory);
storiesRouter.patch('/:id/publish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), publishStory);

const handlers = contentHandlers('STORY');
storiesRouter.get('/:id', optionalAuth, validateParams(postIdParamSchema), handlers.detail);
storiesRouter.patch('/:id/unpublish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), handlers.unpublish);

storiesRouter.post('/:id/image', requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'), sensitiveLimiter, validateParams(postIdParamSchema), imageUpload, validateBody(imageVersionSchema), uploadContentImage('STORY'));
