import { createLimiter } from '../utils/shared-rate-limit';

const rateLimitResponse = {
  success: false,
  message: 'Too many requests. Please try again later.',
  data: null,
  pagination: null,
};

export const apiLimiter = createLimiter('api', { windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: rateLimitResponse,
  skip: req => ['/api/health', '/api/cron/maintenance'].includes(req.path) });
export const authLimiter = createLimiter('auth', { windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: rateLimitResponse });
