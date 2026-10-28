import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';
// Any accidental SMTP call fails instead of contacting a real provider.
vi.mock('nodemailer', () => ({ default: { createTransport: () => { throw new Error('Unexpected SMTP call in Brevo test'); } } }));
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test');
  process.env.DATABASE_URL = databaseUrl;
}
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

describe.skipIf(!databaseUrl)('Brevo with real membership and authentication transactions', () => {
  let db: PrismaClient, app: typeof import('../app').app, env: typeof import('../config/env').env;
  let previous: typeof env, settings: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  let membership: typeof import('../services/membership.service').membershipService;
  let accounts: typeof import('../services/account.service').accountService;
  let platform: typeof import('../services/platform.service').platformService;
  let recovery: typeof import('../services/password-reset.service').passwordResetService;
  let admin: { userId: string; role: 'ADMIN' }, superAdmin: { userId: string; role: 'SUPER_ADMIN' }, member: { userId: string; role: 'ALUMNI' };
  const suffix = `@brevo-workflow-${Date.now()}.example`, password = 'BrevoWorkflow123!';
  const messages: { to: { email: string }[]; subject: string; textContent: string; headers: { idempotencyKey: string } }[] = [];
  const fetchMock = vi.fn<typeof fetch>();
  const tokenFrom = (fragment: string) => {
    const message = [...messages].reverse().find(message => message.textContent.includes(fragment));
    const token = message?.textContent.match(/#token=([a-f0-9]{64})/)?.[1];
    expect(token).toBeDefined(); return token!;
  };
  const input = (name: string) => ({ fullName: 'Brevo Fixture', email: name + suffix, phone: '123456789', graduationYear: 2005 });
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: databaseUrl });
    ({ env } = await import('../config/env.js')); previous = { ...env };
    ({ app } = await import('../app.js'));
    ({ membershipService: membership } = await import('../services/membership.service.js'));
    ({ accountService: accounts } = await import('../services/account.service.js'));
    ({ platformService: platform } = await import('../services/platform.service.js'));
    ({ passwordResetService: recovery } = await import('../services/password-reset.service.js'));
    settings = await db.platformSettings.findUnique({ where: { id: 1 } });
    const hash = await bcrypt.hash(password, 4);
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI'] as const) {
      const email = role.toLowerCase() + suffix;
      const user = await db.user.create({ data: { email, role, password: hash,
        ...(role === 'ALUMNI' ? { membershipApplication: { create: { ...input('alumni'), reference: `brevo-${Date.now()}`, trackingHash: 'fixture', status: 'APPROVED', activatedAt: new Date() } } } : {}) } });
      if (role === 'ADMIN') admin = { userId: user.id, role };
      else if (role === 'SUPER_ADMIN') superAdmin = { userId: user.id, role };
      else member = { userId: user.id, role };
    }
  });
  beforeEach(async () => {
    Object.assign(env, { EMAIL_PROVIDER: 'brevo', ACTIVATION_DELIVERY: 'development', BREVO_API_KEY: 'mock-api-key',
      BREVO_SENDER_EMAIL: 'registrar@example.test', BREVO_SENDER_NAME: 'Registrar', NODE_ENV: 'test' });
    await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true }, update: { emailEnabled: true } });
    messages.length = 0;
    fetchMock.mockReset().mockImplementation(async (_url, init) => {
      messages.push(JSON.parse(init!.body as string));
      return new Response(JSON.stringify({ messageId: '<mocked@brevo>' }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    if (env && previous) Object.assign(env, { EMAIL_PROVIDER: undefined, BREVO_API_KEY: undefined, BREVO_SENDER_EMAIL: undefined, BREVO_SENDER_NAME: undefined }, previous);
    if (!db) return;
    const users = await db.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    const ids = users.map(user => user.id);
    await db.auditRecord.deleteMany({ where: { actorId: { in: ids } } });
    await db.accountToken.deleteMany({ where: { OR: [{ userId: { in: ids } }, { targetEmail: { endsWith: suffix } }] } });
    const applications = await db.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await db.membershipReview.deleteMany({ where: { applicationId: { in: applications.map(application => application.id) } } });
    await db.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    if (settings) await db.platformSettings.update({ where: { id: 1 }, data: settings });
    else await db.platformSettings.deleteMany({ where: { id: 1 } });
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });

  it('sends approval once, keeps hashes private, and activates only once', async () => {
    const receipt = await membership.apply(input('approved'));
    expect(fetchMock).not.toHaveBeenCalled(); // Application confirmation email does not exist.
    const application = await db.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    await expect(membership.review(member, application.id, 'APPROVED')).rejects.toMatchObject({ statusCode: 403 });
    const result = await membership.review(admin, application.id, 'APPROVED');
    expect(result.application).toMatchObject({ status: 'APPROVED', activationDeliveryStatus: 'SENT' });
    const token = tokenFrom('/activate#token=');
    expect(JSON.stringify(result)).not.toContain(token);
    expect((await db.membershipApplication.findUniqueOrThrow({ where: { id: application.id } })).activationHash).not.toBe(token);
    await expect(membership.review(admin, application.id, 'APPROVED')).rejects.toMatchObject({ statusCode: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await membership.activate(token, password);
    await expect(membership.activate(token, password)).rejects.toMatchObject({ statusCode: 400 });
    const login = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: input('approved').email, password });
    expect(login.status).toBe(200); expect(login.body.data.role).toBe('ALUMNI');
  });

  it('preserves approval on API failure and reissues a new single-use invitation', async () => {
    const receipt = await membership.apply(input('failed'));
    const application = await db.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    fetchMock.mockImplementationOnce(async (_url, init) => {
      messages.push(JSON.parse(init!.body as string));
      return new Response('{"message":"private provider failure"}', { status: 401 });
    });
    const failed = await membership.review(admin, application.id, 'APPROVED');
    const oldToken = tokenFrom('/activate#token=');
    expect(failed.application).toMatchObject({ status: 'APPROVED', activationDeliveryStatus: 'FAILED' });
    expect(JSON.stringify(failed)).not.toContain('private provider failure');
    const retry = await membership.reissue(admin, application.id);
    expect(retry.delivery.status).toBe('sent');
    const newToken = tokenFrom('/activate#token=');
    expect(newToken).not.toBe(oldToken);
    expect(messages[0]!.headers.idempotencyKey).not.toBe(messages[1]!.headers.idempotencyKey);
    await expect(membership.activate(oldToken, password)).rejects.toMatchObject({ statusCode: 400 });
    await membership.activate(newToken, password);
  });

  it('delivers Admin invitations through Brevo without changing role restrictions', async () => {
    await expect(platform.invite(member, 'Blocked', 'blocked' + suffix, password)).rejects.toMatchObject({ statusCode: 403 });
    await platform.invite(superAdmin, 'Invited Admin', 'invited' + suffix, password);
    const token = tokenFrom('/admin-activate#token=');
    await platform.activate(token, password);
    await expect(platform.activate(token, password)).rejects.toMatchObject({ statusCode: 400 });
    expect((await db.user.findUniqueOrThrow({ where: { email: 'invited' + suffix } })).role).toBe('ADMIN');
  });

  it('recovers passwords through Brevo and invalidates used tokens and old sessions', async () => {
    const email = 'admin' + suffix;
    const { signToken } = await import('../utils/jwt.js');
    const cookie = `gray_d_allison_token=${signToken(admin)}`;
    await recovery.request(email);
    await vi.waitFor(async () => expect(await db.accountToken.count({ where: { userId: admin.userId, purpose: 'PASSWORD_RESET', deliveredAt: { not: null } } })).toBe(1));
    const token = tokenFrom('/reset-password#token=');
    await recovery.reset(token, 'RecoveredBrevo123!');
    await expect(recovery.reset(token, 'AnotherBrevo123!')).rejects.toMatchObject({ statusCode: 400 });
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email, password: 'RecoveredBrevo123!' })).status).toBe(200);
    await vi.waitFor(() => expect(messages.some(message => message.subject === 'Your portal password was reset')).toBe(true));
  });

  it('removes undelivered reset tokens and preserves the current password', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"private failure"}', { status: 500 }));
    await recovery.request('super_admin' + suffix);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect(await db.accountToken.count({ where: { userId: superAdmin.userId, purpose: 'PASSWORD_RESET' } })).toBe(0));
    expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: 'super_admin' + suffix, password })).status).toBe(200);
  });

  it('preserves the current email on delivery failure, then verifies once and ends the old session', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"private failure"}', { status: 403 }));
    await expect(accounts.requestEmail(member, 'changed' + suffix, password)).rejects.toMatchObject({ statusCode: 503 });
    expect((await db.user.findUniqueOrThrow({ where: { id: member.userId } })).email).toBe('alumni' + suffix);
    expect(await db.accountToken.count({ where: { userId: member.userId, purpose: 'EMAIL_CHANGE' } })).toBe(0);
    await accounts.requestEmail(member, 'changed' + suffix, password);
    const token = tokenFrom('/verify-email#token=');
    await accounts.verifyEmail(token);
    await expect(accounts.verifyEmail(token)).rejects.toMatchObject({ statusCode: 400 });
    const changed = await db.user.findUniqueOrThrow({ where: { id: member.userId } });
    expect(changed).toMatchObject({ email: 'changed' + suffix, sessionVersion: 1 });
  });
});
