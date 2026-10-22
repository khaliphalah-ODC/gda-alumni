import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, RequestStatus } from '@prisma/client';
import request from 'supertest';
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
describe.skipIf(!databaseUrl)('Administrator aggregate dashboard with real database', () => {
  let prisma: PrismaClient, app: typeof import('../app.js').app, adminCookie: string, ownerCookie: string, adminId: string, ownerId: string, eventId: string;
  let baseline: { stats: Record<string, number>; requestsByStatus: Record<RequestStatus, number> };
  const suffix = `@admin-dashboard-${Date.now()}.example`;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js')); const { signToken } = await import('../utils/jwt.js');
    const admin = await prisma.user.create({ data: { email: 'admin' + suffix, password: 'unused', role: 'ADMIN' } }); adminId = admin.id;
    adminCookie = `gray_d_allison_token=${signToken({ userId: adminId, role: 'ADMIN' })}`;
    const first = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie); expect(first.status).toBe(200); baseline = first.body.data;
    for (const name of ['owner', 'inactive']) {
      const user = await prisma.user.create({ data: { email: name + suffix, password: 'unused', isActive: name !== 'inactive', membershipApplication: { create: { email: name + suffix, reference: name + suffix, trackingHash: 'fixture', fullName: name, phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date(), reviewedBy: adminId, reviewedAt: new Date(), history: { create: { action: 'APPROVED', actorId: adminId } } } } } });
      if (name === 'owner') { ownerId = user.id; ownerCookie = `gray_d_allison_token=${signToken({ userId: user.id, role: 'ALUMNI' })}`; }
    }
    for (const [status, count] of [['PENDING', 15], ['REJECTED', 2], ['APPROVED', 1]] as const) for (let i = 0; i < count; i++) {
      await prisma.membershipApplication.create({ data: { reference: `${status}-${i}${suffix}`, email: `${status}-${i}${suffix}`, trackingHash: 'fixture', fullName: `${status} Applicant ${i}`, phone: '123456789', graduationYear: 2005, status, history: { create: { action: 'SUBMITTED' } } } });
    }
    for (let i = 0; i < 17; i++) await prisma.post.create({ data: { type: 'ANNOUNCEMENT', title: `Announcement ${i}`, content: 'School content', createdBy: adminId, isPublished: i < 15, publishedAt: i < 15 ? new Date() : null } });
    for (let i = 0; i < 5; i++) await prisma.post.create({ data: { type: 'STORY', title: `Story ${i}`, content: 'Alumni story', createdBy: ownerId, isPublished: i < 3, publishedAt: i < 3 ? new Date() : null } });
    for (const [index, date, published] of [[0, new Date(Date.now() + 86400000), true], [1, new Date(Date.now() + 172800000), true], [2, new Date(0), true], [3, null, true], [4, new Date(Date.now() + 86400000), false]] as const) {
      const event = await prisma.post.create({ data: { type: 'EVENT', title: `Event ${index}`, content: 'School event', createdBy: adminId, isPublished: published, eventDate: date } }); if (index === 0) eventId = event.id;
    }
    for (const status of Object.values(RequestStatus)) await prisma.request.create({ data: { requestType: 'TRANSCRIPT', purpose: 'University', requestedBy: ownerId, fullNameAtGraduation: 'Alumnus', contactPhone: '123456789', status, completedAt: status === 'COMPLETED' ? new Date() : null } });
  });
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } }); const ids = users.map((row) => row.id);
    const apps = await prisma.membershipApplication.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await prisma.request.deleteMany({ where: { requestedBy: { in: ids } } }); await prisma.post.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.membershipReview.deleteMany({ where: { applicationId: { in: apps.map((row) => row.id) } } }); await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.$disconnect(); const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  it('requires administrator permission and prevents public/member access', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    const denied = await request(app).get('/api/admin/dashboard').set('Cookie', ownerCookie); expect(denied.status).toBe(403); expect(denied.body.data).toBeNull();
  });
  it('counts the complete database, separates activation, and includes every request status', async () => {
    const response = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie); expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store'); const data = response.body.data;
    const changes: Record<string, number> = { totalApprovedAlumni: 3, pendingApplications: 15, rejectedApplications: 2, activatedAlumniAccounts: 2, activeAlumniAccounts: 1, publishedAnnouncements: 15, publishedStories: 3, upcomingEvents: 2, totalRequests: 6 };
    for (const [field, delta] of Object.entries(changes)) expect(data.stats[field], field).toBe(baseline.stats[field]! + delta);
    for (const status of Object.values(RequestStatus)) expect(data.requestsByStatus[status]).toBe(baseline.requestsByStatus[status] + 1);
    expect(data.stats.pendingApplications).toBeGreaterThan(data.recentApplications.length); expect(data.recentApplications.length).toBeLessThanOrEqual(5);
    expect(data.stats.totalRequests).toBe(Object.values(data.requestsByStatus as Record<string, number>).reduce((sum, count) => sum + count, 0));
    expect(data.membershipActivity.length).toBeGreaterThan(0); expect(data.asOf).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain('trackingHash'); expect(JSON.stringify(data)).not.toContain('password');
  });
  it('refreshes aggregate counts after a real publication change', async () => {
    const before = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
    const changed = await request(app).patch(`/api/events/${eventId}/unpublish`).set('Cookie', adminCookie).set('X-GDA-CSRF', '1').send({ version: 0 }); expect(changed.status).toBe(200);
    const after = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie); expect(after.body.data.stats.upcomingEvents).toBe(before.body.data.stats.upcomingEvents - 1);
  });
  it('also enforces administrator authorization in the service layer', async () => {
    const { adminService } = await import('../services/admin.service.js');
    await expect(adminService.dashboard({ userId: ownerId, role: 'ALUMNI' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
