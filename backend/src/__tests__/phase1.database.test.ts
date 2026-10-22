import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, PostType, Role, RequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';

const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
// Never use DATABASE_URL as a test fallback. This suite writes only to an
// explicitly named, isolated local test database.
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') {
    throw new Error('PHASE1_TEST_DATABASE_URL must point to the isolated local gda_phase1_test database');
  }
  process.env.DATABASE_URL = databaseUrl;
}

describe.skipIf(!databaseUrl)('Phase 1 real PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let app: typeof import('../app.js').app;
  let repository: typeof import('../repositories/request.repository.js').requestRepository;
  let service: typeof import('../services/requests.service.js').requestsService;
  let adminId: string;
  let ownerId: string;
  const password = 'RegressionPassword123';
  const email = `phase1-${Date.now()}@example.com`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    ({ app } = await import('../app.js'));
    ({ requestRepository: repository } = await import('../repositories/request.repository.js'));
    ({ requestsService: service } = await import('../services/requests.service.js'));
    const owner = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 4) } });
    const admin = await prisma.user.create({ data: { email: `admin-${email}`, password: owner.password, role: Role.ADMIN } });
    await prisma.membershipApplication.create({ data: { reference: `fixture-${owner.id}`, trackingHash: 'fixture', email, fullName: 'Approved fixture', phone: '123456789', graduationYear: 2001, status: 'APPROVED', userId: owner.id, activatedAt: new Date() } });
    ownerId = owner.id;
    adminId = admin.id;
  });
  afterAll(async () => {
    if (ownerId) {
      await prisma.request.deleteMany({ where: { requestedBy: ownerId } });
      await prisma.post.deleteMany({ where: { createdBy: ownerId } });
      await prisma.membershipApplication.deleteMany({ where: { userId: ownerId } });
      await prisma.user.deleteMany({ where: { id: { in: [ownerId, adminId] } } });
    }
    await prisma?.$disconnect();
    const { prisma: applicationPrisma } = await import('../config/prisma.js');
    await applicationPrisma.$disconnect();
  });

  it('logs in through the real service and rejects disabled accounts on the next request', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email, password })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.data.email).toBe(email);
    await prisma.user.update({ where: { id: ownerId }, data: { isActive: false } });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    await prisma.user.update({ where: { id: ownerId }, data: { isActive: true } });
  });

  it('does not expose author emails in any public content list', async () => {
    for (const [type, endpoint] of [[PostType.ANNOUNCEMENT, '/api/posts/announcements'], [PostType.STORY, '/api/stories'], [PostType.EVENT, '/api/events']] as const) {
      await prisma.post.create({ data: { type, title: 'Public record', content: 'Safe public content', createdBy: ownerId, isPublished: true, ...(type === PostType.EVENT ? { eventDate: new Date(Date.now() + 86400000) } : {}) } });
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      for (const post of response.body.data) {
        expect(post.user).not.toHaveProperty('email');
        expect(post.user).not.toHaveProperty('role');
      }
    }
  });

  it('allows exactly one competing status write and preserves completion timestamps', async () => {
    const record = await prisma.request.create({ data: { requestType: 'TRANSCRIPT', purpose: 'University', fullNameAtGraduation: 'Test Alumnus', contactPhone: '123456789', requestedBy: ownerId, status: RequestStatus.IN_REVIEW } });
    const outcomes = await Promise.all([
      repository.updateIfCurrent(record.id, 0, RequestStatus.IN_REVIEW, { status: RequestStatus.APPROVED }),
      repository.updateIfCurrent(record.id, 0, RequestStatus.IN_REVIEW, { status: RequestStatus.REJECTED }),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const current = await prisma.request.findUniqueOrThrow({ where: { id: record.id } });
    expect(current.version).toBe(1);
    expect(await repository.deleteIfCurrent(record.id, 0, RequestStatus.IN_REVIEW, ownerId)).toEqual({ count: 0 });
    const admin = { userId: adminId, role: Role.ADMIN };
    if (current.status === RequestStatus.REJECTED) {
      await service.updateStatus(admin, record.id, RequestStatus.IN_REVIEW);
      await service.updateStatus(admin, record.id, RequestStatus.APPROVED);
    }
    await service.updateStatus(admin, record.id, RequestStatus.READY_FOR_PICKUP);
    await service.updateStatus(admin, record.id, RequestStatus.COMPLETED);
    const completed = await prisma.request.findUniqueOrThrow({ where: { id: record.id } });
    expect(completed.completedAt).toBeInstanceOf(Date);
    await expect(service.updateStatus(admin, record.id, RequestStatus.IN_REVIEW)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.delete({ userId: ownerId, role: Role.ALUMNI }, record.id)).rejects.toMatchObject({ statusCode: 400 });
  });
});
