import { Role } from '@prisma/client';
import { Router } from 'express';
import { createRequest, deleteRequest, getRequest, listMyRequests, listRequests, updateRequestStatus, updateRequestNote } from '../controllers/requests.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { createRequestSchema, requestIdParamSchema, requestListQuerySchema, updateRequestStatusSchema, updateRequestNoteSchema, requestVersionQuerySchema } from '../validators/request.validator';

export const requestsRouter = Router();
requestsRouter.use(requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'));
requestsRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

requestsRouter.post('/', requireAuth, validateBody(createRequestSchema), createRequest);
requestsRouter.get('/my', requireAuth, validateQuery(requestListQuerySchema), listMyRequests);
requestsRouter.get('/', requireAuth, requirePermission('SCHOOL_MANAGE'), validateQuery(requestListQuerySchema), listRequests);
requestsRouter.get('/:id', requireAuth, validateParams(requestIdParamSchema), getRequest);
requestsRouter.patch('/:id/status', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(requestIdParamSchema), validateBody(updateRequestStatusSchema), updateRequestStatus);
requestsRouter.delete('/:id', requireAuth, validateParams(requestIdParamSchema), validateQuery(requestVersionQuerySchema), deleteRequest);

requestsRouter.patch('/:id/note', requireAuth, requirePermission('SCHOOL_MANAGE'), validateParams(requestIdParamSchema), validateBody(updateRequestNoteSchema), updateRequestNote);
