import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';
import nodemailer from 'nodemailer';
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
describe.skipIf(!databaseUrl)('Recovery, categories and editable showcase with PostgreSQL', () => {
  let db: PrismaClient, app: typeof import('../app').app, env: typeof import('../config/env').env;
  let previous: typeof env, platform: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  let sender: ReturnType<typeof vi.spyOn>, resetId: string, adminId: string;
  const ids: string[] = [], cookies: Record<string, string> = {}, messages: { to: string; text: string }[] = [];
  const suffix = `@release-${Date.now()}.example`, password = 'RecoveryFixture123!';
  const csrf = { 'X-GDA-CSRF': '1' };
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js')); ({ env } = await import('../config/env.js')); previous = { ...env };
    platform = await db.platformSettings.findUnique({ where: { id: 1 } });
    await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true }, update: { emailEnabled: true } });
    env.ACTIVATION_DELIVERY = 'smtp'; env.SMTP_HOST = 'fixture'; env.SMTP_FROM = 'fixture@example.test';
    sender = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: vi.fn(async message => { messages.push(message); return { accepted: [message.to], rejected: [] }; }) } as never);
    const { signToken } = await import('../utils/jwt.js');
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI', 'STUDENT'] as const) {
      const user = await db.user.create({ data: { email: role.toLowerCase() + suffix, role, password: await bcrypt.hash(password, 4), ...(role === 'ALUMNI' ? { membershipApplication: { create: { reference: `release-${Date.now()}`, trackingHash: 'fixture', email: role.toLowerCase() + suffix, fullName: 'Fixture member', phone: '123456789', graduationYear: 2000, status: 'APPROVED', activatedAt: new Date() } } } : {}) } });
      ids.push(user.id); cookies[role] = `gray_d_allison_token=${signToken({ userId: user.id, role })}`; if (role === 'ADMIN') adminId = user.id;
    }
    const resetUser = await db.user.create({ data: { email: 'recovery' + suffix, role: 'ADMIN', password: await bcrypt.hash(password, 4) } }); resetId = resetUser.id; ids.push(resetId);
  });
  beforeEach(async () => {
    messages.length = 0;
    const { recoveryLimiter, recoveryEmailLimiter } = await import('../routes/auth.routes.js');
    recoveryLimiter.resetKey('127.0.0.1'); recoveryEmailLimiter.resetKey('recovery' + suffix);
  });
  afterAll(async () => {
    sender?.mockRestore(); if (env && previous) Object.assign(env, previous);
    if (!db) return;
    await db.accountToken.deleteMany({ where: { userId: { in: ids } } }); await db.post.deleteMany({ where: { createdBy: { in: ids } } });
    await db.auditRecord.deleteMany({ where: { actorId: { in: ids } } }); await db.membershipApplication.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
    if (platform) await db.platformSettings.update({ where: { id: 1 }, data: platform }); else await db.platformSettings.deleteMany();
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });
  const post = (path: string, data: object, cookie?: string) => request(app).post(path).set(csrf).set(cookie ? { Cookie: cookie } : {}).send(data);
  async function issue() {
    const response = await post('/api/auth/forgot-password', { email: 'recovery' + suffix }); expect(response.status).toBe(200);
    await vi.waitFor(async () => expect(await db.accountToken.count({ where: { userId: resetId, purpose: 'PASSWORD_RESET', deliveredAt: { not: null } } })).toBe(1));
    const token = messages.find(message => message.text.includes('/reset-password#'))?.text.match(/token=([a-f0-9]{64})/)?.[1]; expect(token).toBeTruthy(); return token!;
  }
  it('returns the same public response for known and unknown email, without leaking a token', async () => {
    const known = await post('/api/auth/forgot-password', { email: 'recovery' + suffix });
    const unknown = await post('/api/auth/forgot-password', { email: 'unknown' + suffix });
    expect(known.status).toBe(200); expect(unknown.body).toEqual(known.body); expect(known.body.data).toBeNull();
    expect(JSON.stringify(known.body)).not.toContain('#token=');
  });
  it('uses a one-time token, updates the hash and revokes old sessions', async () => {
    const { signToken } = await import('../utils/jwt.js'); const before = await db.user.findUniqueOrThrow({ where: { id: resetId } });
    const oldCookie = `gray_d_allison_token=${signToken({ userId: resetId, role: 'ADMIN', sessionVersion: before.sessionVersion })}`;
    const token = await issue(), data = { token, newPassword: 'RecoveredPassword456!', confirmation: 'RecoveredPassword456!' };
    expect((await post('/api/auth/reset-password', { ...data, confirmation: 'mismatch' })).status).toBe(400);
    expect((await post('/api/auth/reset-password', data)).status).toBe(200);
    expect((await post('/api/auth/reset-password', data)).status).toBe(400);
    const after = await db.user.findUniqueOrThrow({ where: { id: resetId } }); expect(after.sessionVersion).toBe(before.sessionVersion + 1); expect(await bcrypt.compare(data.newPassword, after.password)).toBe(true);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status).toBe(401);
  });
  it('rejects expired tokens and tokens invalidated by another password/session change', async () => {
    let token = await issue(); await db.accountToken.updateMany({ where: { userId: resetId, purpose: 'PASSWORD_RESET' }, data: { expiresAt: new Date(0) } });
    const reset = (value: string) => post('/api/auth/reset-password', { token: value, newPassword: 'RecoveredPassword789!', confirmation: 'RecoveredPassword789!' });
    expect((await reset(token)).status).toBe(400);
    token = await issue(); await db.user.update({ where: { id: resetId }, data: { sessionVersion: { increment: 1 } } }); expect((await reset(token)).status).toBe(400);
  });
  it('allows exactly one concurrent redemption', async () => {
    const token = await issue(); const data = { token, newPassword: 'ConcurrentPassword123!', confirmation: 'ConcurrentPassword123!' };
    const responses = await Promise.all([post('/api/auth/reset-password', data), post('/api/auth/reset-password', data)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
  });
  it('does not send recovery for disabled or student accounts', async () => {
    await db.user.update({ where: { id: adminId }, data: { isActive: false } });
    try {
      for (const email of ['admin' + suffix, 'student' + suffix]) expect((await post('/api/auth/forgot-password', { email })).status).toBe(200);
      expect(messages).toHaveLength(0);
    } finally { await db.user.update({ where: { id: adminId }, data: { isActive: true } }); }
  });
  it('filters announcements and events by category before pagination and excludes drafts', async () => {
    const title = `Category fixture ${Date.now()}`;
    for (const category of ['Academic', 'Alumni']) expect((await post('/api/posts/announcements', { title: title + category, content: 'Fixture announcement', category }, cookies.ADMIN)).status).toBe(201);
    expect((await post('/api/posts/announcements', { title: title + 'draft', content: 'Private draft', category: 'Academic', isPublished: false }, cookies.ADMIN)).status).toBe(201);
    const list = await request(app).get('/api/posts/announcements').query({ scope: 'public', category: 'Academic', search: title, limit: 1 }); expect(list.status).toBe(200); expect(list.body.pagination.total).toBe(1); expect(list.body.data[0].category).toBe('Academic');
    for (const category of ['Sports', 'Ceremony']) {
      const created = await post('/api/events', { title: title + category, content: 'Fixture event', category, eventDate: '2099-06-01T12:00:00Z' }, cookies.ADMIN); expect(created.status).toBe(201);
      expect((await request(app).patch(`/api/events/${created.body.data.id}/publish`).set(csrf).set('Cookie', cookies.ADMIN).send({ version: 0 })).status).toBe(200);
    }
    const events = await request(app).get('/api/events').query({ scope: 'public', category: 'Sports', search: title }); expect(events.status).toBe(200); expect(events.body.data).toHaveLength(1);
    expect((await post('/api/events', { title, content: 'Fixture event', category: 'invalid', eventDate: '2099-06-01T12:00:00Z' }, cookies.ADMIN)).status).toBe(400);
  });
  it('restricts managed collections to school Admin and retains publication/version rules', async () => {
    const data = { title: 'Gallery fixture', content: 'Test photograph', image: 'https://example.test/photo.webp', imageAlt: 'A synthetic test photograph', category: 'Parade' };
    expect((await post('/api/gallery', data)).status).toBe(401);
    for (const role of ['SUPER_ADMIN', 'ALUMNI']) expect((await post('/api/gallery', data, cookies[role])).status).toBe(403);
    const created = await post('/api/gallery', data, cookies.ADMIN); expect(created.status).toBe(201); const item = created.body.data;
    const publish = (version: number) => request(app).patch(`/api/gallery/${item.id}/publish`).set(csrf).set('Cookie', cookies.ADMIN).send({ version });
    expect((await publish(0)).status).toBe(200); expect((await publish(0)).status).toBe(409);
    const publicItems = await request(app).get('/api/gallery').query({ scope: 'public' }); expect(publicItems.body.data.managed).toBe(true); expect(publicItems.body.data.items.map((entry: { id: string }) => entry.id)).toContain(item.id);
    const patch = await request(app).patch(`/api/gallery/${item.id}`).set(csrf).set('Cookie', cookies.ADMIN).send({ ...data, title: 'Edited gallery fixture', version: 1 }); expect(patch.status).toBe(200); expect(patch.body.data.isPublished).toBe(false);
    expect((await request(app).get('/api/gallery').query({ scope: 'public' })).body.data.items).toHaveLength(0);
    expect((await request(app).get('/api/gallery').query({ scope: 'public' })).body.data.managed).toBe(true);
  });
  it('requires complete source-backed achievement cards and hides drafts', async () => {
    const data = { title: 'Fixture achievement', content: 'Confirmed fixture details', category: 'Academic', imageAlt: 'Fixture photograph', summary: 'Fixture card description', heading: 'Fixture award', milestoneDate: '2026-09', sourceUrl: 'https://example.test/source', sourceLabel: 'Fixture official source' };
    const created = await post('/api/achievements', data, cookies.ADMIN); expect(created.status).toBe(201); const id = created.body.data.id;
    const publish = (version: number) => request(app).patch(`/api/achievements/${id}/publish`).set(csrf).set('Cookie', cookies.ADMIN).send({ version });
    expect((await publish(0)).status).toBe(400);
    expect((await post('/api/achievements', { ...data, sourceUrl: 'javascript:alert(1)' }, cookies.ADMIN)).status).toBe(400);
    expect((await request(app).patch(`/api/achievements/${id}`).set(csrf).set('Cookie', cookies.ADMIN).send({ ...data, image: 'https://example.test/photo.webp', version: 0 })).status).toBe(200);
    expect((await publish(1)).status).toBe(200);
    const response = await request(app).get('/api/achievements').query({ scope: 'public' }); expect(response.body.data.managed).toBe(true); expect(response.body.data.items[0].sourceUrl).toBe(data.sourceUrl);
  });
});
