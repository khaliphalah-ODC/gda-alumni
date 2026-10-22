import { uploadContentImage } from '../controllers/content-media.controller';
import { imageUpload } from '../middleware/upload.middleware';
import { imageVersionSchema } from '../validators/account.validator';
import { sensitiveLimiter } from './account.routes';
import { contentHandlers } from '../controllers/content.controller';
import { Role } from '@prisma/client';
import { Router } from 'express';
import { createEvent, deleteEvent, listEvents, publishEvent, updateEvent } from '../controllers/events.controller';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { createEventSchema, updateEventSchema, eventListQuerySchema } from '../validators/event.validator';
import { postIdParamSchema, publicationSchema, deletionQuerySchema } from '../validators/post.validator';

export const eventsRouter = Router();
eventsRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

eventsRouter.get('/', optionalAuth, validateQuery(eventListQuerySchema), listEvents);
eventsRouter.post('/', requireAuth, requirePermission('SCHOOL_MANAGE'), validateBody(createEventSchema), createEvent);
eventsRouter.patch('/:id', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(updateEventSchema), updateEvent);
eventsRouter.delete('/:id', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateQuery(deletionQuerySchema), deleteEvent);
eventsRouter.patch('/:id/publish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), publishEvent);

const handlers = contentHandlers('EVENT');
eventsRouter.get('/:id', optionalAuth, validateParams(postIdParamSchema), handlers.detail);
eventsRouter.patch('/:id/unpublish', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(postIdParamSchema), validateBody(publicationSchema), handlers.unpublish);

eventsRouter.post('/:id/image', requireAuth, requirePermission('SCHOOL_MANAGE'), sensitiveLimiter, validateParams(postIdParamSchema), imageUpload, validateBody(imageVersionSchema), uploadContentImage('EVENT'));
