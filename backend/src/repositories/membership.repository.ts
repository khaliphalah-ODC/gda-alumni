import { lockEmail } from './account.repository';
import { Prisma, type MembershipStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
import type { ApplicationInput } from '../validators/membership.validator';

export const applicationSelection = {
  id: true, reference: true, email: true, fullName: true, phone: true, location: true, previousName: true,
  graduationYear: true, studentIndexNumber: true, lastClassAttended: true, verificationInformation: true,
  status: true, rejectionReason: true, reviewedBy: true, reviewedAt: true, activatedAt: true, userId: true,
  createdAt: true, updatedAt: true, activationExpiresAt: true, activationDeliveryStatus: true, activationDeliveryAt: true,
  history: { select: { id: true, action: true, notes: true, snapshot: true, createdAt: true, actorId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.MembershipApplicationSelect;

export class MembershipRepository {
  async create(data: ApplicationInput, reference: string, trackingHash: string) {
    return prisma.$transaction(async (tx) => {
      await lockEmail(tx, data.email);
      if (await tx.accountToken.findFirst({ where: { targetEmail: data.email, expiresAt: { gt: new Date() }, consumedAt: null } })) throw new AppError(409, 'This email address is reserved');
      const account = await tx.user.findUnique({ where: { email: data.email } });
      if (account && (account.role !== 'ALUMNI' || !account.isActive)) throw new AppError(409, 'An application cannot be submitted with these details');
      return tx.membershipApplication.create({ data: { ...data, reference, trackingHash, history: { create: { action: 'SUBMITTED', snapshot: { ...data } } } }, select: applicationSelection });
    });
  }
  findTracking(reference: string, trackingHash: string) {
    return prisma.membershipApplication.findFirst({ where: { reference, trackingHash } });
  }
  async correct(id: string, updatedAt: Date, data: ApplicationInput) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'PENDING', updatedAt }, data });
      if (result.count !== 1) throw new AppError(409, 'Application changed. Reload its status and try again');
      await tx.membershipReview.create({ data: { applicationId: id, action: 'CORRECTED', snapshot: { ...data } } });
    });
  }
  list(page: number, limit: number, search?: string, status?: MembershipStatus) {
    const where: Prisma.MembershipApplicationWhereInput = { status, ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }] } : {}) };
    return prisma.$transaction([
      prisma.membershipApplication.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, reference: true, fullName: true, email: true, graduationYear: true, status: true, activatedAt: true, createdAt: true } }),
      prisma.membershipApplication.count({ where }),
    ]);
  }
  detail(id: string) { return prisma.membershipApplication.findUnique({ where: { id }, select: applicationSelection }); }
  async review(id: string, actorId: string, decision: 'APPROVED' | 'REJECTED', notes?: string, rejectionReason?: string, activationHash?: string, activationExpiresAt?: Date) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'PENDING' }, data: { status: decision, reviewedBy: actorId, reviewedAt: new Date(), rejectionReason: decision === 'REJECTED' ? rejectionReason : null, activationHash, activationExpiresAt, activationDeliveryStatus: 'NONE', activationDeliveryAt: null } });
      if (result.count !== 1) throw new AppError(409, 'Only pending applications may be reviewed');
      await tx.membershipReview.create({ data: { applicationId: id, actorId, action: decision, notes } });
      return tx.membershipApplication.findUniqueOrThrow({ where: { id }, select: applicationSelection });
    });
  }
  async activationAction(id: string, actorId: string, hash: string | null, expiresAt: Date | null) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'APPROVED', activatedAt: null }, data: { activationHash: hash, activationExpiresAt: expiresAt, activationDeliveryStatus: 'NONE', activationDeliveryAt: null } });
      if (result.count !== 1) throw new AppError(409, 'Only approved, unactivated applications support this action');
      await tx.membershipReview.create({ data: { applicationId: id, actorId, action: hash ? 'ACTIVATION_REISSUED' : 'ACTIVATION_REVOKED' } });
    });
  }
  recordDelivery(id: string, activationHash: string, status: 'SENT' | 'FAILED' | 'DEVELOPMENT') {
    // A delayed transport result must not overwrite a newer invitation's state.
    return prisma.membershipApplication.updateMany({ where: { id, activationHash, activatedAt: null }, data: { activationDeliveryStatus: status, activationDeliveryAt: new Date() } });
  }
  async activate(hash: string, password: string) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const application = await tx.membershipApplication.findFirst({ where: { activationHash: hash, status: 'APPROVED', activatedAt: null, activationConsumedAt: null, activationExpiresAt: { gt: now } } });
      if (!application) throw new AppError(400, 'Activation link is invalid, expired, revoked, or already used');
      await lockEmail(tx, application.email);
      if (await tx.accountToken.findFirst({ where: { targetEmail: application.email, expiresAt: { gt: now }, consumedAt: null } })) throw new AppError(409, 'This email address is reserved');
      // Claim the token before account creation. A racing consumer waits and
      // fails this predicate; any subsequent failure rolls the claim back.
      const claim = await tx.membershipApplication.updateMany({ where: { id: application.id, activationHash: hash, activationConsumedAt: null, activatedAt: null, activationExpiresAt: { gt: now } }, data: { activationConsumedAt: now, activationHash: null } });
      if (claim.count !== 1) throw new AppError(400, 'Activation link is invalid, expired, revoked, or already used');
      const user = await tx.user.findUnique({ where: { email: application.email }, include: { membershipApplication: true } });
      if (user && (user.role !== 'ALUMNI' || !user.isActive || user.membershipApplication)) throw new AppError(409, 'Account cannot be activated. Contact the registrar');
      const account = user
        ? await tx.user.update({ where: { id: user.id }, data: { password, sessionVersion: { increment: 1 } } })
        : await tx.user.create({ data: { email: application.email, password, role: 'ALUMNI' } });
      await tx.alumniProfile.upsert({ where: { userId: account.id }, create: { userId: account.id, fullName: application.fullName, graduationYear: application.graduationYear, phone: application.phone, location: application.location }, update: {} });
      await tx.membershipApplication.update({ where: { id: application.id }, data: { userId: account.id, activatedAt: now } });
      await tx.membershipReview.create({ data: { applicationId: application.id, actorId: account.id, action: 'ACTIVATED' } });
      return { email: account.email };
    });
  }
}
export const membershipRepository = new MembershipRepository();
