import { describe, expect, it, vi } from 'vitest';
const repository = vi.hoisted(() => ({ create: vi.fn(), findTracking: vi.fn(), capturedInvitation: vi.fn(), review: vi.fn(), activationAction: vi.fn(), activate: vi.fn() }));
vi.mock('../repositories/membership.repository', () => ({ membershipRepository: repository }));
vi.mock('../services/membership-invitation.service', () => ({ membershipInvitationService: { process: vi.fn() }, newInvitation: vi.fn() }));
import { MembershipService } from '../services/membership.service';
import { applicationSchema, trackingSchema } from '../validators/membership.validator';
const input = { fullName: 'Test Alumni', email: 'alumni@example.com', phone: '123456789', graduationYear: 2005 };
const service = new MembershipService();
describe('membership boundaries', () => {
  it('does not accept passwords or role selection in an application', () => {
    expect(applicationSchema.safeParse({ ...input, password: 'Password123' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false);
  });
  it('returns one numeric code, retries a unique collision and never returns a tracking secret', async () => {
    repository.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['trackingCode'] } }).mockImplementation(async (_data, trackingCode) => ({ trackingCode, status: 'PENDING', createdAt: new Date() }));
    const receipt = await service.apply(input);
    expect(receipt.trackingCode).toMatch(/^\d{12}$/); expect(receipt).not.toHaveProperty('secret');
    expect(receipt).not.toHaveProperty('reference'); expect(repository.create).toHaveBeenCalledTimes(2);
  });
  it('rejects code-only tracking and accepts a verified proof or a legacy receipt', () => {
    expect(trackingSchema.safeParse({ trackingCode: '123456789012' }).success).toBe(false);
    expect(trackingSchema.safeParse({ trackingCode: '123456789012', verificationToken: 'a'.repeat(64) }).success).toBe(true);
    expect(trackingSchema.safeParse({ reference: 'GDA-' + 'A'.repeat(24), secret: 'a'.repeat(64) }).success).toBe(true);
  });
  it.each(['ALUMNI', 'SUPER_ADMIN', 'STUDENT', 'REGISTRAR'] as const)('denies %s school approval and resend permission', async role => {
    await expect(service.review({ userId: 'id', role: role as 'ALUMNI' }, 'app', 'APPROVED')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.reissue({ userId: 'id', role: role as 'ALUMNI' }, 'app')).rejects.toMatchObject({ statusCode: 403 });
  });
  it('requires an explanation for rejection', async () => {
    await expect(service.review({ userId: 'admin', role: 'ADMIN' }, 'app', 'REJECTED')).rejects.toMatchObject({ statusCode: 400 });
  });
  it('keeps legacy status responses free of internal notes and verification data', async () => {
    repository.findTracking.mockResolvedValue({ trackingCode: '123456789012', status: 'REJECTED', createdAt: new Date(), reviewedAt: new Date(), rejectionReason: 'Check your year', activatedAt: null, trackingHash: 'private', verificationInformation: 'private', email: 'private@example.com', notes: 'private' });
    const result = await service.status('GDA-' + 'A'.repeat(24), 'a'.repeat(64));
    for (const field of ['email', 'notes', 'trackingHash', 'verificationInformation', 'activationHash']) expect(result).not.toHaveProperty(field);
    expect(result.rejectionReason).toBe('Check your year');
  });
  it('does not claim a historical development link was captured as email', async () => {
    repository.findTracking.mockResolvedValue({ id: 'legacy', trackingCode: '123456789012', status: 'APPROVED', activationDeliveryStatus: 'DEVELOPMENT' });
    repository.capturedInvitation.mockResolvedValue(null);
    expect((await service.status('GDA-' + 'A'.repeat(24), 'a'.repeat(64))).invitationStatus).toBe('NONE');
    repository.capturedInvitation.mockResolvedValue({ id: 'capture' });
    expect((await service.status('GDA-' + 'A'.repeat(24), 'a'.repeat(64))).invitationStatus).toBe('DEVELOPMENT');
  });
});
