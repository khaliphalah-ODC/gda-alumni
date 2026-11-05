import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
const url = process.env.PHASE1_TEST_DATABASE_URL;
if (url) { const parsed = new URL(url); if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/gda_phase1_test') throw new Error('Use isolated local database'); process.env.DATABASE_URL = url; }
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
describe.skipIf(!url)('Durable invitation outbox', () => {
  let db: PrismaClient, service: typeof import('../services/membership.service').membershipService;
  let worker: typeof import('../services/membership-invitation.service').membershipInvitationService;
  let env: typeof import('../config/env').env, previous: typeof env;
  let admin: { userId: string; role: 'ADMIN' };
  let settings: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  const suffix = `@outbox-${Date.now()}.example`, fetchMock = vi.fn<typeof fetch>();
  const input = (name: string) => ({ fullName: '<script>Unsafe & Name</script>', email: name + suffix, phone: '123456789', graduationYear: 2005 });
  async function pending(name: string) { const receipt = await service.apply(input(name)); return db.membershipApplication.findUniqueOrThrow({ where: { trackingCode: receipt.trackingCode } }); }
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url }); ({ env } = await import('../config/env.js')); previous = { ...env };
    Object.assign(env, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'mock', BREVO_SENDER_EMAIL: 'sender@example.test', BREVO_SENDER_NAME: 'School', FRONTEND_ORIGIN: 'https://school.example' });
    ({ membershipService: service } = await import('../services/membership.service.js')); ({ membershipInvitationService: worker } = await import('../services/membership-invitation.service.js'));
    settings = await db.platformSettings.findUnique({ where: { id: 1 } });
    await db.platformSettings.upsert({ where: { id: 1 }, create: { emailEnabled: true }, update: { emailEnabled: true } });
    admin = { userId: (await db.user.create({ data: { email: 'admin' + suffix, role: 'ADMIN', password: 'unused' } })).id, role: 'ADMIN' };
  });
  beforeEach(() => { fetchMock.mockReset().mockImplementation(async () => new Response('{"messageId":"mock"}', { status: 201 })); vi.stubGlobal('fetch', fetchMock); });
  afterAll(async () => {
    vi.unstubAllGlobals(); Object.assign(env, previous);
    const apps = await db.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await db.membershipReview.deleteMany({ where: { applicationId: { in: apps.map(a => a.id) } } }); await db.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } }); await db.user.deleteMany({ where: { email: { endsWith: suffix } } });
    if (settings) await db.platformSettings.update({ where: { id: 1 }, data: settings }); else await db.platformSettings.deleteMany({ where: { id: 1 } });
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });
  it('commits approval and the job together, resumes after interrupted dispatch and claims only once', async () => {
    const app = await pending('resume');
    const interrupted = vi.spyOn(worker, 'process').mockRejectedValueOnce(new Error('simulated request interruption'));
    const result = await service.review(admin, app.id, 'APPROVED'); interrupted.mockRestore();
    expect(result.application.activationDeliveryStatus).toBe('QUEUED'); expect(result.application.status).toBe('APPROVED');
    const job = await db.membershipInvitation.findFirstOrThrow({ where: { applicationId: app.id } });
    await Promise.all([worker.process(job.id), worker.process(job.id)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string), token = payload.textContent.match(/#token=([a-f0-9]{64})/)[1];
    expect(payload.to).toEqual([{ email: app.email }]); expect(payload.htmlContent).toContain('&lt;script&gt;'); expect(payload.htmlContent).not.toContain('<script>');
    expect(payload.textContent).toContain('https://school.example/activate#token='); expect(payload.textContent).toContain(job.expiresAt.toUTCString());
    const stored = await db.membershipInvitation.findUniqueOrThrow({ where: { id: job.id } }); expect(stored.status).toBe('SENT'); expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(await service.detail(admin, app.id))).not.toContain(token);
    await expect(service.review(admin, app.id, 'APPROVED')).rejects.toMatchObject({ statusCode: 409 }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('retries a definite rate-limit rejection with the same event and token', async () => {
    const app = await pending('retry'); fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    const failed = await service.review(admin, app.id, 'APPROVED'); expect(failed.application).toMatchObject({ status: 'APPROVED', activationDeliveryStatus: 'FAILED', activationDeliveryError: 'PROVIDER_RATE_LIMIT' });
    const job = await db.membershipInvitation.findFirstOrThrow({ where: { applicationId: app.id } });
    await worker.process(job.id); expect(fetchMock).toHaveBeenCalledTimes(1); // Backoff is enforced.
    await db.membershipInvitation.update({ where: { id: job.id }, data: { availableAt: new Date(0) } }); await worker.process(job.id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![1]!.body).toBe(fetchMock.mock.calls[1]![1]!.body);
    expect((await db.membershipApplication.findUniqueOrThrow({ where: { id: app.id } })).trackingCode).toBe(app.trackingCode);
  });
  it('does not automatically resend an ambiguous timeout or interrupted leased send', async () => {
    const app = await pending('unknown'); fetchMock.mockRejectedValueOnce(new DOMException('private', 'TimeoutError'));
    const result = await service.review(admin, app.id, 'APPROVED'); expect(result.application.activationDeliveryStatus).toBe('UNKNOWN');
    const job = await db.membershipInvitation.findFirstOrThrow({ where: { applicationId: app.id } }); await worker.process(job.id); expect(fetchMock).toHaveBeenCalledTimes(1);
    await db.membershipInvitation.update({ where: { id: job.id }, data: { status: 'SENDING', leaseId: 'interrupted', leasedAt: new Date(0) } });
    await worker.recoverStale(); expect((await db.membershipInvitation.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('UNKNOWN'); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('records disabled email accurately and preserves approval', async () => {
    const app = await pending('disabled'); await db.platformSettings.update({ where: { id: 1 }, data: { emailEnabled: false } });
    try { const result = await service.review(admin, app.id, 'APPROVED'); expect(result.application).toMatchObject({ status: 'APPROVED', activationDeliveryStatus: 'FAILED', activationDeliveryError: 'EMAIL_DISABLED' }); expect(fetchMock).not.toHaveBeenCalled(); }
    finally { await db.platformSettings.update({ where: { id: 1 }, data: { emailEnabled: true } }); }
  });
  it('reissues an expired queued invitation once under concurrent resend requests', async () => {
    const app = await pending('expired-queue');
    const interrupted = vi.spyOn(worker, 'process').mockRejectedValueOnce(new Error('interrupted'));
    await service.review(admin, app.id, 'APPROVED'); interrupted.mockRestore();
    await db.membershipInvitation.updateMany({ where: { applicationId: app.id }, data: { expiresAt: new Date(0), createdAt: new Date(0) } });
    const results = await Promise.allSettled([service.reissue(admin, app.id), service.reissue(admin, app.id)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.membershipInvitation.count({ where: { applicationId: app.id } })).toBe(2);
    expect((await db.membershipApplication.findUniqueOrThrow({ where: { id: app.id } })).trackingCode).toBe(app.trackingCode);
  });
});
