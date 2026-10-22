import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcrypt';
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test');
  process.env.DATABASE_URL = databaseUrl;
}
describe.skipIf(!databaseUrl)('Alumni profiles, directory and dashboard with PostgreSQL', () => {
  let prisma: PrismaClient;
  let app: typeof import('../app.js').app;
  const suffix = `@directory-${Date.now()}.example`;
  let ownerId: string, otherId: string, inactiveId: string, legacyId: string, ownerProfile: string;
  let ownerCookie: string, adminCookie: string, legacyCookie: string;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js'));
    const { signToken } = await import('../utils/jwt.js');
    const hash = await bcrypt.hash('Password123', 4);
    const member = async (email: string, fullName: string, isActive = true) => {
      return prisma.user.create({ data: { email: email + suffix, password: hash, isActive, alumniProfile: { create: { fullName, graduationYear: 2004, phone: 'private-123456', bio: 'Member biography', occupation: 'Teacher', location: 'Monrovia' } }, membershipApplication: { create: { reference: email + suffix, trackingHash: 'private-tracking', fullName: 'Original verification name', email: email + suffix, phone: 'private-phone', graduationYear: 2004, verificationInformation: 'Private attendance evidence', status: 'APPROVED', activatedAt: new Date(), reviewedAt: new Date() } } }, include: { alumniProfile: true } });
    };
    const owner = await member('owner', 'Directory Owner'); ownerId = owner.id; ownerProfile = owner.alumniProfile!.id;
    const other = await member('other', 'Directory Other'); otherId = other.id;
    const inactive = await member('inactive', 'Directory Inactive', false); inactiveId = inactive.id;
    const legacy = await prisma.user.create({ data: { email: 'legacy' + suffix, password: hash, alumniProfile: { create: { fullName: 'Directory Unapproved' } } } }); legacyId = legacy.id;
    const admin = await prisma.user.create({ data: { email: 'admin' + suffix, password: hash, role: 'ADMIN' } });
    ownerCookie = `gray_d_allison_token=${signToken({ userId: owner.id, role: 'ALUMNI' })}`;
    adminCookie = `gray_d_allison_token=${signToken({ userId: admin.id, role: 'ADMIN' })}`;
    legacyCookie = `gray_d_allison_token=${signToken({ userId: legacy.id, role: 'ALUMNI' })}`;
    for (const data of [
      { type: 'ANNOUNCEMENT' as const, title: 'Published announcement', content: 'Official update', isPublished: true, publishedAt: new Date() },
      { type: 'ANNOUNCEMENT' as const, title: 'Private announcement', content: 'Not yet published', isPublished: false },
      { type: 'STORY' as const, title: 'Own draft', content: 'Awaiting moderation', isPublished: false },
      { type: 'EVENT' as const, title: 'Future event', content: 'Published upcoming', isPublished: true, eventDate: new Date(Date.now() + 86400000) },
      { type: 'EVENT' as const, title: 'Past event', content: 'Historical event', isPublished: true, eventDate: new Date(0) },
    ]) await prisma.post.create({ data: { ...data, createdBy: ownerId } });
    await prisma.post.create({ data: { type: 'STORY', title: 'Other private draft', content: 'Private draft', createdBy: otherId } });
    for (const requestedBy of [ownerId, otherId]) await prisma.request.create({ data: { requestType: 'TRANSCRIPT', purpose: 'University application', requestedBy, fullNameAtGraduation: 'Alumni', contactPhone: '123456789', adminNote: requestedBy === ownerId ? 'Your request is queued' : 'Other private note' } });
  });
  afterAll(async () => {
    if (!prisma) return;
    const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } }); const ids = users.map((row) => row.id);
    await prisma.request.deleteMany({ where: { requestedBy: { in: ids } } });
    await prisma.post.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect(); const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  it('requires activated membership or administrator permission for all directory reads', async () => {
    expect((await request(app).get('/api/alumni/directory')).status).toBe(401);
    expect((await request(app).get('/api/alumni/directory').set('Cookie', legacyCookie)).status).toBe(401);
    expect((await request(app).get('/api/alumni/directory').set('Cookie', adminCookie)).status).toBe(200);
  });
  it('searches, filters and paginates only eligible members without private data', async () => {
    const response = await request(app).get('/api/alumni/directory?search=Directory&graduationYear=2004&limit=1').set('Cookie', ownerCookie);
    expect(response.status).toBe(200); expect(response.body.data).toHaveLength(1); expect(response.body.pagination.total).toBe(2);
    for (const field of ['email', 'phone', 'userId', 'verificationInformation', 'user', 'trackingHash']) expect(response.body.data[0]).not.toHaveProperty(field);
    const detail = await request(app).get(`/api/alumni/directory/${ownerProfile}`).set('Cookie', ownerCookie);
    expect(detail.status).toBe(200); expect(detail.body.data.bio).toBe('Member biography'); expect(detail.body.data).not.toHaveProperty('phone');
    const hidden = await prisma.alumniProfile.findUniqueOrThrow({ where: { userId: inactiveId } });
    expect((await request(app).get(`/api/alumni/directory/${hidden.id}`).set('Cookie', ownerCookie)).status).toBe(404);
    expect((await request(app).get('/api/alumni/directory?limit=1000').set('Cookie', ownerCookie)).status).toBe(400);
  });
  it('edits only the current profile and leaves approved verification records immutable', async () => {
    const response = await request(app).patch('/api/alumni/profile').set('Cookie', ownerCookie).set('X-GDA-CSRF', '1').send({ fullName: 'Updated Profile Name', occupation: 'Engineer', bio: '', profileImage: 'https://example.com/photo.png' });
    expect(response.status).toBe(200); expect(response.body.data.bio).toBeNull();
    const application = await prisma.membershipApplication.findUniqueOrThrow({ where: { userId: ownerId } }); expect(application.fullName).toBe('Original verification name');
    expect((await prisma.alumniProfile.findUniqueOrThrow({ where: { userId: otherId } })).fullName).toBe('Directory Other');
    expect((await request(app).patch('/api/alumni/profile').set('Cookie', ownerCookie).set('X-GDA-CSRF', '1').send({ userId: otherId, fullName: 'Hijacked' })).status).toBe(400);
    expect((await request(app).patch('/api/alumni/profile').set('Cookie', ownerCookie).set('X-GDA-CSRF', '1').send({ profileImage: 'javascript:alert(1)' })).status).toBe(400);
  });
  it('creates a missing own profile without changing another account', async () => {
    await prisma.alumniProfile.delete({ where: { userId: ownerId } });
    const response = await request(app).patch('/api/alumni/profile').set('Cookie', ownerCookie).set('X-GDA-CSRF', '1').send({ fullName: 'Restored Profile', graduationYear: 2004 });
    expect(response.status).toBe(200); expect(response.body.data.userId).toBe(ownerId);
  });
  it('builds a personal dashboard with real membership, content, completion and request counts', async () => {
    const response = await request(app).get('/api/alumni/dashboard').set('Cookie', ownerCookie);
    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.membership.status).toBe('APPROVED'); expect(data.membership.activatedAt).toBeTruthy();
    expect(data.profileCompletion).toEqual({ completed: 2, total: 7, percent: 29 });
    expect(data.announcements.map((post: { title: string }) => post.title)).toContain('Published announcement');
    expect(data.announcements.map((post: { title: string }) => post.title)).not.toContain('Private announcement');
    expect(data.stories.map((post: { title: string }) => post.title)).toEqual(['Own draft']);
    expect(data.events.map((post: { title: string }) => post.title)).toContain('Future event');
    expect(data.events.map((post: { title: string }) => post.title)).not.toContain('Past event');
    expect(data.requests).toHaveLength(1); expect(data.requests[0].adminNote).toBe('Your request is queued');
    expect(data.requestCounts).toEqual([{ status: 'SUBMITTED', _count: { _all: 1 } }]);
    expect(JSON.stringify(data)).not.toContain('Other private note');
    const events = await request(app).get('/api/events'); expect(events.body.data.every((event: { eventDate: string }) => new Date(event.eventDate).getTime() >= Date.now())).toBe(true);
  });
});
