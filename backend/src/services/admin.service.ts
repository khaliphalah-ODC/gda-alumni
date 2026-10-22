import { assertPermission } from '../policies/permission.policy';
import { RequestStatus } from '@prisma/client';
import { adminRepository } from '../repositories/admin.repository';
import type { AuthenticatedUser } from '../types/auth.types';
export class AdminService {
  async dashboard(actor: AuthenticatedUser) {
    assertPermission(actor.role, 'SCHOOL_MANAGE');
    const data = await adminRepository.dashboard();
    const requestsByStatus = Object.fromEntries(Object.values(RequestStatus).map((status) => [status, data.requestCounts.find((row) => row.status === status)?._count._all ?? 0])) as Record<RequestStatus, number>;
    const totalRequests = Object.values(requestsByStatus).reduce((sum, count) => sum + count, 0);
    return { ...data, stats: { ...data.stats, totalRequests }, requestsByStatus };
  }
}
export const adminService = new AdminService();
