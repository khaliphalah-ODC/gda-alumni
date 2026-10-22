import type { CookieOptions, Response } from 'express';
import { env, authLifetimeSeconds } from '../config/env';
import { AUTH_COOKIE_NAME } from '../constants/auth.constants';

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};
export const authCookieMaxAge = authLifetimeSeconds * 1000;
export function clearAuthenticationCookie(response: Response) {
  response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
}
