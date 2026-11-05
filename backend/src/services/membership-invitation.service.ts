import { createHash, createHmac, randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { activationDeliveryService } from './activation-delivery.service';
import { emailConfiguration } from './email.service';
import { lockMembershipInvitation } from '../utils/membership-lock';

export const invitationToken = (jobId: string, applicationId: string) => createHmac('sha256', env.JWT_SECRET).update(`membership-invitation:v1:${jobId}:${applicationId}`).digest('hex');
export function newInvitation(applicationId: string) {
  const id = randomUUID();
  const tokenHash = createHash('sha256').update(invitationToken(id, applicationId)).digest('hex');
  return { id, applicationId, tokenHash, expiresAt: new Date(Date.now() + 48 * 3600000) };
}

export const membershipInvitationService = {
  async recoverStale() {
    const expired = await prisma.membershipInvitation.findMany({ where: { status: { in: ['QUEUED', 'FAILED'] }, expiresAt: { lte: new Date() } }, take: 10 });
    for (const job of expired) await prisma.$transaction(async tx => {
      await lockMembershipInvitation(tx, job.applicationId);
      const cancelled = await tx.membershipInvitation.updateMany({ where: { id: job.id, status: { in: ['QUEUED', 'FAILED'] } }, data: { status: 'CANCELLED', lastError: 'INVITATION_EXPIRED' } });
      if (cancelled.count) await tx.membershipApplication.updateMany({ where: { id: job.applicationId, activationHash: job.tokenHash, activatedAt: null }, data: { activationDeliveryStatus: 'CANCELLED', activationDeliveryError: 'INVITATION_EXPIRED' } });
    });
    const stale = await prisma.membershipInvitation.findMany({ where: { status: 'SENDING', leasedAt: { lt: new Date(Date.now() - 2 * 60000) } }, take: 10 });
    for (const job of stale) await prisma.$transaction(async tx => {
      await lockMembershipInvitation(tx, job.applicationId);
      const claimed = await tx.membershipInvitation.updateMany({ where: { id: job.id, status: 'SENDING', leaseId: job.leaseId }, data: { status: 'UNKNOWN', lastError: 'WORKER_INTERRUPTED', leaseId: null } });
      if (claimed.count) {
        await tx.membershipInvitationAttempt.updateMany({ where: { invitationId: job.id, number: job.attempts, status: 'SENDING' }, data: { status: 'UNKNOWN', completedAt: new Date(), diagnostic: 'WORKER_INTERRUPTED' } });
        await tx.membershipApplication.updateMany({ where: { id: job.applicationId, activationHash: job.tokenHash, activatedAt: null }, data: { activationDeliveryStatus: 'UNKNOWN', activationDeliveryError: 'WORKER_INTERRUPTED' } });
      }
    });
  },
  async process(id: string) {
    const leaseId = randomUUID(), now = new Date();
    const job = await prisma.$transaction(async tx => {
      const identity = await tx.membershipInvitation.findUnique({ where: { id }, select: { applicationId: true } });
      if (!identity) return null;
      await lockMembershipInvitation(tx, identity.applicationId);
      const candidate = await tx.membershipInvitation.findUnique({ where: { id } });
      if (!candidate || !['QUEUED', 'FAILED'].includes(candidate.status) || candidate.availableAt > now || candidate.attempts >= 5) return null;
      const application = await tx.membershipApplication.findUnique({ where: { id: candidate.applicationId } });
      if (!application || application.activationHash !== candidate.tokenHash || application.status !== 'APPROVED' || application.activatedAt || candidate.expiresAt <= now) {
        await tx.membershipInvitation.updateMany({ where: { id, status: { in: ['QUEUED', 'FAILED'] } }, data: { status: 'CANCELLED', lastError: 'INVITATION_NO_LONGER_VALID' } });
        return null;
      }
      const claimed = await tx.membershipInvitation.updateMany({ where: { id, status: { in: ['QUEUED', 'FAILED'] }, attempts: candidate.attempts, availableAt: { lte: now } }, data: { status: 'SENDING', leaseId, leasedAt: now, attempts: { increment: 1 }, provider: emailConfiguration().provider } });
      if (!claimed.count) return null;
      const active = await tx.membershipApplication.updateMany({ where: { id: application.id, activationHash: candidate.tokenHash, activatedAt: null }, data: { activationDeliveryStatus: 'SENDING', activationDeliveryAt: now, activationDeliveryError: null } });
      if (!active.count) {
        await tx.membershipInvitation.update({ where: { id }, data: { status: 'CANCELLED', leaseId: null } });
        return null;
      }
      await tx.membershipInvitationAttempt.create({ data: { invitationId: id, number: candidate.attempts + 1 } });
      return { ...candidate, application, attempts: candidate.attempts + 1 };
    });
    if (!job) return;
    const token = invitationToken(job.id, job.applicationId);
    // Rotation of JWT_SECRET invalidates queued derivations. Never send a link
    // whose hash differs from the invitation authorized by the transaction.
    const delivery = createHash('sha256').update(token).digest('hex') === job.tokenHash
      ? await activationDeliveryService.send(job.application.email, job.application.fullName, token, job.expiresAt)
      : { status: 'failed' as const, diagnostic: 'SIGNING_KEY_CHANGED', retrySafe: false };
    const status = delivery.status === 'sent' ? 'SENT' : delivery.status === 'development' ? 'DEVELOPMENT' : delivery.status === 'unknown' ? 'UNKNOWN' : 'FAILED';
    await prisma.$transaction(async tx => {
      await lockMembershipInvitation(tx, job.applicationId);
      const updated = await tx.membershipInvitation.updateMany({ where: { id, status: 'SENDING', leaseId }, data: {
        status, lastError: delivery.diagnostic ?? null, leaseId: null,
        acceptedAt: status === 'SENT' || status === 'DEVELOPMENT' ? new Date() : null,
        availableAt: new Date(Date.now() + Math.min(15 * 60000, 60000 * 2 ** (job.attempts - 1))),
        ...(!delivery.retrySafe && status === 'FAILED' ? { attempts: 5 } : {}),
      } });
      if (updated.count) await tx.membershipApplication.updateMany({ where: { id: job.applicationId, activationHash: job.tokenHash, activatedAt: null }, data: { activationDeliveryStatus: status, activationDeliveryError: delivery.diagnostic ?? null } });
      if (updated.count) await tx.membershipInvitationAttempt.updateMany({ where: { invitationId: id, number: job.attempts }, data: { status, completedAt: new Date(), diagnostic: delivery.diagnostic ?? null } });
    });
  },
  async drain(limit = 3) {
    await this.recoverStale();
    const jobs = await prisma.membershipInvitation.findMany({ where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: 5 }, availableAt: { lte: new Date() }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'asc' }, take: limit });
    for (const job of jobs) await this.process(job.id);
    return { processed: jobs.length, pending: await prisma.membershipInvitation.count({ where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: 5 }, expiresAt: { gt: new Date() } } }) };
  },
};
