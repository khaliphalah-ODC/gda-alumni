import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
export const alumniAdminRepository = {
  async list(page: number, search: string, active?: boolean, graduationYear?: number) {
    const where = { role: 'ALUMNI' as const, isActive: active, ...(graduationYear === undefined ? {} : { alumniProfile: { is: { graduationYear } } }), OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { alumniProfile: { is: { fullName: { contains: search, mode: 'insensitive' as const } } } }] };
    const [users, total] = await prisma.$transaction([prisma.user.findMany({ where, select: { id: true, email: true, isActive: true, alumniProfile: { select: { fullName: true, graduationYear: true, occupation: true, location: true, profileImage: true } } }, skip: (page - 1) * 12, take: 12, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), prisma.user.count({ where })]);
    return { users, total };
  },
  update(actorId: string, id: string, isActive: boolean) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({ where: { id, role: 'ALUMNI' }, data: { isActive, sessionVersion: { increment: 1 } } });
      if (result.count !== 1) throw new AppError(404, 'Alumni account not found');
      await tx.accountToken.deleteMany({ where: { userId: id } });
      await tx.auditRecord.create({ data: { actorId, targetId: id, action: isActive ? 'ALUMNI_ENABLED' : 'ALUMNI_DISABLED' } });
    });
  },
};
