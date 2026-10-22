import { hasPermission } from '../policies/permission.policy';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { activationDeliveryService, assertActivationDeliveryConfigured } from './activation-delivery.service';
import type { InvitationDelivery } from './activation-delivery.service';
import { PASSWORD_SALT_ROUNDS } from '../constants/auth.constants';
import { membershipRepository } from '../repositories/membership.repository';
import { AppError } from '../utils/app-error';
import type { AuthenticatedUser } from '../types/auth.types';
import type { ApplicationInput } from '../validators/membership.validator';
import { getPagination } from '../utils/pagination';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const credential = () => randomBytes(32).toString('hex');
function assertAdmin(actor: AuthenticatedUser) { if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Administrator permission is required'); }
function activation() {
  assertActivationDeliveryConfigured();
  const token = credential();
  return { token, hash: hash(token), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) };
}
type MembershipReviewResult = {
  application: NonNullable<Awaited<ReturnType<typeof membershipRepository.detail>>>;
  delivery?: InvitationDelivery;
  developmentActivationLink?: string;
};
export class MembershipService {
  async apply(data: ApplicationInput) {
    const secret = credential();
    const reference = `GDA-${randomBytes(12).toString('hex').toUpperCase()}`;
    const application = await membershipRepository.create(data, reference, hash(secret));
    return { reference, secret, status: application.status, submittedAt: application.createdAt };
  }
  async status(reference: string, secret: string) {
    const application = await this.tracked(reference, secret);
    return { reference: application.reference, status: application.status, submittedAt: application.createdAt, reviewedAt: application.reviewedAt, rejectionReason: application.rejectionReason, activated: Boolean(application.activatedAt) };
  }
  async correct(reference: string, secret: string, data: ApplicationInput) {
    const application = await this.tracked(reference, secret);
    if (data.email !== application.email) throw new AppError(400, 'Email cannot be changed; contact the registrar for help');
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
  async review(actor: AuthenticatedUser, id: string, decision: 'APPROVED' | 'REJECTED', notes?: string, rejectionReason?: string): Promise<MembershipReviewResult> {
    assertAdmin(actor);
    if (decision === 'REJECTED' && !rejectionReason?.trim()) throw new AppError(400, 'A rejection explanation is required');
    const invitation = decision === 'APPROVED' ? activation() : undefined;
    const application = await membershipRepository.review(id, actor.userId, decision, notes, rejectionReason, invitation?.hash, invitation?.expiresAt);
    if (!invitation) return { application };
    const delivery = await this.deliver(application.id, application.email, application.fullName, invitation);
    const refreshed = await membershipRepository.detail(application.id);
    return { application: refreshed ?? application, delivery, ...(delivery.developmentActivationLink ? { developmentActivationLink: delivery.developmentActivationLink } : {}) };
  }
  async reissue(actor: AuthenticatedUser, id: string) {
    assertAdmin(actor);
    const invitation = activation();
    await membershipRepository.activationAction(id, actor.userId, invitation.hash, invitation.expiresAt);
    const application = await membershipRepository.detail(id);
    if (!application) throw new AppError(404, 'Application not found');
    const delivery = await this.deliver(id, application.email, application.fullName, invitation);
    return { delivery, ...(delivery.developmentActivationLink ? { developmentActivationLink: delivery.developmentActivationLink } : {}), expiresAt: invitation.expiresAt };
  }
  async revoke(actor: AuthenticatedUser, id: string) {
    assertAdmin(actor);
    await membershipRepository.activationAction(id, actor.userId, null, null);
  }
  async activate(token: string, password: string) {
    return membershipRepository.activate(hash(token), await bcrypt.hash(password, PASSWORD_SALT_ROUNDS));
  }
  private async deliver(id: string, email: string, fullName: string, invitation: { token: string; hash: string }) {
    const delivery = await activationDeliveryService.send(email, fullName, invitation.token);
    await membershipRepository.recordDelivery(id, invitation.hash, delivery.status === 'sent' ? 'SENT' : delivery.status === 'failed' ? 'FAILED' : 'DEVELOPMENT');
    return delivery;
  }
  private async tracked(reference: string, secret: string) {
    const application = await membershipRepository.findTracking(reference, hash(secret));
    if (!application) throw new AppError(404, 'Application reference or tracking secret is invalid');
    return application;
  }
}
export const membershipService = new MembershipService();
