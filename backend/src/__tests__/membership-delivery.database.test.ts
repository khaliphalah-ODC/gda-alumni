import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mail.sendMail }) } }));
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local test database'); process.env.DATABASE_URL = databaseUrl; }
describe.skipIf(!databaseUrl)('Invitation delivery and persistent membership outcomes', () => {
  let prisma: PrismaClient, service: typeof import('../services/membership.service.js').membershipService, config: typeof import('../config/env.js').env, previous: typeof config;
  let admin: { userId: string; role: 'ADMIN' };
  const suffix = `@mail-test-${Date.now()}.example`;
  const input = (name: string) => ({ fullName: 'Mail Applicant', email: name + suffix, phone: '123456789', graduationYear: 2005 });
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl }); ({ membershipService: service } = await import('../services/membership.service.js')); ({ env: config } = await import('../config/env.js')); previous = { ...config };
    await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true }, update: { emailEnabled: true } });
    admin = { userId: (await prisma.user.create({ data: { email: 'admin' + suffix, password: 'unused', role: 'ADMIN' } })).id, role: 'ADMIN' };
  });
  afterEach(() => { Object.assign(config, previous); vi.clearAllMocks(); });
  afterAll(async () => {
    const apps = await prisma.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } }); await prisma.membershipReview.deleteMany({ where: { applicationId: { in: apps.map((app) => app.id) } } }); await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.platformSettings.deleteMany({ where: { id: 1 } }); await prisma.$disconnect(); const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  it('sends a production invitation without exposing it in the API and activates its hashed token', async () => {
    Object.assign(config, { NODE_ENV: 'production', ACTIVATION_DELIVERY: 'smtp', FRONTEND_ORIGIN: 'https://school.example', SMTP_HOST: 'smtp.example', SMTP_FROM: 'registrar@school.example' });
    mail.sendMail.mockResolvedValue({ accepted: [input('sent').email], rejected: [] });
    const receipt = await service.apply(input('sent')); const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    const result = await service.review(admin, application.id, 'APPROVED'); expect(result).not.toHaveProperty('developmentActivationLink'); expect(result.delivery?.status).toBe('sent'); expect(result.application.activationDeliveryStatus).toBe('SENT');
    const text = mail.sendMail.mock.calls[0]![0].text as string; const token = /#token=([a-f0-9]{64})/.exec(text)![1]!;
    expect(JSON.stringify(result)).not.toContain(token); expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } })).activationHash).not.toBe(token);
    await service.activate(token, 'ProductionPathPassword123'); expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } })).activatedAt).toBeTruthy();
  });
  it('retains the approved decision after delivery failure and recovers through reissue', async () => {
    Object.assign(config, { NODE_ENV: 'production', ACTIVATION_DELIVERY: 'smtp' }); mail.sendMail.mockRejectedValue(new Error('private provider failure'));
    const receipt = await service.apply(input('retry')); const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { reference: receipt.reference } });
    const failed = await service.review(admin, application.id, 'APPROVED'); expect(failed.delivery?.status).toBe('failed'); expect(failed.application.status).toBe('APPROVED'); expect(failed.application.activationDeliveryStatus).toBe('FAILED');
    mail.sendMail.mockResolvedValue({ accepted: [input('retry').email], rejected: [] }); const reissued = await service.reissue(admin, application.id); expect(reissued.delivery.status).toBe('sent');
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } })).activationDeliveryStatus).toBe('SENT');
  });
});
