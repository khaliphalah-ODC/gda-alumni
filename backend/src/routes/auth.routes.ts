import { AppError } from '../utils/app-error';
import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema } from '../validators/auth.validator';

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

authRouter.post('/register', authLimiter, (_req, _res, next) => next(new AppError(403, 'Public registration is closed. Apply for alumni membership')));
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
