import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mail.sendMail }) } }));
vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
describe.skipIf(!databaseUrl)('Shared accounts and strict platform administration', () => {
  let db: PrismaClient, app: typeof import('../app.js').app, env: typeof import('../config/env.js').env, original: typeof env;
  let superId: string, adminId: string, memberId: string;
  let cookies: Record<string, string> = {};
  let previousSettings: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  const suffix = `@accounts-${Date.now()}.example`, password = 'AccountPassword123!';
  const mutate = (path: string, role = 'SUPER_ADMIN') => request(app).post(path).set('Cookie', cookies[role]!).set('X-GDA-CSRF', '1');
  const patch = (path: string, role = 'SUPER_ADMIN') => request(app).patch(path).set('Cookie', cookies[role]!).set('X-GDA-CSRF', '1');
  const tokenFromMail = () => /#token=([a-f0-9]{64})/.exec(mail.sendMail.mock.calls.at(-1)![0].text)![1]!;
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js')); ({ env } = await import('../config/env.js')); original = { ...env }; previousSettings = await db.platformSettings.findUnique({ where: { id: 1 } });
    const { signToken } = await import('../utils/jwt.js');
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'ALUMNI'] as const) {
      const user = await db.user.create({ data: { email: role.toLowerCase() + suffix, password: await bcrypt.hash(password, 4), role,
        ...(role === 'ALUMNI' ? { alumniProfile: { create: { fullName: 'Verified Member' } }, membershipApplication: { create: { reference: 'member' + suffix, trackingHash: 'fixture', email: 'alumni' + suffix, fullName: 'Verified Member', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } : { staffProfile: { create: { fullName: role } } }) } });
      if (role === 'SUPER_ADMIN') superId = user.id; else if (role === 'ADMIN') adminId = user.id; else memberId = user.id;
      cookies[role] = `gray_d_allison_token=${signToken({ userId: user.id, role })}`;
    }
  });
  beforeEach(async () => {
    mail.sendMail.mockReset(); mail.sendMail.mockResolvedValue({ accepted: ['recipient@example.com'], rejected: [] });
    Object.assign(env, { ...original, ACTIVATION_DELIVERY: 'smtp', SMTP_HOST: 'smtp.example', SMTP_FROM: 'portal@example.com', CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' });
    await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, emailEnabled: true, mediaEnabled: true }, update: { emailEnabled: true, mediaEnabled: true } });
  });
  afterAll(async () => {
    Object.assign(env, original);
    const users = await db.user.findMany({ where: { email: { endsWith: suffix } }, select: { id: true } }); const ids = users.map((u) => u.id);
    await db.auditRecord.deleteMany({ where: { actorId: { in: ids } } }); await db.accountToken.deleteMany({ where: { OR: [{ userId: { in: ids } }, { targetEmail: { endsWith: suffix } }] } });
    await db.membershipReview.deleteMany({ where: { actorId: { in: ids } } }); await db.membershipApplication.deleteMany({ where: { OR: [{ userId: { in: ids } }, { email: { endsWith: suffix } }] } });
    await db.user.deleteMany({ where: { id: { in: ids } } }); await db.mediaCleanup.deleteMany({ where: { publicId: { startsWith: 'gda-aims/profile-pictures/test-' } } });
    if (previousSettings) await db.platformSettings.update({ where: { id: 1 }, data: previousSettings }); else await db.platformSettings.deleteMany({ where: { id: 1 } });
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });
  it('enforces the API role matrix and scopes every account update to its owner', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'ALUMNI']) {
      expect((await request(app).get('/api/super-admin/settings').set('Cookie', cookies[role]!)).status).toBe(role === 'SUPER_ADMIN' ? 200 : 403);
      expect((await request(app).get('/api/membership/applications').set('Cookie', cookies[role]!)).status).toBe(role === 'ADMIN' ? 200 : 403);
      expect((await request(app).get('/api/admin/alumni').set('Cookie', cookies[role]!)).status).toBe(role === 'ADMIN' ? 200 : 403);
      expect((await request(app).get('/api/account/me').set('Cookie', cookies[role]!)).status).toBe(200);
      expect((await patch('/api/account/profile', role).send({ fullName: 'Updated Name', phone: null, location: null })).status).toBe(200);
      expect((await patch('/api/account/profile', role).send({ fullName: 'Hijack', userId: adminId })).status).toBe(400);
    }
    for (const path of ['/api/requests', '/api/alumni/directory']) expect((await request(app).get(path).set('Cookie', cookies.SUPER_ADMIN!)).status).toBe(403);
    expect((await patch('/api/membership/applications/cm9z2p7es0000l9m86e4w8v1a/review').send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await mutate('/api/auth/register').send({ email: 'attacker' + suffix, password, role: 'SUPER_ADMIN' })).status).toBe(403);
    const response = await request(app).get('/api/account/me').set('Cookie', cookies.SUPER_ADMIN!); expect(JSON.stringify(response.body)).not.toMatch(/tokenHash|api_secret|password/);
  });
  it('provisions Admins through emailed single-use invitations without returning a credential', async () => {
    for (const role of ['ADMIN', 'ALUMNI']) expect((await mutate('/api/super-admin/admins', role).send({ fullName: 'New Admin', email: 'invite' + suffix, currentPassword: password })).status).toBe(403);
    const response = await mutate('/api/super-admin/admins').send({ fullName: 'New Admin', email: 'invite' + suffix, currentPassword: password }); expect(response.status).toBe(201); const token = tokenFromMail();
    expect(JSON.stringify(response.body)).not.toContain(token); expect(await db.user.findUnique({ where: { email: 'invite' + suffix } })).toBeNull();
    const activate = () => request(app).post('/api/account/admin-activate').set('X-GDA-CSRF', '1').send({ token, password, confirmation: password });
    expect((await activate()).status).toBe(201); expect((await activate()).status).toBe(400);
    const login = await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: 'invite' + suffix, password }); expect(login.status).toBe(200); expect(login.body.data.role).toBe('ADMIN');
    expect((await patch('/api/super-admin/settings').send({ currentPassword: password, emailEnabled: false })).status).toBe(200);
    expect((await mutate('/api/super-admin/admins').send({ fullName: 'Blocked Admin', email: 'blocked' + suffix, currentPassword: password })).status).toBe(503);
  });
  it('disables Admins, rejects old JWTs, preserves history and prevents targeting SuperAdmin', async () => {
    expect((await patch(`/api/super-admin/admins/${superId}/disable`).send({ currentPassword: password })).status).toBe(404);
    expect((await patch(`/api/super-admin/admins/${adminId}/disable`).send({ currentPassword: password })).status).toBe(200);
    expect((await request(app).get('/api/account/me').set('Cookie', cookies.ADMIN!)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: 'admin' + suffix, password })).status).toBe(403);
    expect(await db.auditRecord.count({ where: { targetId: adminId, action: 'ADMIN_DISABLED' } })).toBe(1);
    expect((await patch(`/api/super-admin/admins/${adminId}/enable`).send({ currentPassword: password })).status).toBe(200);
    expect((await request(app).get('/api/account/me').set('Cookie', cookies.ADMIN!)).status).toBe(401);
    const { signToken } = await import('../utils/jwt.js'); cookies.ADMIN = `gray_d_allison_token=${signToken({ userId: adminId, role: 'ADMIN', sessionVersion: 2 })}`;
  });
  it('blocks email changes when disabled and preserves the old email when sending fails', async () => {
    await db.platformSettings.update({ where: { id: 1 }, data: { emailEnabled: false } });
    const disabled = await mutate('/api/account/email-change', 'ALUMNI').send({ newEmail: 'changed' + suffix, currentPassword: password }); expect(disabled.status).toBe(503); expect(disabled.body.message).toContain('Email changes are temporarily unavailable');
    await db.platformSettings.update({ where: { id: 1 }, data: { emailEnabled: true } }); mail.sendMail.mockRejectedValue(new Error('Provider secret'));
    expect((await mutate('/api/account/email-change', 'ALUMNI').send({ newEmail: 'changed' + suffix, currentPassword: password })).status).toBe(503);
    expect((await db.user.findUniqueOrThrow({ where: { id: memberId } })).email).toBe('alumni' + suffix);
    expect(await db.accountToken.count({ where: { targetEmail: 'changed' + suffix } })).toBe(0);
  });
  it('verifies email atomically, reserves addresses, rejects expired/replaced/reused tokens and disabled accounts', async () => {
    expect((await mutate('/api/account/email-change', 'ALUMNI').send({ newEmail: 'changed' + suffix, currentPassword: 'wrong' })).status).toBe(403);
    expect((await mutate('/api/account/email-change', 'ALUMNI').send({ newEmail: 'changed' + suffix, currentPassword: password })).status).toBe(200); const first = tokenFromMail();
    expect((await mutate('/api/account/email-change', 'ADMIN').send({ newEmail: 'changed' + suffix, currentPassword: password })).status).toBe(409);
    expect((await db.user.findUniqueOrThrow({ where: { id: memberId } })).email).toBe('alumni' + suffix);
    const verify = (token: string) => request(app).post('/api/account/email-change/verify').set('X-GDA-CSRF', '1').send({ token });
    await db.accountToken.updateMany({ where: { userId: memberId }, data: { expiresAt: new Date(0) } }); expect((await verify(first)).status).toBe(400);
    expect((await mutate('/api/account/email-change', 'ALUMNI').send({ newEmail: 'changed' + suffix, currentPassword: password })).status).toBe(200); const second = tokenFromMail();
    expect((await verify(first)).status).toBe(400);
    await db.user.update({ where: { id: memberId }, data: { isActive: false } }); expect((await verify(second)).status).toBe(403); await db.user.update({ where: { id: memberId }, data: { isActive: true } });
    const responses = await Promise.all([verify(second), verify(second)]); expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await db.user.findUniqueOrThrow({ where: { id: memberId } })).email).toBe('changed' + suffix);
    expect((await request(app).get('/api/account/me').set('Cookie', cookies.ALUMNI!)).status).toBe(401);
    const { signToken } = await import('../utils/jwt.js'); cookies.ALUMNI = `gray_d_allison_token=${signToken({ userId: memberId, role: 'ALUMNI', sessionVersion: 1 })}`;
  });
  it('validates profile image URLs and actual file content, replaces managed images safely', async () => {
    const { cloudMedia, mediaService } = await import('../services/media.service.js');
    const upload = vi.spyOn(cloudMedia, 'upload').mockResolvedValue({ url: 'https://res.cloudinary.com/test/image.webp', publicId: 'gda-aims/profile-pictures/test-one' });
    const destroy = vi.spyOn(cloudMedia, 'destroy').mockResolvedValue(undefined);
    const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'blue' } }).png().toBuffer();
    for (const url of ['http://example.com/image.png', 'javascript:alert(1)', 'data:image/png,test']) expect((await patch('/api/account/profile-image-url', 'ALUMNI').send({ url, version: 0 })).status).toBe(400);
    expect((await request(app).post('/api/account/profile-image').set('Cookie', cookies.ALUMNI!).set('X-GDA-CSRF', '1').field('version', '0').attach('image', Buffer.from('fake'), { filename: 'fake.png', contentType: 'image/png' })).status).toBe(400);
    expect((await request(app).post('/api/account/profile-image').set('Cookie', cookies.ALUMNI!).set('X-GDA-CSRF', '1').field('version', '0').attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' })).status).toBe(400);
    const send = (version: number) => request(app).post('/api/account/profile-image').set('Cookie', cookies.ALUMNI!).set('X-GDA-CSRF', '1').field('version', String(version)).attach('image', bytes, { filename: 'photo.png', contentType: 'image/png' });
    upload.mockRejectedValueOnce(new Error('Cloudinary failed')); expect((await send(0)).status).toBe(502); expect((await db.alumniProfile.findUniqueOrThrow({ where: { userId: memberId } })).profileImage).toBeNull();
    expect((await send(0)).status).toBe(200); expect((await db.alumniProfile.findUniqueOrThrow({ where: { userId: memberId } })).profileImagePublicId).toBe('gda-aims/profile-pictures/test-one');
    upload.mockResolvedValueOnce({ url: 'https://res.cloudinary.com/test/orphan.webp', publicId: 'gda-aims/profile-pictures/test-orphan' });
    expect((await send(0)).status).toBe(409);
    expect((await db.alumniProfile.findUniqueOrThrow({ where: { userId: memberId } })).profileImagePublicId).toBe('gda-aims/profile-pictures/test-one');
    expect((await patch('/api/account/profile-image-url', 'ALUMNI').send({ url: 'https://example.com/profile.png', version: 1 })).status).toBe(200);
    await mediaService.cleanup(); expect(destroy).toHaveBeenCalledWith('gda-aims/profile-pictures/test-one');
    expect((await patch('/api/account/profile-image-url', 'ALUMNI').send({ url: null, version: 1 })).status).toBe(409);
    for (const role of ['SUPER_ADMIN', 'ADMIN']) {
      upload.mockResolvedValueOnce({ url: 'https://res.cloudinary.com/test/staff.webp', publicId: `gda-aims/profile-pictures/test-${role}` });
      const response = await request(app).post('/api/account/profile-image').set('Cookie', cookies[role]!).set('X-GDA-CSRF', '1').field('version', '0').attach('image', bytes, { filename: 'photo.png', contentType: 'image/png' });
      expect(response.status).toBe(200);
    }
    upload.mockRestore(); destroy.mockRestore();
  });
  it('changes passwords, clears the cookie and revokes all existing sessions', async () => {
    const newPassword = 'NewAccountPassword456!';
    expect((await mutate('/api/account/password-change', 'ALUMNI').send({ currentPassword: 'wrong', newPassword, confirmation: newPassword })).status).toBe(403);
    expect((await mutate('/api/account/password-change', 'ALUMNI').send({ currentPassword: password, newPassword: password, confirmation: password })).status).toBe(400);
    const response = await mutate('/api/account/password-change', 'ALUMNI').send({ currentPassword: password, newPassword, confirmation: newPassword }); expect(response.status).toBe(200); expect(response.headers['set-cookie'][0]).toContain('gray_d_allison_token=;');
    expect((await request(app).get('/api/account/me').set('Cookie', cookies.ALUMNI!)).status).toBe(401);
    for (const [value, status] of [[password, 401], [newPassword, 200]] as const) expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: 'changed' + suffix, password: value })).status).toBe(status);
    for (const role of ['SUPER_ADMIN', 'ADMIN']) {
      const [changed, emailRequest] = await Promise.all([
        mutate('/api/account/password-change', role).send({ currentPassword: password, newPassword, confirmation: newPassword }),
        mutate('/api/account/email-change', role).send({ currentPassword: password, newEmail: `pending-${role.toLowerCase()}${suffix}` }),
      ]);
      expect(changed.status).toBe(200); expect([200, 401, 403]).toContain(emailRequest.status);
      const user = await db.user.findUniqueOrThrow({ where: { email: role.toLowerCase() + suffix } });
      expect(await db.accountToken.count({ where: { userId: user.id, purpose: 'EMAIL_CHANGE', consumedAt: null } })).toBe(0);
      expect((await request(app).get('/api/account/me').set('Cookie', cookies[role]!)).status).toBe(401);
      for (const [value, status] of [[password, 401], [newPassword, 200]] as const) expect((await request(app).post('/api/auth/login').set('X-GDA-CSRF', '1').send({ email: role.toLowerCase() + suffix, password: value })).status).toBe(status);
    }
  });
  it('returns the standard JSON response when sensitive public requests are rate-limited', async () => {
    let response: { status: number; body: { success?: boolean; data?: unknown; pagination?: unknown; message?: string } } = { status: 0, body: {} };
    for (let attempt = 0; attempt < 26; attempt++) {
      response = await request(app).post('/api/account/email-change/verify').set('X-GDA-CSRF', '1').send({ token: 'invalid' });
      if (response.status === 429) break;
    }
    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ success: false, data: null, pagination: null });
    expect(response.body.message).toContain('Too many sensitive requests');
  });

});
