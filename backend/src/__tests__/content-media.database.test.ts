import { beforeAll, afterAll, beforeEach, describe, it, expect, vi, type MockInstance } from 'vitest';
import { PrismaClient, type PostType } from '@prisma/client';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });
describe.skipIf(!databaseUrl)('Content images with real authentication, ownership, versions and persistence', () => {
  let db: PrismaClient, app: typeof import('../app.js').app, env: typeof import('../config/env.js').env, original: typeof env;
  let cloud: typeof import('../services/media.service.js').cloudMedia, media: typeof import('../services/media.service.js').mediaService;
  let upload: MockInstance<typeof cloud.upload>, destroy: MockInstance<typeof cloud.destroy>;
  let previousSettings: Awaited<ReturnType<PrismaClient['platformSettings']['findUnique']>>;
  const ids: Record<string, string> = {}, cookies: Record<string, string> = {}, posts: string[] = [], assets: string[] = [];
  const suffix = `@content-media-${Date.now()}.example`;
  let bytes: Buffer;
  const makePost = async (type: PostType, owner = 'ALUMNI', fields = {}) => { const post = await db.post.create({ data: { type, createdBy: ids[owner]!, title: 'Image test content', content: 'Only isolated test data.', ...fields } }); posts.push(post.id); return post; };
  const endpoint = (type: PostType) => type === 'ANNOUNCEMENT' ? '/api/posts/announcements' : type === 'STORY' ? '/api/stories' : type === 'HISTORY' ? '/api/history' : type === 'SCHOOL_LEADER' ? '/api/leadership/school' : type === 'ALUMNI_LEADER' ? '/api/leadership/alumni' : '/api/events';
  const send = (type: PostType, id: string, role = 'ALUMNI', version = 0, data = bytes) => request(app).post(`${endpoint(type)}/${id}/image`).set('Cookie', cookies[role] ?? '').set('X-GDA-CSRF', '1').field('version', String(version)).attach('image', data, { filename: 'photo.png', contentType: 'image/png' });
  function asset(prefix: string) { const publicId = prefix + randomUUID(); assets.push(publicId); return { publicId, url: `https://res.cloudinary.com/test/image/upload/v123/${publicId}.webp` }; }
  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: databaseUrl }); ({ app } = await import('../app.js')); ({ env } = await import('../config/env.js')); original = { ...env };
    ({ cloudMedia: cloud, mediaService: media } = await import('../services/media.service.js'));
    previousSettings = await db.platformSettings.findUnique({ where: { id: 1 } });
    const { signToken } = await import('../utils/jwt.js');
    for (const name of ['ADMIN', 'SUPER_ADMIN', 'ALUMNI', 'OTHER']) {
      const role = name === 'OTHER' ? 'ALUMNI' : name as 'ADMIN' | 'SUPER_ADMIN' | 'ALUMNI';
      const user = await db.user.create({ data: { email: name.toLowerCase() + suffix, password: 'unusable-test-hash', role,
        ...(role === 'ALUMNI' ? { alumniProfile: { create: { fullName: name } }, membershipApplication: { create: { reference: name + suffix, email: name.toLowerCase() + suffix, fullName: name, trackingHash: 'fixture', phone: '123456789', graduationYear: 2005, status: 'APPROVED', activatedAt: new Date() } } } : {}) } });
      ids[name] = user.id; cookies[name] = `gray_d_allison_token=${signToken({ userId: user.id, role, sessionVersion: 0 })}`;
    }
    bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'blue' } }).png().toBuffer();
    upload = vi.spyOn(cloud, 'upload'); destroy = vi.spyOn(cloud, 'destroy').mockResolvedValue(undefined);
  });
  beforeEach(async () => {
    Object.assign(env, { ...original, CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' });
    upload.mockReset(); upload.mockImplementation(async (_buffer: Buffer, prefix = 'gda-aims/profile-pictures/') => asset(prefix)); destroy.mockClear();
    await db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, mediaEnabled: true }, update: { mediaEnabled: true } });
  });
  afterAll(async () => {
    await media.cleanup(); upload.mockRestore(); destroy.mockRestore(); Object.assign(env, original);
    await db.post.deleteMany({ where: { id: { in: posts } } }); await db.mediaCleanup.deleteMany({ where: { publicId: { in: assets } } });
    await db.membershipApplication.deleteMany({ where: { userId: { in: Object.values(ids) } } }); await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    if (previousSettings) await db.platformSettings.update({ where: { id: 1 }, data: previousSettings }); else await db.platformSettings.deleteMany({ where: { id: 1 } });
    await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect();
  });
  it('accepts Admin uploads for every content kind and only owned alumni stories; denies SuperAdmin and anonymous users', async () => {
    for (const type of ['ANNOUNCEMENT', 'STORY', 'EVENT', 'HISTORY', 'SCHOOL_LEADER', 'ALUMNI_LEADER'] as const) {
      const post = await makePost(type, 'ADMIN');
      expect((await send(type, post.id, 'SUPER_ADMIN')).status).toBe(403);
      expect((await send(type, post.id, 'ALUMNI')).status).toBe(403);
      expect((await send(type, post.id, 'ANONYMOUS')).status).toBe(401);
      const response = await send(type, post.id, 'ADMIN'); expect(response.status).toBe(200); expect(response.body.data.image).toMatch(/^https:\/\/res\.cloudinary\.com/);
    }
    const story = await makePost('STORY', 'ALUMNI', { isPublished: true, publishedAt: new Date() });
    expect((await send('STORY', story.id, 'OTHER')).status).toBe(403);
    const response = await send('STORY', story.id); expect(response.status).toBe(200); expect(response.body.data.isPublished).toBe(false); expect(response.body.data.version).toBe(1);
    expect((await sharp(upload.mock.calls.at(-1)![0]).metadata()).format).toBe('webp');
  });
  it('rejects fake files, stale versions and disabled configuration, and leaves saved content intact on provider failure', async () => {
    const post = await makePost('STORY');
    expect((await send('STORY', post.id, 'ALUMNI', 0, Buffer.from('fake'))).status).toBe(400); expect(upload).not.toHaveBeenCalled();
    expect((await send('STORY', post.id, 'ALUMNI', 9)).status).toBe(409); expect(upload).not.toHaveBeenCalled();
    await db.platformSettings.update({ where: { id: 1 }, data: { mediaEnabled: false } }); expect((await send('STORY', post.id)).status).toBe(503);
    await db.platformSettings.update({ where: { id: 1 }, data: { mediaEnabled: true } }); upload.mockRejectedValueOnce(new Error('Provider failure'));
    expect((await send('STORY', post.id)).status).toBe(502); expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).image).toBeNull();
  });
  it('cleans replaced/deleted managed images while preserving assets referenced from another post', async () => {
    const post = await makePost('STORY'); const first = await send('STORY', post.id); expect(first.status).toBe(200);
    const publicId = assets.at(-1)!;
    const copied = await makePost('STORY', 'OTHER', { image: first.body.data.image });
    expect((await request(app).delete(`/api/stories/${copied.id}`).set('Cookie', cookies.OTHER!).set('X-GDA-CSRF', '1').query({ version: 0 })).status).toBe(200);
    await media.cleanup(); expect(destroy).not.toHaveBeenCalledWith(publicId);
    expect((await request(app).patch(`/api/stories/${post.id}`).set('Cookie', cookies.ALUMNI!).set('X-GDA-CSRF', '1').send({ image: 'https://example.test/photo.png', version: 1 })).status).toBe(200);
    await media.cleanup(); expect(destroy).toHaveBeenCalledWith(publicId);
    const next = await send('STORY', post.id, 'ALUMNI', 2); expect(next.status).toBe(200); const nextId = assets.at(-1)!;
    expect((await request(app).delete(`/api/stories/${post.id}`).set('Cookie', cookies.ALUMNI!).set('X-GDA-CSRF', '1').query({ version: 3 })).status).toBe(200); await media.cleanup(); expect(destroy).toHaveBeenCalledWith(nextId);
  });
  it('lets exactly one concurrent image update win and cleans the unused provider asset', async () => {
    const post = await makePost('STORY'); let arrived = 0; let release!: () => void; const both = new Promise<void>(resolve => { release = resolve; });
    upload.mockImplementation(async (_buffer: Buffer, prefix = 'gda-aims/profile-pictures/') => { const result = asset(prefix); if (++arrived === 2) release(); await both; return result; });
    const responses = await Promise.all([send('STORY', post.id), send('STORY', post.id)]); expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    await media.cleanup(); const saved = await db.post.findUniqueOrThrow({ where: { id: post.id } }); expect(saved.version).toBe(1);
    const losers = assets.slice(-2).filter(id => !saved.image!.includes(id)); expect(losers).toHaveLength(1); expect(destroy).toHaveBeenCalledWith(losers[0]);
  });
  it('rejects an account disabled during the provider call and cleans the new asset', async () => {
    const post = await makePost('STORY'); upload.mockImplementationOnce(async (_buffer: Buffer, prefix = 'gda-aims/profile-pictures/') => { await db.user.update({ where: { id: ids.ALUMNI }, data: { isActive: false } }); return asset(prefix); });
    try { expect((await send('STORY', post.id)).status).toBe(401); expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).image).toBeNull(); await media.cleanup(); expect(destroy).toHaveBeenCalledWith(assets.at(-1)); }
    finally { await db.user.update({ where: { id: ids.ALUMNI }, data: { isActive: true } }); }
  });
});
