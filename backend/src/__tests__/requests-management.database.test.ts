import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
describe.skipIf(!databaseUrl)('Document request management with real database', () => {
  let prisma: PrismaClient, app: typeof import('../app.js').app;
  let owner: string, admin: string, other: string, ownerId: string;
  const suffix = `@requests-${Date.now()}.example`, csrf = { 'X-GDA-CSRF': '1' };
  const input = (requestType = 'TRANSCRIPT') => ({ requestType, purpose: 'University application', fullNameAtGraduation: 'Request Owner', graduationYear: 2005, contactPhone: '123456789', studentIdOrIndexNumber: 'INDEX-UNIQUE' });
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js')); const { signToken } = await import('../utils/jwt.js');
    for (const name of ['owner', 'other', 'admin']) {
      const user = await prisma.user.create({ data: { email: name + suffix, password: 'unused', role: name === 'admin' ? 'ADMIN' : 'ALUMNI', ...(name === 'admin' ? {} : { membershipApplication: { create: { email: name + suffix, reference: name + suffix, trackingHash: 'fixture', fullName: name, phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } }) } });
      const cookie = `gray_d_allison_token=${signToken({ userId: user.id, role: user.role })}`;
      if (name === 'owner') { owner = cookie; ownerId = user.id; } else if (name === 'other') other = cookie; else admin = cookie;
    }
  });
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } });
    await prisma.request.deleteMany({ where: { requestedBy: { in: users.map((user) => user.id) } } });
    await prisma.membershipApplication.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } }); await prisma.$disconnect();
    const { prisma: connection } = await import('../config/prisma.js'); await connection.$disconnect();
  });
  const create = async (type?: string) => { const response = await request(app).post('/api/requests').set('Cookie', owner).set(csrf).send(input(type)); expect(response.status).toBe(201); return response.body.data; };
  it('supports all five request types, searchable pagination and scoped private details', async () => {
    for (const type of ['CERTIFICATE', 'TRANSCRIPT', 'DIPLOMA', 'WAEC_CERTIFICATE', 'WASSCE_CERTIFICATE']) await create(type);
    const list = await request(app).get(`/api/requests?search=${encodeURIComponent('owner' + suffix)}&limit=2&status=SUBMITTED`).set('Cookie', admin);
    expect(list.status).toBe(200); expect(list.body.data).toHaveLength(2); expect(list.body.pagination.total).toBe(5);
    const record = list.body.data[0]; expect((await request(app).get(`/api/requests/${record.id}`).set('Cookie', owner)).status).toBe(200);
    expect((await request(app).get(`/api/requests/${record.id}`).set('Cookie', other)).status).toBe(403);
    expect((await request(app).get('/api/requests').set('Cookie', owner)).status).toBe(403);
    expect((await request(app).get(`/api/requests/my?search=${encodeURIComponent('owner' + suffix)}`).set('Cookie', other)).body.data).toHaveLength(0);
    expect((await request(app).get('/api/requests/my?search=INDEX-UNIQUE').set('Cookie', owner)).body.pagination.total).toBe(5);
  });
  it('enforces workflow, rejection/reconsideration, notes and final completion', async () => {
    let record = await create();
    const transition = async (status: string, expected = 200) => {
      const response = await request(app).patch(`/api/requests/${record.id}/status`).set('Cookie', admin).set(csrf).send({ status, version: record.version, adminNote: `Registrar: ${status}` });
      expect(response.status).toBe(expected); if (expected === 200) record = response.body.data;
    };
    await transition('APPROVED', 400); await transition('IN_REVIEW'); await transition('REJECTED'); await transition('APPROVED', 400); await transition('IN_REVIEW'); await transition('APPROVED'); await transition('COMPLETED', 400); await transition('READY_FOR_PICKUP'); await transition('COMPLETED');
    const completedAt = record.completedAt; expect(completedAt).toBeTruthy(); await transition('IN_REVIEW', 400);
    const note = await request(app).patch(`/api/requests/${record.id}/note`).set('Cookie', admin).set(csrf).send({ adminNote: 'Collected in person', version: record.version });
    expect(note.status).toBe(200); expect(note.body.data.status).toBe('COMPLETED'); expect(note.body.data.completedAt).toBe(completedAt);
    const detail = await request(app).get(`/api/requests/${record.id}`).set('Cookie', owner); expect(detail.body.data.adminNote).toBe('Collected in person');
    expect((await request(app).delete(`/api/requests/${record.id}`).set('Cookie', owner).set(csrf)).status).toBe(400);
    expect((await request(app).patch(`/api/requests/${record.id}/note`).set('Cookie', owner).set(csrf).send({ adminNote: 'Unauthorized' })).status).toBe(403);
  });
  it('rejects stale status, note and administrator deletion operations', async () => {
    const record = await create();
    const reviewed = await request(app).patch(`/api/requests/${record.id}/status`).set('Cookie', admin).set(csrf).send({ status: 'IN_REVIEW', version: record.version }); expect(reviewed.status).toBe(200);
    expect((await request(app).patch(`/api/requests/${record.id}/status`).set('Cookie', admin).set(csrf).send({ status: 'APPROVED', version: record.version })).status).toBe(409);
    expect((await request(app).patch(`/api/requests/${record.id}/note`).set('Cookie', admin).set(csrf).send({ adminNote: 'Stale', version: record.version })).status).toBe(409);
    expect((await request(app).delete(`/api/requests/${record.id}?version=${record.version}`).set('Cookie', admin).set(csrf)).status).toBe(409);
    expect((await prisma.request.findUniqueOrThrow({ where: { id: record.id } })).status).toBe('IN_REVIEW');
  });
  it('permits owner deletion only before review or after rejection, preserving ownership', async () => {
    const submitted = await create(); expect((await request(app).delete(`/api/requests/${submitted.id}`).set('Cookie', other).set(csrf)).status).toBe(403);
    expect((await request(app).delete(`/api/requests/${submitted.id}?version=${submitted.version}`).set('Cookie', owner).set(csrf)).status).toBe(200);
    const rejected = await prisma.request.create({ data: { ...input(), requestType: 'TRANSCRIPT', requestedBy: ownerId, status: 'REJECTED' } });
    expect((await request(app).delete(`/api/requests/${rejected.id}?version=${rejected.version}`).set('Cookie', owner).set(csrf)).status).toBe(200);
    const reviewed = await prisma.request.create({ data: { ...input(), requestType: 'TRANSCRIPT', requestedBy: ownerId, status: 'IN_REVIEW' } });
    expect((await request(app).delete(`/api/requests/${reviewed.id}`).set('Cookie', owner).set(csrf)).status).toBe(400);
    expect((await request(app).delete(`/api/requests/${reviewed.id}?version=${reviewed.version}`).set('Cookie', admin).set(csrf)).status).toBe(200);
  });
  it('allows one of two competing administrator decisions from the same reviewed version', async () => {
    const record = await prisma.request.create({ data: { ...input(), requestType: 'TRANSCRIPT', requestedBy: ownerId, status: 'IN_REVIEW' } });
    const results = await Promise.all(['APPROVED', 'REJECTED'].map((status) => request(app).patch(`/api/requests/${record.id}/status`).set('Cookie', admin).set(csrf).send({ status, version: record.version, adminNote: 'Checked school records' })));
    expect(results.map((response: { status: number }) => response.status).sort()).toEqual([200, 409]);
    expect((await prisma.request.findUniqueOrThrow({ where: { id: record.id } })).version).toBe(1);
  });
});
