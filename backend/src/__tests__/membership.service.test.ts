import { describe, expect, it, vi } from 'vitest';
const repository = vi.hoisted(() => ({ create: vi.fn(), findTracking: vi.fn(), review: vi.fn(), activationAction: vi.fn(), activate: vi.fn() }));
vi.mock('../repositories/membership.repository', () => ({ membershipRepository: repository }));
import { env } from '../config/env';
import { MembershipService } from '../services/membership.service';
import { applicationSchema } from '../validators/membership.validator';
const input = { fullName: 'Test Alumni', email: 'alumni@example.com', phone: '123456789', graduationYear: 2005 };
const service = new MembershipService();
describe('membership boundaries', () => {
  it('does not accept passwords or role selection in an application', () => {
    expect(applicationSchema.safeParse({ ...input, password: 'Password123' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false);
  });
  it('returns a private tracking secret but stores only its hash', async () => {
    repository.create.mockResolvedValue({ status: 'PENDING', createdAt: new Date() });
    const receipt = await service.apply(input);
    expect(receipt.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.reference).toMatch(/^GDA-[A-F0-9]{24}$/);
    expect(repository.create.mock.calls.at(-1)?.[2]).not.toBe(receipt.secret);
  });
  it('enforces administrator decisions in the service layer', async () => {
    await expect(service.review({ userId: 'id', role: 'ALUMNI' }, 'app', 'APPROVED')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.reissue({ userId: 'id', role: 'ALUMNI' }, 'app')).rejects.toMatchObject({ statusCode: 403 });
  });
  it('does not expose development invitations in production', async () => {
    const previous = env.NODE_ENV; env.NODE_ENV = 'production';
    try { await expect(service.review({ userId: 'admin', role: 'ADMIN' }, 'app', 'APPROVED')).rejects.toMatchObject({ statusCode: 503 }); } finally { env.NODE_ENV = previous; }
  });
  it('requires an explanation for rejection', async () => {
    await expect(service.review({ userId: 'admin', role: 'ADMIN' }, 'app', 'REJECTED')).rejects.toMatchObject({ statusCode: 400 });
  });
  it('never exposes internal notes or verification data in status responses', async () => {
    repository.findTracking.mockResolvedValue({ reference: 'reference', status: 'REJECTED', createdAt: new Date(), reviewedAt: new Date(), rejectionReason: 'Check your graduation year', activatedAt: null, trackingHash: 'private', verificationInformation: 'private', email: 'private@example.com', notes: 'private' });
    const result = await service.status('reference', 'secret');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('trackingHash');
    expect(result).not.toHaveProperty('verificationInformation');
    expect(result.rejectionReason).toBe('Check your graduation year');
  });
});
