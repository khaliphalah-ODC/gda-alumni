import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

const invalid = () => new AppError(400, 'This password reset link is invalid, expired or already used. Request a new link.');
export const passwordResetRepository = {
  async issue(email: string, tokenHash: string) {
    return prisma.$transaction(async tx => {
      const initial = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (!initial) return null;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: initial.id }, include: { membershipApplication: true } });
      if (!user?.isActive || user.email !== email || user.role === 'STUDENT'
        || (user.role === 'ALUMNI' && (user.membershipApplication?.status !== 'APPROVED' || !user.membershipApplication.activatedAt))) return null;
      await tx.accountToken.deleteMany({ where: { userId: user.id, purpose: 'PASSWORD_RESET' } });
      const token = await tx.accountToken.create({ data: { userId: user.id, purpose: 'PASSWORD_RESET', tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60000), sessionVersion: user.sessionVersion, emailSnapshot: user.email } });
      await tx.auditRecord.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', targetId: user.id } });
      return { id: token.id, email: user.email };
    });
  },
  async redeem(tokenHash: string, password: string) {
    return prisma.$transaction(async tx => {
      const token = await tx.accountToken.findUnique({ where: { tokenHash } });
      if (!token?.userId || token.purpose !== 'PASSWORD_RESET' || token.consumedAt || !token.deliveredAt || token.expiresAt <= new Date()) throw invalid();
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${token.userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: token.userId }, include: { membershipApplication: true } });
      if (!user?.isActive || user.role === 'STUDENT' || user.email !== token.emailSnapshot || user.sessionVersion !== token.sessionVersion
        || (user.role === 'ALUMNI' && (user.membershipApplication?.status !== 'APPROVED' || !user.membershipApplication.activatedAt))) throw invalid();
      const claim = await tx.accountToken.updateMany({ where: { id: token.id, tokenHash, consumedAt: null, deliveredAt: { not: null }, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date(), tokenHash: null } });
      if (claim.count !== 1) throw invalid();
      await tx.user.update({ where: { id: user.id }, data: { password, sessionVersion: { increment: 1 } } });
      await tx.accountToken.deleteMany({ where: { userId: user.id, id: { not: token.id }, purpose: { in: ['EMAIL_CHANGE', 'PASSWORD_RESET'] } } });
      await tx.auditRecord.create({ data: { actorId: user.id, action: 'PASSWORD_RESET_COMPLETED', targetId: user.id } });
      return user.email;
    });
  },
};
