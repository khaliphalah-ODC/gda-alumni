import { lockEmail } from './account.repository';
import { Prisma, type MembershipStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
import type { ApplicationInput } from '../validators/membership.validator';
import { lockMembershipInvitation } from '../utils/membership-lock';

export const applicationSelection = {
  id: true, reference: true, trackingCode: true, email: true, fullName: true, phone: true, location: true, previousName: true,
  graduationYear: true, studentIndexNumber: true, lastClassAttended: true, verificationInformation: true,
  status: true, rejectionReason: true, reviewedBy: true, reviewedAt: true, activatedAt: true, userId: true,
  createdAt: true, updatedAt: true, activationExpiresAt: true, activationDeliveryStatus: true, activationDeliveryAt: true,
  activationDeliveryError: true,
  invitations: { select: { status: true, provider: true, createdAt: true, acceptedAt: true, lastError: true, attemptsLog: { select: { number: true, status: true, startedAt: true, completedAt: true, diagnostic: true }, orderBy: { number: 'desc' }, take: 5 } }, orderBy: { createdAt: 'desc' }, take: 5 },
  history: { select: { id: true, action: true, notes: true, snapshot: true, createdAt: true, actorId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.MembershipApplicationSelect;

export class MembershipRepository {
  async create(data: ApplicationInput, reference: string, trackingHash: string) {
    return prisma.$transaction(async (tx) => {
      await lockEmail(tx, data.email);
      if (await tx.membershipApplication.findFirst({ where: { email: data.email, status: { in: ['PENDING', 'APPROVED'] } } })) throw new AppError(409, 'An application already exists. Use email verification on the tracking page to recover its code.');
      if (await tx.accountToken.findFirst({ where: { targetEmail: data.email, expiresAt: { gt: new Date() }, consumedAt: null } })) throw new AppError(409, 'This email address is reserved');
      const account = await tx.user.findUnique({ where: { email: data.email } });
      if (account && (account.role !== 'ALUMNI' || !account.isActive)) throw new AppError(409, 'An application cannot be submitted with these details');
      return tx.membershipApplication.create({ data: { ...data, reference, trackingCode: reference, trackingHash, history: { create: { action: 'SUBMITTED', snapshot: { ...data } } } }, select: applicationSelection });
    });
  }
  findTracking(reference: string, trackingHash: string) {
    return prisma.membershipApplication.findFirst({ where: { reference, trackingHash } });
  }
  capturedInvitation(applicationId: string) {
    return prisma.membershipInvitation.findFirst({ where: { applicationId, status: 'DEVELOPMENT', acceptedAt: { not: null } }, select: { id: true } });
  }
  async correct(id: string, updatedAt: Date, data: ApplicationInput) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'PENDING', updatedAt }, data });
      if (result.count !== 1) throw new AppError(409, 'Application changed. Reload its status and try again');
      await tx.membershipReview.create({ data: { applicationId: id, action: 'CORRECTED', snapshot: { ...data } } });
    });
  }
  list(page: number, limit: number, search?: string, status?: MembershipStatus) {
    const where: Prisma.MembershipApplicationWhereInput = { status, ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }, { trackingCode: { contains: search } }] } : {}) };
    return prisma.$transaction([
      prisma.membershipApplication.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, reference: true, trackingCode: true, fullName: true, email: true, graduationYear: true, status: true, activatedAt: true, createdAt: true } }),
      prisma.membershipApplication.count({ where }),
    ]);
  }
  detail(id: string) { return prisma.membershipApplication.findUnique({ where: { id }, select: applicationSelection }); }
  async review(id: string, actorId: string, decision: 'APPROVED' | 'REJECTED', notes?: string, rejectionReason?: string, invitation?: { id: string; applicationId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.$transaction(async (tx) => {
      await lockMembershipInvitation(tx, id);
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'PENDING' }, data: { status: decision, reviewedBy: actorId, reviewedAt: new Date(), rejectionReason: decision === 'REJECTED' ? rejectionReason : null, activationHash: invitation?.tokenHash, activationExpiresAt: invitation?.expiresAt, activationDeliveryStatus: invitation ? 'QUEUED' : 'NONE', activationDeliveryAt: null, activationDeliveryError: null } });
      if (result.count !== 1) throw new AppError(409, 'Only pending applications may be reviewed');
      await tx.membershipReview.create({ data: { applicationId: id, actorId, action: decision, notes } });
      if (invitation) await tx.membershipInvitation.create({ data: invitation });
      return tx.membershipApplication.findUniqueOrThrow({ where: { id }, select: applicationSelection });
    });
  }
  async activationAction(id: string, actorId: string, invitation: { id: string; applicationId: string; tokenHash: string; expiresAt: Date } | null) {
    return prisma.$transaction(async (tx) => {
      await lockMembershipInvitation(tx, id);
      const current = await tx.membershipApplication.findUnique({ where: { id }, select: { updatedAt: true } });
      if (!current) throw new AppError(404, 'Membership application not found');
      const latest = await tx.membershipInvitation.findFirst({ where: { applicationId: id }, orderBy: { createdAt: 'desc' } });
      if (latest?.status === 'SENDING' || (invitation && latest && latest.createdAt > new Date(Date.now() - 60000))) throw new AppError(409, 'An invitation is already being processed or was just issued. Wait a minute and refresh before resending.');
      const result = await tx.membershipApplication.updateMany({ where: { id, status: 'APPROVED', activatedAt: null, activationDeliveryStatus: { not: 'SENDING' }, updatedAt: current.updatedAt }, data: { activationHash: invitation?.tokenHash ?? null, activationExpiresAt: invitation?.expiresAt ?? null, activationDeliveryStatus: invitation ? 'QUEUED' : 'CANCELLED', activationDeliveryAt: null, activationDeliveryError: null } });
      if (result.count !== 1) throw new AppError(409, 'Only approved, unactivated applications support this action');
      await tx.membershipInvitation.updateMany({ where: { applicationId: id, status: { in: ['QUEUED', 'FAILED', 'UNKNOWN'] } }, data: { status: 'CANCELLED' } });
      if (invitation) await tx.membershipInvitation.create({ data: invitation });
      await tx.membershipReview.create({ data: { applicationId: id, actorId, action: invitation ? 'ACTIVATION_REISSUED' : 'ACTIVATION_REVOKED' } });
    });
  }
  validActivation(activationHash: string) {
    return prisma.membershipApplication.findFirst({ where: { activationHash, status: 'APPROVED', activatedAt: null, activationConsumedAt: null, activationExpiresAt: { gt: new Date() } }, select: { activationExpiresAt: true } });
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
