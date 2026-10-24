import { Prisma, type Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
export const staffSelect = { fullName: true, phone: true, location: true, profileImage: true, imageVersion: true } as const;
export const alumniSelect = { ...staffSelect, graduationYear: true, occupation: true, bio: true } as const;
export const accountSelect = { id: true, email: true, role: true, isActive: true, createdAt: true, staffProfile: { select: staffSelect }, alumniProfile: { select: alumniSelect } } as const;
export async function lockEmail(tx: Prisma.TransactionClient, email: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
}
export async function assertEmailAvailable(tx: Prisma.TransactionClient, email: string) {
  if (await tx.user.findUnique({ where: { email } }) || await tx.accountToken.findUnique({ where: { targetEmail: email } }) || await tx.membershipApplication.findFirst({ where: { email, status: { in: ['PENDING', 'APPROVED'] }, activatedAt: null } })) throw new AppError(409, 'This email address is already in use or reserved');
}
async function lockUser(tx: Prisma.TransactionClient, id: string, sessionVersion?: number, disabledStatus = 401) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  if (!user.isActive) throw new AppError(disabledStatus, 'Account is disabled');
  if (sessionVersion !== undefined && user.sessionVersion !== sessionVersion) throw new AppError(401, 'Your session has ended');
  return user;
}
export const accountRepository = {
  me(id: string) { return prisma.user.findUniqueOrThrow({ where: { id }, select: accountSelect }); },
  credentials(id: string) { return prisma.user.findUniqueOrThrow({ where: { id } }); },
  async profile(id: string, sessionVersion: number, role: Role, data: { fullName: string; phone?: string | null; location?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const user = await lockUser(tx, id, sessionVersion);
      if (user.role !== role) throw new AppError(409, 'Account permissions changed. Sign in again');
      return role === 'ALUMNI'
        ? tx.alumniProfile.upsert({ where: { userId: id }, create: { ...data, userId: id }, update: data, select: alumniSelect })
        : tx.staffProfile.upsert({ where: { userId: id }, create: { ...data, userId: id }, update: data, select: staffSelect });
    });
  },
  async changePassword(id: string, oldHash: string, hash: string, version: number) {
    return prisma.$transaction(async (tx) => {
      await lockUser(tx, id, version);
      const result = await tx.user.updateMany({ where: { id, password: oldHash, sessionVersion: version, isActive: true }, data: { password: hash, sessionVersion: { increment: 1 } } });
      if (result.count !== 1) throw new AppError(409, 'Account changed. Sign in again');
      await tx.accountToken.deleteMany({ where: { userId: id, purpose: { in: ['EMAIL_CHANGE', 'PASSWORD_RESET'] } } });
      await tx.auditRecord.create({ data: { actorId: id, action: 'PASSWORD_CHANGED', targetId: id } });
    });
  },
  async reserve(userId: string | null, purpose: 'EMAIL_CHANGE' | 'ADMIN_INVITE', email: string, tokenHash: string, expiresAt: Date, actorId: string, version: number, fullName?: string) {
    return prisma.$transaction(async (tx) => {
      await lockUser(tx, actorId, version);
      await lockEmail(tx, email);
      await tx.accountToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, ...(userId ? [{ userId, purpose }] : [])] } });
      await assertEmailAvailable(tx, email);
      const token = await tx.accountToken.create({ data: { userId, purpose, targetEmail: email, fullName, tokenHash, expiresAt } });
      await tx.auditRecord.create({ data: { actorId, action: purpose === 'ADMIN_INVITE' ? 'ADMIN_INVITED' : 'EMAIL_CHANGE_REQUESTED', targetId: token.id } });
      return token.id;
    });
  },
  notificationFailed(userId: string) { return prisma.auditRecord.create({ data: { actorId: userId, targetId: userId, action: 'EMAIL_CHANGE_NOTIFICATION_FAILED' } }); },
  delivery(id: string, success: boolean) { return success ? prisma.accountToken.updateMany({ where: { id, consumedAt: null }, data: { deliveredAt: new Date() } }) : prisma.accountToken.deleteMany({ where: { id, consumedAt: null } }); },
  async consume(tokenHash: string, purpose: string, passwordHash?: string) {
    return prisma.$transaction(async (tx) => {
      const token = await tx.accountToken.findUnique({ where: { tokenHash } });
      if (!token?.targetEmail || token.purpose !== purpose || token.consumedAt || !token.deliveredAt || token.expiresAt <= new Date()) throw new AppError(400, 'Verification link is invalid, expired or already used');
      const owner = purpose === 'EMAIL_CHANGE' ? await lockUser(tx, token.userId!, undefined, 403) : null;
      await lockEmail(tx, token.targetEmail);
      const claim = await tx.accountToken.updateMany({ where: { id: token.id, tokenHash, consumedAt: null, expiresAt: { gt: new Date() }, deliveredAt: { not: null } }, data: { consumedAt: new Date(), tokenHash: null, targetEmail: null } });
      if (claim.count !== 1) throw new AppError(400, 'Verification link is invalid, expired or already used');
      if (await tx.user.findUnique({ where: { email: token.targetEmail } })) throw new AppError(409, 'Email address is already in use');
      if (purpose === 'ADMIN_INVITE') {
        const user = await tx.user.create({ data: { email: token.targetEmail, password: passwordHash!, role: 'ADMIN', staffProfile: { create: { fullName: token.fullName! } } } });
        await tx.auditRecord.create({ data: { actorId: user.id, action: 'ADMIN_ACTIVATED', targetId: user.id } });
        return { userId: user.id, oldEmail: null, email: user.email };
      }
      const user = owner!;
      if (!user.isActive) throw new AppError(403, 'Account is disabled');
      const updated = await tx.user.updateMany({ where: { id: user.id, isActive: true, sessionVersion: user.sessionVersion }, data: { email: token.targetEmail, sessionVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, 'Account changed. Request a new verification');
      await tx.auditRecord.create({ data: { actorId: user.id, action: 'EMAIL_CHANGED', targetId: user.id } });
      return { userId: user.id, oldEmail: user.email, email: token.targetEmail };
    });
  },
  image(id: string, role: Role) { return role === 'ALUMNI' ? prisma.alumniProfile.findUnique({ where: { userId: id } }) : prisma.staffProfile.findUnique({ where: { userId: id } }); },
  async saveImage(id: string, role: Role, version: number, sessionVersion: number, url: string | null, publicId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockUser(tx, id, sessionVersion);
      const profile = role === 'ALUMNI' ? await tx.alumniProfile.findUnique({ where: { userId: id } }) : await tx.staffProfile.findUnique({ where: { userId: id } });
      if (!profile) throw new AppError(400, 'Save your personal profile before changing its picture');
      const data = { profileImage: url, profileImagePublicId: publicId, imageVersion: { increment: 1 } };
      const updated = role === 'ALUMNI' ? await tx.alumniProfile.updateMany({ where: { userId: id, imageVersion: version }, data }) : await tx.staffProfile.updateMany({ where: { userId: id, imageVersion: version }, data });
      if (updated.count !== 1) throw new AppError(409, 'Profile picture changed. Refresh before replacing it');
      if (profile.profileImagePublicId) await tx.mediaCleanup.upsert({ where: { publicId: profile.profileImagePublicId }, create: { publicId: profile.profileImagePublicId }, update: {} });
    });
  },
};
