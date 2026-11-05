import { hasPermission } from '../policies/permission.policy';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PASSWORD_SALT_ROUNDS } from '../constants/auth.constants';
import { membershipRepository } from '../repositories/membership.repository';
import { membershipInvitationService, newInvitation } from './membership-invitation.service';
import { membershipTrackingService } from './membership-tracking.service';
import { AppError } from '../utils/app-error';
import type { AuthenticatedUser } from '../types/auth.types';
import type { ApplicationInput } from '../validators/membership.validator';
import { getPagination } from '../utils/pagination';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function assertAdmin(actor: AuthenticatedUser) { if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Administrator permission is required'); }
function deliverySummary(application: { activationDeliveryStatus: string; activationDeliveryError?: string | null }) {
  const status = application.activationDeliveryStatus;
  return { status: status.toLowerCase(), message: status === 'SENT' ? 'Invitation submitted to email provider. Inbox delivery is not confirmed.'
    : status === 'DEVELOPMENT' ? 'Invitation captured by the local mail catcher. No external email was delivered.'
    : status === 'FAILED' ? 'Membership approved. Invitation could not be sent. Review the delivery error and retry.'
    : status === 'UNKNOWN' ? 'Membership approved. Provider acceptance is unknown; check provider logs before resending.'
    : 'Membership approved. The activation invitation has been queued for delivery.' };
}
export class MembershipService {
  async apply(data: ApplicationInput) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const trackingCode = String(randomInt(100000000000, 1000000000000));
      try {
        const application = await membershipRepository.create(data, trackingCode, hash(randomBytes(32).toString('hex')));
        return { trackingCode: application.trackingCode, status: application.status, submittedAt: application.createdAt };
      } catch (error) {
        const conflict = error as { code?: string; meta?: { target?: string[] } };
        if (conflict.code !== 'P2002' || !conflict.meta?.target?.some(field => ['reference', 'trackingCode'].includes(field))) throw error;
      }
    }
    throw new AppError(503, 'Application submission is temporarily unavailable. Please try again.');
  }
  async status(reference: string, secret: string) {
    const application = await this.tracked(reference, secret);
    // Historical DEVELOPMENT meant a staff-visible link, not captured mail.
    // Require a real outbox acceptance before displaying a capture milestone.
    const invitationStatus = application.activationDeliveryStatus === 'DEVELOPMENT' && !await membershipRepository.capturedInvitation(application.id) ? 'NONE' : application.activationDeliveryStatus;
    return { trackingCode: application.trackingCode, status: application.status, submittedAt: application.createdAt, reviewedAt: application.reviewedAt, rejectionReason: application.rejectionReason, activated: Boolean(application.activatedAt), activatedAt: application.activatedAt, invitationStatus, invitationAttemptedAt: application.activationDeliveryAt };
  }
  async correct(reference: string, secret: string, data: ApplicationInput) {
    const application = await this.tracked(reference, secret);
    if (data.email !== application.email) throw new AppError(400, 'Email cannot be changed; contact the school for help');
    if (application.status !== 'PENDING') throw new AppError(409, 'Only pending applications can be corrected');
    await membershipRepository.correct(application.id, application.updatedAt, data);
  }
  async list(actor: AuthenticatedUser, page: number, limit: number, search?: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    assertAdmin(actor);
    const [applications, total] = await membershipRepository.list(page, limit, search, status);
    return { applications, pagination: getPagination(page, limit, total) };
  }
  async detail(actor: AuthenticatedUser, id: string) {
    assertAdmin(actor);
    const application = await membershipRepository.detail(id);
    if (!application) throw new AppError(404, 'Membership application not found');
    return application;
  }
  async review(actor: AuthenticatedUser, id: string, decision: 'APPROVED' | 'REJECTED', notes?: string, rejectionReason?: string) {
    assertAdmin(actor);
    if (decision === 'REJECTED' && !rejectionReason?.trim()) throw new AppError(400, 'A rejection explanation is required');
    const invitation = decision === 'APPROVED' ? newInvitation(id) : undefined;
    const application = await membershipRepository.review(id, actor.userId, decision, notes, rejectionReason, invitation);
    if (!invitation) return { application };
    // Approval and its outbox row have already committed. Dispatch/DB failure
    // cannot undo that decision; a durable worker can resume the queued job.
    try { await membershipInvitationService.process(invitation.id); } catch { /* Durable queue remains inspectable. */ }
    const refreshed = await membershipRepository.detail(id).catch(() => null) ?? application;
    return { application: refreshed, delivery: deliverySummary(refreshed) };
  }
  async reissue(actor: AuthenticatedUser, id: string) {
    assertAdmin(actor);
    await membershipInvitationService.recoverStale();
    const invitation = newInvitation(id);
    await membershipRepository.activationAction(id, actor.userId, invitation);
    try { await membershipInvitationService.process(invitation.id); } catch { /* Retry through the durable worker. */ }
    const application = await membershipRepository.detail(id);
    return { delivery: deliverySummary(application ?? { activationDeliveryStatus: 'QUEUED' }), expiresAt: invitation.expiresAt };
  }
  async revoke(actor: AuthenticatedUser, id: string) {
    assertAdmin(actor);
    await membershipRepository.activationAction(id, actor.userId, null);
  }
  async activate(token: string, password: string) {
    return membershipRepository.activate(hash(token), await bcrypt.hash(password, PASSWORD_SALT_ROUNDS));
  }
  async validateActivation(token: string) {
    const invitation = await membershipRepository.validActivation(hash(token));
    if (!invitation) throw new AppError(400, 'Activation invitation is invalid, expired, revoked or already used. Ask the school to resend it by email.');
    return { expiresAt: invitation.activationExpiresAt };
  }
  private async tracked(reference: string, secret: string) {
    // Historical two-part receipts remain valid; new codes require an
    // expiring proof issued only after email ownership verification.
    const application = /^GDA-[A-F0-9]{24}$/.test(reference)
      ? await membershipRepository.findTracking(reference, hash(secret))
      : await membershipTrackingService.find(reference, secret);
    if (!application) throw new AppError(404, 'Application verification is invalid or expired');
    return application;
  }
}
export const membershipService = new MembershipService();
