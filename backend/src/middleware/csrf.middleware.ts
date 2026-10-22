import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

// A non-simple header forces browser preflight. Only the configured frontend
// receives CORS permission. Validate Origin too, including for simple requests.
export const protectMutations: RequestHandler = (request, _response, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const origin = request.get('Origin');
  if ((origin && origin !== new URL(env.FRONTEND_ORIGIN).origin) || request.get('X-GDA-CSRF') !== '1') {
    return next(new AppError(403, 'Request origin or CSRF header is invalid'));
  }
  next();
};
