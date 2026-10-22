import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test');
  process.env.DATABASE_URL = databaseUrl;
}
const cases = [
  { endpoint: '/api/history', type: 'HISTORY', extra: { milestoneDate: '1980' } },
  { endpoint: '/api/leadership/school', type: 'SCHOOL_LEADER', extra: { position: 'Principal' } },
  { endpoint: '/api/leadership/alumni', type: 'ALUMNI_LEADER', extra: { position: 'Alumni President' } },
] as const;

describe.skipIf(!databaseUrl)('History and both leadership groups with real PostgreSQL', () => {
  let db: PrismaClient, app: typeof import('../app.js').app, adminId: string;
  const cookies: Record<string, string> = {};
  const suffix = `@about-content-${Date.now()}.example`;
  const csrf = { 'X-GDA-CSRF': '1' };
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js'));
    const { signToken } = await import('../utils/jwt.js');
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI'] as const) {
      const user = await db.user.create({ data: {
        email: role + suffix, password: 'unused', role,
        ...(role === 'ALUMNI' ? { membershipApplication: { create: { email: role + suffix, reference: role + suffix, trackingHash: 'fixture', fullName: 'Test Alumnus', phone: '123456789', graduationYear: 2000, status: 'APPROVED', activatedAt: new Date() } } } : {}),
      } });
      if (role === 'ADMIN') adminId = user.id;
      cookies[role] = `gray_d_allison_token=${signToken({ userId: user.id, role })}`;
    }
  });
  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await db.post.deleteMany({ where: { createdBy: { in: users.map(user => user.id) } } });
    await db.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await db.user.deleteMany({ where: { email: { endsWith: suffix } } });
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });

  it('sorts public timeline pages by verified date while preserving default display order', async () => {
    const title = `Chronology ${Date.now()}`;
    for (const [milestoneDate, displayOrder] of [['2005', 0], ['1980-06-01', 8], ['1980', 9]] as const) {
      await db.post.create({ data: { type: 'HISTORY', title, content: 'Verified chronology fixture.', milestoneDate, displayOrder, isPublished: true, createdBy: adminId } });
    }
    const query = `?scope=public&search=${encodeURIComponent(title)}&limit=2`;
    const display = await request(app).get('/api/history' + query);
    expect(display.body.data.map((record: { milestoneDate: string }) => record.milestoneDate)).toEqual(['2005', '1980-06-01']);
    const chronology = await request(app).get('/api/history' + query + '&historyOrder=chronological');
    expect(chronology.body.data.map((record: { milestoneDate: string }) => record.milestoneDate)).toEqual(['1980', '1980-06-01']);
    const next = await request(app).get('/api/history' + query + '&historyOrder=chronological&page=2');
    expect(next.body.data[0].milestoneDate).toBe('2005');
    await db.post.deleteMany({ where: { createdBy: adminId, title } });
  });

  it.each(cases)('supports drafts, review, ordering, images and stale-write protection at $endpoint', async ({ endpoint, type, extra }) => {
    const body = { title: `Verified ${type}`, content: 'Verified school information.', image: 'https://example.test/photo.jpg', displayOrder: 8, ...extra };
    const created = await request(app).post(endpoint).set('Cookie', cookies.ADMIN!).set(csrf).send(body);
    expect(created.status).toBe(201); let record = created.body.data;
    expect(record.type).toBe(type); expect(record.isPublished).toBe(false); expect(record.image).toBe(body.image);
    expect((await request(app).get(`${endpoint}/${record.id}`)).status).toBe(404);
    const query = `?search=${encodeURIComponent(body.title)}`;
    expect((await request(app).get(endpoint + query)).body.data).toHaveLength(0);
    expect((await request(app).get(endpoint + query).set('Cookie', cookies.ADMIN!)).body.data).toHaveLength(0);
    expect((await request(app).get(endpoint + query + '&scope=manage').set('Cookie', cookies.ADMIN!)).body.data).toHaveLength(1);
    expect((await request(app).patch(`${endpoint}/${record.id}/publish`).set('Cookie', cookies.ADMIN!).set(csrf).send({})).status).toBe(400);
    const publish = await request(app).patch(`${endpoint}/${record.id}/publish`).set('Cookie', cookies.ADMIN!).set(csrf).send({ version: record.version });
    expect(publish.status).toBe(200); record = publish.body.data; expect(record.publishedAt).toBeTruthy();
    expect((await request(app).get(endpoint + query)).body.data.map((item: { id: string }) => item.id)).toEqual([record.id]);
    const detail = await request(app).get(`${endpoint}/${record.id}`); expect(detail.status).toBe(200); expect(detail.body.data.user).not.toHaveProperty('email');
    const oldVersion = record.version;
    const edited = await request(app).patch(`${endpoint}/${record.id}`).set('Cookie', cookies.ADMIN!).set(csrf).send({ ...body, displayOrder: 1, version: oldVersion, image: null });
    expect(edited.status).toBe(200); record = edited.body.data;
    expect(record.isPublished).toBe(false); expect(record.publishedAt).toBeNull(); expect(record.displayOrder).toBe(1); expect(record.image).toBeNull();
    expect((await request(app).get(`${endpoint}/${record.id}`)).status).toBe(404);
    expect((await request(app).patch(`${endpoint}/${record.id}/publish`).set('Cookie', cookies.ADMIN!).set(csrf).send({ version: oldVersion })).status).toBe(409);
    expect((await request(app).patch(`${endpoint}/${record.id}`).set('Cookie', cookies.ADMIN!).set(csrf).send({ ...body, version: oldVersion })).status).toBe(409);
    const republished = await request(app).patch(`${endpoint}/${record.id}/publish`).set('Cookie', cookies.ADMIN!).set(csrf).send({ version: record.version }); record = republished.body.data;
    const unpublished = await request(app).patch(`${endpoint}/${record.id}/unpublish`).set('Cookie', cookies.ADMIN!).set(csrf).send({ version: record.version });
    expect(unpublished.status).toBe(200); record = unpublished.body.data;
    expect((await request(app).get(`${endpoint}/${record.id}`)).status).toBe(404);
    expect((await request(app).delete(`${endpoint}/${record.id}`).set('Cookie', cookies.ADMIN!).set(csrf)).status).toBe(400);
    expect((await request(app).delete(`${endpoint}/${record.id}?version=${oldVersion}`).set('Cookie', cookies.ADMIN!).set(csrf)).status).toBe(409);
    expect((await request(app).delete(`${endpoint}/${record.id}?version=${record.version}`).set('Cookie', cookies.ADMIN!).set(csrf)).status).toBe(200);
    expect(await db.post.findUnique({ where: { id: record.id } })).toBeNull();
  });

  it.each(cases)('keeps $endpoint management exclusive to Admin accounts', async ({ endpoint, type, extra }) => {
    const body = { title: 'Restricted draft', content: 'Private test content', displayOrder: 0, ...extra };
    const record = await db.post.create({ data: { ...body, type, createdBy: adminId } });
    for (const role of ['SUPER_ADMIN', 'ALUMNI', 'ANONYMOUS']) {
      const expected = role === 'ANONYMOUS' ? 401 : 403;
      const cookie = cookies[role] ?? '';
      expect((await request(app).post(endpoint).set('Cookie', cookie).set(csrf).send(body)).status).toBe(expected);
      expect((await request(app).patch(`${endpoint}/${record.id}`).set('Cookie', cookie).set(csrf).send({ ...body, version: 0 })).status).toBe(expected);
      expect((await request(app).patch(`${endpoint}/${record.id}/publish`).set('Cookie', cookie).set(csrf).send({ version: 0 })).status).toBe(expected);
      expect((await request(app).patch(`${endpoint}/${record.id}/unpublish`).set('Cookie', cookie).set(csrf).send({ version: 0 })).status).toBe(expected);
      expect((await request(app).delete(`${endpoint}/${record.id}?version=0`).set('Cookie', cookie).set(csrf)).status).toBe(expected);
      // An anonymous management query is rejected by the shared list policy as 403.
      expect((await request(app).get(`${endpoint}?scope=manage`).set('Cookie', cookie)).status).toBe(403);
      expect((await request(app).get(`${endpoint}/${record.id}`).set('Cookie', cookie)).status).toBe(404);
    }
    expect((await request(app).post(endpoint).set('Cookie', cookies.ADMIN!).set(csrf).send({ ...body, isPublished: true })).status).toBe(400);
    expect((await request(app).get(`${endpoint}?scope=mine`).set('Cookie', cookies.ADMIN!)).status).toBe(400);
  });

  it('keeps the two leadership directories separate and orders and paginates each section deterministically', async () => {
    for (const { endpoint, type, extra } of cases) {
      const prefix = `Order ${type}`;
      for (const order of [20, 0, 10]) await db.post.create({ data: { title: `${prefix} ${order}`, content: 'Verified', ...extra, type, createdBy: adminId, isPublished: true, displayOrder: order } });
      await db.post.create({ data: { title: `${prefix} hidden`, content: 'Private', ...extra, type, createdBy: adminId, displayOrder: 1 } });
      const first = await request(app).get(`${endpoint}?search=${encodeURIComponent(prefix)}&limit=2`);
      expect(first.body.data.map((item: { displayOrder: number }) => item.displayOrder)).toEqual([0, 10]);
      expect(first.body.data.every((item: { type: string }) => item.type === type)).toBe(true);
      expect(first.body.pagination.total).toBe(3); expect(first.body.pagination.totalPages).toBe(2);
      const second = await request(app).get(`${endpoint}?search=${encodeURIComponent(prefix)}&limit=2&page=2`);
      expect(second.body.data.map((item: { displayOrder: number }) => item.displayOrder)).toEqual([20]);
    }
    const school = await db.post.findFirstOrThrow({ where: { type: 'SCHOOL_LEADER', createdBy: adminId, isPublished: true } });
    expect((await request(app).get(`/api/leadership/alumni/${school.id}`)).status).toBe(404);
    expect((await request(app).patch(`/api/leadership/alumni/${school.id}/publish`).set('Cookie', cookies.ADMIN!).set(csrf).send({ version: school.version })).status).toBe(404);
  });
});
