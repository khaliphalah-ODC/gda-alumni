import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { env, authLifetimeSeconds } from '../config/env';
import type { JwtPayload } from '../types/auth.types';

const payloadSchema = z.object({ userId: z.string().cuid(), role: z.nativeEnum(Role), sessionVersion: z.number().int().nonnegative().default(0), exp: z.number().int(), iat: z.number().int() });
export function signToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, sessionVersion: payload.sessionVersion ?? 0 }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: authLifetimeSeconds });
}
export function verifyToken(token: string): JwtPayload {
  const payload = payloadSchema.parse(jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }));
  return { userId: payload.userId, role: payload.role, sessionVersion: payload.sessionVersion };
}
