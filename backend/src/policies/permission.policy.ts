import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error';
export type Permission = 'ACCOUNT_MANAGE' | 'PLATFORM_MANAGE' | 'SCHOOL_MANAGE' | 'ALUMNI_ACCESS';
const permissions: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ['ACCOUNT_MANAGE', 'PLATFORM_MANAGE'],
  ADMIN: ['ACCOUNT_MANAGE', 'SCHOOL_MANAGE'],
  ALUMNI: ['ACCOUNT_MANAGE', 'ALUMNI_ACCESS'],
  STUDENT: [],
};
export function hasPermission(role: Role, permission: Permission) { return permissions[role]?.includes(permission) ?? false; }
export function assertPermission(role: Role, ...required: Permission[]) {
  if (!required.some((permission) => hasPermission(role, permission))) throw new AppError(403, 'You do not have permission to perform this action');
}
export const requirePermission = (...required: Permission[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication is required'));
  try { assertPermission(req.user.role, ...required); next(); } catch (error) { next(error); }
};
