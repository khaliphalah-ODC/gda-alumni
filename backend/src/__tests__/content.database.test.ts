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
describe.skipIf(!databaseUrl)('Content lifecycle with real PostgreSQL', () => {
  let prisma: PrismaClient, app: typeof import('../app.js').app;
  let adminCookie: string, ownerCookie: string, otherCookie: string, adminId: string, ownerId: string;
  const suffix = `@content-${Date.now()}.example`;
  const csrf = { 'X-GDA-CSRF': '1' };
  const endpoint = '/api/posts/announcements';
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js'));
    const { signToken } = await import('../utils/jwt.js');
    const admin = await prisma.user.create({ data: { email: 'admin' + suffix, password: 'unused', role: 'ADMIN' } }); adminId = admin.id;
    adminCookie = `gray_d_allison_token=${signToken({ userId: adminId, role: 'ADMIN' })}`;
    for (const name of ['owner', 'other']) {
      const user = await prisma.user.create({ data: { email: name + suffix, password: 'unused', membershipApplication: { create: { email: name + suffix, reference: name + suffix, trackingHash: 'fixture', fullName: name, phone: '123456789', graduationYear: 2000, status: 'APPROVED', activatedAt: new Date() } } } });
      const cookie = `gray_d_allison_token=${signToken({ userId: user.id, role: 'ALUMNI' })}`;
      if (name === 'owner') { ownerCookie = cookie; ownerId = user.id; } else otherCookie = cookie;
    }
  });
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await prisma.post.deleteMany({ where: { createdBy: { in: users.map((user) => user.id) } } });
    await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.$disconnect();
    const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  it('supports announcement drafts, details, edits, publication/unpublication and deletion', async () => {
    const created = await request(app).post(endpoint).set('Cookie', adminCookie).set(csrf).send({ title: 'Draft announcement', content: 'Complete announcement text', isPublished: false });
    expect(created.status).toBe(201); let post = created.body.data;
    expect(post.isPublished).toBe(false); expect(post.publishedAt).toBeNull();
    expect((await request(app).get(`${endpoint}/${post.id}`)).status).toBe(404);
    expect((await request(app).patch(`${endpoint}/${post.id}`).set('Cookie', ownerCookie).set(csrf).send({ title: 'Intrusion' })).status).toBe(403);
    const edited = await request(app).patch(`${endpoint}/${post.id}`).set('Cookie', adminCookie).set(csrf).send({ title: 'Edited announcement', version: post.version });
    expect(edited.status).toBe(200); post = edited.body.data;
    const published = await request(app).patch(`${endpoint}/${post.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: post.version });
    expect(published.status).toBe(200); post = published.body.data; expect(post.publishedAt).toBeTruthy();
    const detail = await request(app).get(`${endpoint}/${post.id}`); expect(detail.status).toBe(200); expect(detail.body.data.content).toBe('Complete announcement text'); expect(detail.body.data.user).not.toHaveProperty('email');
    const again = await request(app).patch(`${endpoint}/${post.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: post.version }); expect(again.body.data.publishedAt).toBe(post.publishedAt);
    const unpublished = await request(app).patch(`${endpoint}/${post.id}/unpublish`).set('Cookie', adminCookie).set(csrf).send({ version: post.version });
    expect(unpublished.status).toBe(200); post = unpublished.body.data; expect(post.publishedAt).toBeNull();
    expect((await request(app).get(`${endpoint}/${post.id}`)).status).toBe(404);
    expect((await request(app).delete(`${endpoint}/${post.id}?version=${post.version}`).set('Cookie', adminCookie).set(csrf)).status).toBe(200);
    expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
  });
  it('retains immediate publication for existing announcement creation clients', async () => {
    const response = await request(app).post(endpoint).set('Cookie', adminCookie).set(csrf).send({ title: 'Legacy announcement', content: 'Published on creation' });
    expect(response.status).toBe(201); expect(response.body.data.isPublished).toBe(true);
  });
  it('enforces story ownership and reapproval with stale-review protection', async () => {
    const created = await request(app).post('/api/stories').set('Cookie', ownerCookie).set(csrf).send({ title: 'My story', content: 'Original story content' });
    expect(created.status).toBe(201); let story = created.body.data; expect(story.isPublished).toBe(false);
    expect((await request(app).get(`/api/stories/${story.id}`).set('Cookie', otherCookie)).status).toBe(404);
    expect((await request(app).patch(`/api/stories/${story.id}`).set('Cookie', otherCookie).set(csrf).send({ content: 'Forbidden' })).status).toBe(403);
    expect((await request(app).delete(`/api/stories/${story.id}`).set('Cookie', otherCookie).set(csrf)).status).toBe(403);
    expect((await request(app).patch(`/api/stories/${story.id}/publish`).set('Cookie', ownerCookie).set(csrf).send({})).status).toBe(403);
    const published = await request(app).patch(`/api/stories/${story.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: story.version }); story = published.body.data;
    const edited = await request(app).patch(`/api/stories/${story.id}`).set('Cookie', ownerCookie).set(csrf).send({ content: 'Changed after review', version: story.version });
    expect(edited.status).toBe(200); expect(edited.body.data.isPublished).toBe(false); expect(edited.body.data.publishedAt).toBeNull();
    expect((await request(app).patch(`/api/stories/${story.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: story.version })).status).toBe(409);
    expect((await request(app).get(`/api/stories/${story.id}`)).status).toBe(404);
    expect((await request(app).delete(`/api/stories/${story.id}?version=${edited.body.data.version}`).set('Cookie', ownerCookie).set(csrf)).status).toBe(200);
  });
  it('supports administrator event management and excludes past/undated events from public lists', async () => {
    const body = { title: 'Future gathering', content: 'An event description', eventDate: new Date(Date.now() + 86400000).toISOString(), eventLocation: 'School campus', audience: 'Alumni' };
    expect((await request(app).post('/api/events').set('Cookie', ownerCookie).set(csrf).send(body)).status).toBe(403);
    const created = await request(app).post('/api/events').set('Cookie', adminCookie).set(csrf).send(body); expect(created.status).toBe(201); let event = created.body.data;
    const published = await request(app).patch(`/api/events/${event.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: event.version }); event = published.body.data;
    const listing = await request(app).get('/api/events?scope=public&search=Future%20gathering&limit=1'); expect(listing.body.data[0].id).toBe(event.id); expect(listing.body.pagination.total).toBe(1);
    const edited = await request(app).patch(`/api/events/${event.id}`).set('Cookie', adminCookie).set(csrf).send({ eventDate: new Date(0).toISOString(), version: event.version }); event = edited.body.data;
    expect((await request(app).get('/api/events?scope=public&search=Future%20gathering')).body.data).toHaveLength(0);
    const past = await request(app).get('/api/events?scope=public&period=past&search=Future%20gathering');
    expect(past.status).toBe(200); expect(past.body.data.map((post: { id: string }) => post.id)).toEqual([event.id]);
    expect((await request(app).get('/api/events?scope=public&period=all&search=Future%20gathering')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/events?period=invalid')).status).toBe(400);
    await request(app).patch(`/api/events/${event.id}/unpublish`).set('Cookie', adminCookie).set(csrf).send({ version: event.version });
    expect((await request(app).get('/api/events?scope=public&period=past&search=Future%20gathering')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/events?scope=public&period=all&search=Future%20gathering').set('Cookie', adminCookie)).body.data).toHaveLength(0);
    event = (await request(app).get(`/api/events/${event.id}`).set('Cookie', adminCookie)).body.data;
    event = (await request(app).patch(`/api/events/${event.id}/publish`).set('Cookie', adminCookie).set(csrf).send({ version: event.version })).body.data;
    expect((await request(app).get(`/api/events/${event.id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/events/${event.id}?version=${event.version}`).set('Cookie', adminCookie).set(csrf)).status).toBe(200);
  });
  it('filters public/private lists without leaking drafts or accepting management scope from alumni', async () => {
    const post = await prisma.post.create({ data: { type: 'STORY', title: 'Unique private draft', content: 'Private body', createdBy: ownerId } });
    expect((await request(app).get('/api/stories?scope=public&search=Unique%20private')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/stories?scope=public&publication=draft').set('Cookie', adminCookie)).body.data).toHaveLength(0);
    expect((await request(app).get('/api/stories?scope=manage').set('Cookie', ownerCookie)).status).toBe(403);
    const mine = await request(app).get('/api/stories?scope=mine&search=Unique%20private').set('Cookie', ownerCookie); expect(mine.body.data[0].id).toBe(post.id);
    expect((await request(app).get('/api/stories?scope=mine&search=Unique%20private').set('Cookie', otherCookie)).body.data).toHaveLength(0);
  });
  it('allows only one concurrent content mutation from the same version', async () => {
    const post = await prisma.post.create({ data: { type: 'STORY', title: 'Concurrent moderation', content: 'Review this', createdBy: ownerId } });
    const { postRepository } = await import('../repositories/post.repository.js');
    const results = await Promise.all([postRepository.updateIfCurrent(post.id, 'STORY', 0, { content: 'New draft' }), postRepository.updateIfCurrent(post.id, 'STORY', 0, { isPublished: true, publishedAt: new Date() })]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).version).toBe(1);
  });
});
