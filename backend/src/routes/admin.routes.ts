import { z } from 'zod';
import * as alumni from '../controllers/alumni-admin.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware';
import { adminListSchema, confirmationSchema } from '../validators/account.validator';
import { membershipIdSchema } from '../validators/membership.validator';
import { sensitiveLimiter } from './account.routes';
import { Router } from 'express';
import { dashboard } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../policies/permission.policy';
export const adminRouter = Router();
adminRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
adminRouter.use(requireAuth, requirePermission('SCHOOL_MANAGE'));
adminRouter.get('/dashboard', dashboard);

adminRouter.get('/alumni', validateQuery(adminListSchema.extend({ graduationYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional() })), alumni.list);
adminRouter.patch('/alumni/:id/disable', sensitiveLimiter, validateParams(membershipIdSchema), validateBody(confirmationSchema), alumni.setActive(false));
adminRouter.patch('/alumni/:id/enable', sensitiveLimiter, validateParams(membershipIdSchema), validateBody(confirmationSchema), alumni.setActive(true));
