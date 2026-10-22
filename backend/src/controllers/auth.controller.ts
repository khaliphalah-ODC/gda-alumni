import type { RequestHandler, Response } from 'express';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants';
import { authCookieOptions, authCookieMaxAge, clearAuthenticationCookie } from '../utils/auth-cookie';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/api-response';
import { signToken } from '../utils/jwt';

function setAuthenticationCookie(response: Response, user: { id: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'ALUMNI' | 'STUDENT'; sessionVersion?: number }) {
  response.cookie(AUTH_COOKIE_NAME, signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion }), { ...authCookieOptions, maxAge: authCookieMaxAge });
}

export const login: RequestHandler = async (request, response, next) => {
  try {
    const user = await authService.login(request.body);
    setAuthenticationCookie(response, user);
    const { sessionVersion, ...publicUser } = user;
    return sendSuccess(response, 200, 'Login successful', publicUser);
  } catch (error) { next(error); }
};

export const logout: RequestHandler = (_request, response) => {
  clearAuthenticationCookie(response);
  return sendSuccess(response, 200, 'Logout successful', null);
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    const user = await authService.getCurrentUser(request.user!.userId);
    return sendSuccess(response, 200, 'Current user retrieved successfully', user);
  } catch (error) { next(error); }
};
