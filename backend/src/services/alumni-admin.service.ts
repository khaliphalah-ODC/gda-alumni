import { alumniAdminRepository } from '../repositories/alumni-admin.repository';
import { assertPermission } from '../policies/permission.policy';
import { accountService } from './account.service';
import type { AuthenticatedUser } from '../types/auth.types';
export const alumniAdminService = {
  list(actor: AuthenticatedUser, page: number, search: string, active?: boolean, graduationYear?: number) { assertPermission(actor.role, 'SCHOOL_MANAGE'); return alumniAdminRepository.list(page, search, active, graduationYear); },
  async update(actor: AuthenticatedUser, id: string, password: string, isActive: boolean) { assertPermission(actor.role, 'SCHOOL_MANAGE'); await accountService.confirm(actor, password); await alumniAdminRepository.update(actor.userId, id, isActive); },
};
