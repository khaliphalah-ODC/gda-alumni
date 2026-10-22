import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants';
import { AppError } from '../utils/app-error';
import { verifyToken } from '../utils/jwt';
import { clearAuthenticationCookie } from '../utils/auth-cookie';
import { authService } from '../services/auth.service';

function authenticate(optional: boolean): RequestHandler {
  return async (request, response, next) => {
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token) return optional ? next() : next(new AppError(401, 'Authentication is required'));
    let identity;
    try { identity = verifyToken(token); }
    catch (error) {
      clearAuthenticationCookie(response);
      if (optional) return next();
      return next(new AppError(401, error instanceof jwt.TokenExpiredError ? 'Authentication token has expired' : 'Authentication token is invalid'));
    }
    try {
      // Current database permissions take precedence over stale JWT role claims.
      request.user = { ...await authService.getSessionIdentity(identity.userId, identity.sessionVersion ?? 0), sessionVersion: identity.sessionVersion ?? 0 };
      next();
    } catch (error) {
      if (error instanceof AppError && [401, 403].includes(error.statusCode)) {
        clearAuthenticationCookie(response);
        if (optional) return next();
      }
      next(error);
    }
  };
}
export const requireAuth = authenticate(false);
export const optionalAuth = authenticate(true);
