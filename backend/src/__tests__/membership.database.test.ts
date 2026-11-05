import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcrypt';
const messages = vi.hoisted(() => [] as { to: string; text: string; html: string }[]);
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (message: typeof messages[number]) => { messages.push(message); return { accepted: [message.to], rejected: [] }; } }) } }));
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
describe.skipIf(!databaseUrl)('Membership database, email verification and HTTP workflow', () => {
  let prisma: PrismaClient, app: typeof import('../app').app, service: typeof import('../services/membership.service').membershipService;
  let tracking: typeof import('../services/membership-tracking.service').membershipTrackingService;
  let config: typeof import('../config/env').env, previous: typeof config;
  let settings: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  let admin: { userId: string; role: 'ADMIN' }, adminCookie: string;
  const suffix = `@membership-${Date.now()}.example`, password = 'MembershipPassword123!';
  const input = (name: string) => ({ email: name + suffix, fullName: 'Approved Alumnus', phone: '123456789', graduationYear: 2004, location: 'Monrovia', verificationInformation: 'Private verification' });
  const tokenFor = (email: string) => messages.filter(message => message.to === email).at(-1)!.text.match(/#token=([a-f0-9]{64})/)![1]!;
  const otpFor = (email: string) => messages.filter(message => message.to === email).at(-1)!.text.match(/code is ([0-9]{6})/)![1]!;
  async function proof(email: string, code?: string) {
    const challenge = await tracking.request(email, code);
    await vi.waitFor(async () => expect(await prisma.membershipTrackingChallenge.findUnique({ where: { id: challenge.challengeId } })).toMatchObject({ deliveredAt: expect.any(Date) }));
    return tracking.verify(challenge.challengeId, otpFor(email));
  }
  async function allowResend(id: string) {
    await prisma.membershipInvitation.updateMany({ where: { applicationId: id }, data: { createdAt: new Date(0) } });
    await prisma.membershipApplication.update({ where: { id }, data: { updatedAt: new Date(0) } });
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    ({ env: config } = await import('../config/env.js')); previous = { ...config };
    Object.assign(config, { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'localhost', SMTP_FROM: 'test@example.test' });
    ({ app } = await import('../app.js')); ({ membershipService: service } = await import('../services/membership.service.js'));
    ({ membershipTrackingService: tracking } = await import('../services/membership-tracking.service.js'));
    settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
    await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true }, update: { emailEnabled: true } });
    const account = await prisma.user.create({ data: { email: 'admin' + suffix, password: await bcrypt.hash(password, 4), role: 'ADMIN' } });
    admin = { userId: account.id, role: 'ADMIN' };
    const { signToken } = await import('../utils/jwt.js'); adminCookie = `gray_d_allison_token=${signToken(admin)}`;
  });
  afterAll(async () => {
    if (!prisma) return;
    Object.assign(config, previous);
    const apps = await prisma.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await prisma.membershipReview.deleteMany({ where: { applicationId: { in: apps.map(row => row.id) } } });
    await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } });
    if (settings) await prisma.platformSettings.update({ where: { id: 1 }, data: settings }); else await prisma.platformSettings.deleteMany({ where: { id: 1 } });
    await prisma.$disconnect(); const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  it('rejects direct account registration and application passwords', async () => {
    expect((await request(app).post('/api/auth/register').set('X-GDA-CSRF', '1').send({ email: input('direct').email, password })).status).toBe(403);
    expect((await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send({ ...input('invalid'), password })).status).toBe(400);
  });
  it('issues one numeric code, requires email verification, and protects pending corrections', async () => {
    const response = await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send(input('tracking'));
    expect(response.status).toBe(201); const receipt = response.body.data;
    expect(receipt.trackingCode).toMatch(/^\d{12}$/); expect(receipt).not.toHaveProperty('secret');
    expect(await prisma.user.findUnique({ where: { email: input('tracking').email } })).toBeNull();
    expect((await request(app).post('/api/membership/status').set('X-GDA-CSRF', '1').send({ trackingCode: receipt.trackingCode })).status).toBe(400);
    await expect(service.status(receipt.trackingCode, '0'.repeat(64))).rejects.toMatchObject({ statusCode: 404 });
    const verified = await proof(input('tracking').email, receipt.trackingCode);
    const status = await service.status(verified.trackingCode, verified.verificationToken);
    expect(status.status).toBe('PENDING'); expect(status).not.toHaveProperty('verificationInformation'); expect(status).not.toHaveProperty('email');
    await service.correct(verified.trackingCode, verified.verificationToken, { ...input('tracking'), fullName: 'Corrected Name' });
    const stored = await prisma.membershipApplication.findUniqueOrThrow({ where: { trackingCode: receipt.trackingCode } });
    expect(stored.fullName).toBe('Corrected Name'); expect(stored.trackingCode).toBe(receipt.trackingCode);
    await expect(service.apply(input('tracking'))).rejects.toMatchObject({ statusCode: 409 });
  });
  it('serializes duplicate concurrent submissions without new codes or duplicate records', async () => {
    const outcomes = await Promise.allSettled([service.apply(input('race')), service.apply(input('race'))]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.membershipApplication.count({ where: { email: input('race').email } })).toBe(1);
  });
  it('returns generic tracking requests, bounds OTP guesses and supports lost-code recovery', async () => {
    const receipt = await service.apply(input('otp'));
    const real = await tracking.request(input('otp').email, receipt.trackingCode);
    const missing = await tracking.request(input('missing').email, receipt.trackingCode);
    expect(real.message).toBe(missing.message); expect(real.challengeId).toMatch(/^[a-f0-9-]{36}$/);
    await vi.waitFor(async () => expect((await prisma.membershipTrackingChallenge.findUnique({ where: { id: real.challengeId } }))?.deliveredAt).toBeTruthy());
    const actual = otpFor(input('otp').email), wrong = actual === '111111' ? '222222' : '111111';
    for (let attempt = 0; attempt < 5; attempt++) await expect(tracking.verify(real.challengeId, wrong)).rejects.toMatchObject({ statusCode: 400 });
    await expect(tracking.verify(real.challengeId, actual)).rejects.toMatchObject({ statusCode: 400 });
    expect((await prisma.membershipTrackingChallenge.findUniqueOrThrow({ where: { id: real.challengeId } })).attempts).toBe(5);
    await prisma.membershipTrackingChallenge.update({ where: { id: real.challengeId }, data: { createdAt: new Date(0) } });
    const recovered = await proof(input('otp').email);
    expect(recovered.trackingCode).toBe(receipt.trackingCode);
    const challenge = await prisma.membershipTrackingChallenge.findUniqueOrThrow({ where: { proofHash: createHash('sha256').update(recovered.verificationToken).digest('hex') } });
    await expect(tracking.verify(challenge.id, otpFor(input('otp').email))).rejects.toMatchObject({ statusCode: 400 });
    await prisma.membershipTrackingChallenge.update({ where: { id: challenge.id }, data: { proofExpiresAt: new Date(0) } });
    await expect(service.status(recovered.trackingCode, recovered.verificationToken)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('keeps historical reference/secret receipts valid without exposing notes', async () => {
    const reference = 'GDA-' + 'A'.repeat(24), secret = 'b'.repeat(64);
    const application = await prisma.membershipApplication.create({ data: { ...input('legacy-receipt'), reference, trackingHash: createHash('sha256').update(secret).digest('hex') } });
    const rejected = await service.review(admin, application.id, 'REJECTED', 'Internal-only note', 'Please correct your year');
    const state = await service.status(reference, secret);
    expect(state.trackingCode).toMatch(/^\d{12}$/); expect(state.status).toBe('REJECTED'); expect(JSON.stringify(state)).not.toContain('Internal-only note');
    expect(rejected.application.id).toBe(application.id);
    const next = await service.apply(input('legacy-receipt')); expect(next.trackingCode).not.toBe(application.trackingCode);
  });
  it('approves by Admin only, emails the registered recipient, activates once and preserves the code', async () => {
    const receipt = await service.apply(input('activated'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { trackingCode: receipt.trackingCode } });
    for (const role of ['ALUMNI', 'SUPER_ADMIN', 'STUDENT'] as const) await expect(service.review({ userId: 'unused', role }, application.id, 'APPROVED')).rejects.toMatchObject({ statusCode: 403 });
    const response = await request(app).patch(`/api/membership/applications/${application.id}/review`).set('Cookie', adminCookie).set('X-GDA-CSRF', '1').send({ decision: 'APPROVED' });
    expect(response.status).toBe(200); const token = tokenFor(application.email);
    expect(response.body.data.application.activationDeliveryStatus).toBe('SENT');
    expect(JSON.stringify(response.body)).not.toContain(token); expect(response.body.data).not.toHaveProperty('developmentActivationLink');
    const detail = await request(app).get(`/api/membership/applications/${application.id}`).set('Cookie', adminCookie);
    expect(JSON.stringify(detail.body)).not.toContain(token); expect(detail.body.data).not.toHaveProperty('activationHash');
    const outcomes = await Promise.allSettled([service.activate(token, password), service.activate(token, password)]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const stored = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } });
    expect(stored.trackingCode).toBe(receipt.trackingCode); expect(stored.activationHash).toBeNull(); expect(stored.activatedAt).toBeInstanceOf(Date);
    expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: application.email, password })).status).toBe(200);
    await expect(service.activate(token, password)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects repeated approval, double-click resend, expired, revoked and superseded tokens', async () => {
    const receipt = await service.apply(input('expired'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { trackingCode: receipt.trackingCode } });
    await service.review(admin, application.id, 'APPROVED'); const first = tokenFor(application.email);
    await expect(service.review(admin, application.id, 'APPROVED')).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.reissue(admin, application.id)).rejects.toMatchObject({ statusCode: 409 });
    await prisma.membershipApplication.update({ where: { id: application.id }, data: { activationExpiresAt: new Date(0) } });
    await expect(service.activate(first, password)).rejects.toMatchObject({ statusCode: 400 });
    await allowResend(application.id); await service.reissue(admin, application.id); const second = tokenFor(application.email);
    expect(second).not.toBe(first); await expect(service.activate(first, password)).rejects.toMatchObject({ statusCode: 400 });
    await service.revoke(admin, application.id); await expect(service.activate(second, password)).rejects.toMatchObject({ statusCode: 400 });
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } })).trackingCode).toBe(receipt.trackingCode);
  });
});
