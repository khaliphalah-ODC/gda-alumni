import { AppError } from '../utils/app-error';
import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema } from '../validators/auth.validator';
import { recoveryRequestSchema, passwordResetSchema } from '../validators/account.validator';
import { passwordResetService, recoveryMessage } from '../services/password-reset.service';
import { createLimiter } from '../utils/shared-rate-limit';
import { sendSuccess } from '../utils/api-response';
import { clearAuthenticationCookie } from '../utils/auth-cookie';

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

authRouter.post('/register', authLimiter, (_req, _res, next) => next(new AppError(403, 'Public registration is closed. Apply for alumni membership')));
export const recoveryLimiter = createLimiter('recovery-ip', { windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
export const recoveryEmailLimiter = createLimiter('recovery-email', { windowMs: 15 * 60000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: req => req.body.email });
authRouter.post('/forgot-password', recoveryLimiter, validateBody(recoveryRequestSchema), recoveryEmailLimiter, async (req, res, next) => {
  try { await passwordResetService.request(req.body.email); return sendSuccess(res, 200, recoveryMessage, null); } catch (error) { next(error); }
});
authRouter.post('/reset-password', recoveryLimiter, validateBody(passwordResetSchema), async (req, res, next) => {
  try { await passwordResetService.reset(req.body.token, req.body.newPassword); clearAuthenticationCookie(res); return sendSuccess(res, 200, 'Password reset. Log in with your new password.', null); } catch (error) { next(error); }
});
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
