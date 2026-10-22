import { Role } from '@prisma/client';
import { Router } from 'express';
import { getProfile, updateProfile, listDirectory, directoryDetail, dashboard } from '../controllers/alumni.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { requirePermission } from '../policies/permission.policy';
import { updateAlumniProfileSchema, directoryQuerySchema, directoryIdSchema } from '../validators/alumni.validator';

export const alumniRouter = Router();

alumniRouter.use(requireAuth, requirePermission('ALUMNI_ACCESS', 'SCHOOL_MANAGE'));
alumniRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
alumniRouter.get('/profile', requirePermission('ALUMNI_ACCESS'), getProfile);
alumniRouter.patch('/profile', requirePermission('ALUMNI_ACCESS'), validateBody(updateAlumniProfileSchema), updateProfile);

alumniRouter.get('/directory', validateQuery(directoryQuerySchema), listDirectory);
alumniRouter.get('/directory/:id', validateParams(directoryIdSchema), directoryDetail);
alumniRouter.get('/dashboard', requirePermission('ALUMNI_ACCESS'), dashboard);
