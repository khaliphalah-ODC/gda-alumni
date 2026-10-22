import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcrypt';
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use the isolated local gda_phase1_test database');
  process.env.DATABASE_URL = databaseUrl;
}
describe.skipIf(!databaseUrl)('Membership real database and HTTP workflow', () => {
  let prisma: PrismaClient;
  let app: typeof import('../app.js').app;
  let service: typeof import('../services/membership.service.js').membershipService;
  let signToken: typeof import('../utils/jwt.js').signToken;
  let admin: { userId: string; role: 'ADMIN' };
  let adminCookie: string;
  const suffix = `@membership-${Date.now()}.example`;
  const input = (name: string) => ({ email: name + suffix, fullName: 'Approved Alumnus', phone: '123456789', graduationYear: 2004, location: 'Monrovia', verificationInformation: 'Private verification' });
  const password = 'MembershipPassword123';
  const tokenFrom = (link?: string) => new URLSearchParams(new URL(link!).hash.slice(1)).get('token')!;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    ({ app } = await import('../app.js'));
    ({ membershipService: service } = await import('../services/membership.service.js'));
    ({ signToken } = await import('../utils/jwt.js'));
    const account = await prisma.user.create({ data: { email: 'admin' + suffix, password: await bcrypt.hash(password, 4), role: 'ADMIN' } });
    admin = { userId: account.id, role: 'ADMIN' };
    adminCookie = `gray_d_allison_token=${signToken(admin)}`;
  });
  afterAll(async () => {
    if (prisma) {
      const apps = await prisma.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
      await prisma.membershipReview.deleteMany({ where: { applicationId: { in: apps.map((row) => row.id) } } });
      await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
      await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } });
      await prisma.$disconnect();
      const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
    }
  });
  it('rejects direct registration and invalid application payloads', async () => {
    const response = await request(app).post('/api/auth/register').set('X-GDA-CSRF', '1').send({ email: 'direct' + suffix, password });
    expect(response.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email: 'direct' + suffix } })).toBeNull();
    expect((await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send({ ...input('invalid'), password })).status).toBe(400);
  });
  it('submits without an account, securely tracks and corrects a pending application', async () => {
    const response = await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send(input('tracking'));
    expect(response.status).toBe(201); expect(response.headers['set-cookie']).toBeUndefined();
    const receipt = response.body.data;
    expect(await prisma.user.findUnique({ where: { email: input('tracking').email } })).toBeNull();
    const stored = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    expect(stored.trackingHash).not.toBe(receipt.secret);
    expect(stored).not.toHaveProperty('password');
    expect((await request(app).post('/api/membership/status').set('X-GDA-CSRF', '1').send({ reference: receipt.reference, secret: '0'.repeat(64) })).status).toBe(404);
    const status = await service.status(receipt.reference, receipt.secret);
    expect(status.status).toBe('PENDING'); expect(status).not.toHaveProperty('verificationInformation');
    await service.correct(receipt.reference, receipt.secret, { ...input('tracking'), fullName: 'Corrected Name' });
    const updated = await service.detail(admin, stored.id);
    expect(updated.fullName).toBe('Corrected Name'); expect(updated.history.map((row) => row.action)).toEqual(['SUBMITTED', 'CORRECTED']);
    expect((await request(app).post('/api/membership/applications').set('X-GDA-CSRF', '1').send(input('tracking'))).status).toBe(409);
  });
  it('serializes duplicate concurrent applications at the database boundary', async () => {
    const results = await Promise.allSettled([service.apply(input('racing')), service.apply(input('racing'))]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.membershipApplication.count({ where: { email: input('racing').email } })).toBe(1);
  });
  it('requires administrator permission and records rejection/history before allowing reapplication', async () => {
    const receipt = await service.apply(input('rejected'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    expect((await request(app).patch(`/api/membership/applications/${application.id}/review`).set('X-GDA-CSRF', '1').send({ decision: 'APPROVED' })).status).toBe(401);
    const reject = await request(app).patch(`/api/membership/applications/${application.id}/review`).set('Cookie', adminCookie).set('X-GDA-CSRF', '1').send({ decision: 'REJECTED', rejectionReason: 'Please correct your year', notes: 'Internal registrar note' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.application.reviewedBy).toBe(admin.userId);
    expect(reject.body.data.application.reviewedAt).toBeTruthy();
    const state = await service.status(receipt.reference, receipt.secret);
    expect(state.rejectionReason).toBe('Please correct your year');
    expect(JSON.stringify(state)).not.toContain('Internal registrar note');
    const second = await service.apply(input('rejected')); expect(second.reference).not.toBe(receipt.reference);
    await expect(service.correct(receipt.reference, receipt.secret, input('rejected'))).rejects.toMatchObject({ statusCode: 409 });
  });
  it('approves, activates once atomically, creates a profile and permits real login', async () => {
    const receipt = await service.apply(input('activated'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    const review = await request(app).patch(`/api/membership/applications/${application.id}/review`).set('Cookie', adminCookie).set('X-GDA-CSRF', '1').send({ decision: 'APPROVED', notes: 'School records checked' });
    expect(review.status).toBe(200);
    expect(review.body.data.application.activatedAt).toBeNull();
    expect(await prisma.user.findUnique({ where: { email: input('activated').email } })).toBeNull();
    expect(review.body.data.application).not.toHaveProperty('activationHash');
    const token = tokenFrom(review.body.data.developmentActivationLink);
    const before = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } }); expect(before.activationHash).not.toBe(token);
    const outcomes = await Promise.allSettled([service.activate(token, password), service.activate(token, password)]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const account = await prisma.user.findUniqueOrThrow({ where: { email: input('activated').email }, include: { alumniProfile: true, membershipApplication: true } });
    expect(account.alumniProfile?.fullName).toBe(input('activated').fullName);
    expect(account.membershipApplication?.activationHash).toBeNull();
    expect(account.membershipApplication?.activationConsumedAt).toBeInstanceOf(Date);
    expect(account.membershipApplication?.activatedAt).toBeInstanceOf(Date);
    const login = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: account.email, password });
    expect(login.status).toBe(200); expect(login.body.data).not.toHaveProperty('password');
    const cookie = `gray_d_allison_token=${signToken({ userId: account.id, role: 'ALUMNI' })}`;
    expect((await request(app).get('/api/membership/applications').set('Cookie', cookie)).status).toBe(403);
    await expect(service.activate(token, password)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.correct(receipt.reference, receipt.secret, input('activated'))).rejects.toMatchObject({ statusCode: 409 });
  });
  it('rejects invalid, expired, revoked and superseded invitations', async () => {
    await expect(service.activate('0'.repeat(64), password)).rejects.toMatchObject({ statusCode: 400 });
    const receipt = await service.apply(input('expired'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    const review = await service.review(admin, application.id, 'APPROVED');
    const first = tokenFrom(review.developmentActivationLink);
    await prisma.membershipApplication.update({ where: { id: application.id }, data: { activationExpiresAt: new Date(0) } });
    await expect(service.activate(first, password)).rejects.toMatchObject({ statusCode: 400 });
    const second = tokenFrom((await service.reissue(admin, application.id)).developmentActivationLink);
    await expect(service.activate(first, password)).rejects.toMatchObject({ statusCode: 400 });
    await service.revoke(admin, application.id);
    await expect(service.activate(second, password)).rejects.toMatchObject({ statusCode: 400 });
    expect(await prisma.user.findUnique({ where: { email: input('expired').email } })).toBeNull();
  });
  it('preserves a legacy account while requiring approval and activation', async () => {
    const legacy = await prisma.user.create({ data: { email: input('legacy').email, password: await bcrypt.hash(password, 4), alumniProfile: { create: { fullName: 'Existing profile', occupation: 'Teacher' } } } });
    expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: legacy.email, password })).status).toBe(403);
    const receipt = await service.apply(input('legacy'));
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    const review = await service.review(admin, application.id, 'APPROVED');
    await service.activate(tokenFrom(review.developmentActivationLink), password);
    const current = await prisma.user.findUniqueOrThrow({ where: { email: legacy.email }, include: { alumniProfile: true, membershipApplication: true } });
    expect(current.id).toBe(legacy.id); expect(current.alumniProfile?.occupation).toBe('Teacher');
    expect(current.membershipApplication?.fullName).toBe('Approved Alumnus');
  });
});
