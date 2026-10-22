import rateLimit from 'express-rate-limit';

const rateLimitResponse = {
  success: false,
  message: 'Too many requests. Please try again later.',
  data: null,
  pagination: null,
};

export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: rateLimitResponse });
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: rateLimitResponse });
