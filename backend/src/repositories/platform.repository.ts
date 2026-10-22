import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { accountSelect, staffSelect } from './account.repository';
import { AppError } from '../utils/app-error';
export const platformRepository = {
  settings() { return prisma.platformSettings.findUnique({ where: { id: 1 } }); },
  async updateSettings(actorId: string, data: { platformName?: string; emailEnabled?: boolean; mediaEnabled?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const settings = await tx.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await tx.auditRecord.create({ data: { actorId, action: 'PLATFORM_SETTINGS_UPDATED', targetId: '1' } });
      return settings;
    });
  },
  async dashboard() {
    const [all, active, pendingInvitations, audit] = await prisma.$transaction([
      prisma.user.count({ where: { role: 'ADMIN' } }), prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
      prisma.accountToken.count({ where: { purpose: 'ADMIN_INVITE', consumedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.auditRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, action: true, actorId: true, targetId: true, createdAt: true } }),
    ]);
    return { admins: { total: all, active, disabled: all - active, pendingInvitations }, audit };
  },
  async admins(page: number, search: string, active?: boolean) {
    const where: Prisma.UserWhereInput = { role: 'ADMIN', isActive: active, OR: [{ email: { contains: search, mode: 'insensitive' } }, { staffProfile: { is: { fullName: { contains: search, mode: 'insensitive' } } } }] };
    const [users, total] = await prisma.$transaction([prisma.user.findMany({ where, skip: (page - 1) * 12, take: 12, select: accountSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), prisma.user.count({ where })]);
    return { users, total };
  },
  detail(id: string) { return prisma.user.findFirst({ where: { id, role: 'ADMIN' }, select: accountSelect }); },
  async updateAdmin(actorId: string, id: string, data: { fullName?: string; isActive?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { id, role: 'ADMIN' } });
      if (!target) throw new AppError(404, 'Admin account not found');
      if (data.isActive !== undefined) {
        const changed = await tx.user.updateMany({ where: { id, role: 'ADMIN' }, data: { isActive: data.isActive, sessionVersion: { increment: 1 } } });
        if (changed.count !== 1) throw new AppError(409, 'Account changed');
        await tx.accountToken.deleteMany({ where: { userId: id } });
      }
      if (data.fullName) await tx.staffProfile.upsert({ where: { userId: id }, create: { userId: id, fullName: data.fullName }, update: { fullName: data.fullName }, select: staffSelect });
      await tx.auditRecord.create({ data: { actorId, targetId: id, action: data.isActive === undefined ? 'ADMIN_UPDATED' : data.isActive ? 'ADMIN_ENABLED' : 'ADMIN_DISABLED' } });
    });
  },
};
