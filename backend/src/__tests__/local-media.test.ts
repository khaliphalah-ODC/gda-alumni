import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm, stat } from 'node:fs/promises';
import sharp from 'sharp';
import request from 'supertest';
const state = vi.hoisted(() => {
  process.env.MEDIA_STORAGE = 'local';
  process.env.MEDIA_UPLOAD_DIR = `/tmp/gda-local-media-${process.pid}-${Date.now()}`;
  process.env.MEDIA_PUBLIC_ORIGIN = 'http://localhost:5000';
  return { actor: null as null | { userId: string; role: 'ADMIN' | 'SUPER_ADMIN' | 'ALUMNI' | 'STUDENT' } };
});
vi.mock('../repositories/platform.repository', () => ({ platformRepository: { settings: vi.fn().mockResolvedValue({ mediaEnabled: true }) } }));
vi.mock('../repositories/account.repository', () => ({ accountRepository: { image: vi.fn().mockResolvedValue({}), saveImage: vi.fn() } }));
vi.mock('../repositories/media.repository', () => ({ mediaRepository: { pending: vi.fn().mockResolvedValue([]), claim: vi.fn().mockResolvedValue([]), complete: vi.fn(), retry: vi.fn(), queue: vi.fn(), done: vi.fn() } }));
vi.mock('../middleware/auth.middleware', async () => {
  const { AppError } = await import('../utils/app-error.js');
  return {
    requireAuth: ((req, _res, next) => { if (!state.actor) return next(new AppError(401, 'Sign in')); req.user = state.actor; next(); }) as import('express').RequestHandler,
    optionalAuth: ((_req, _res, next) => next()) as import('express').RequestHandler,
  };
});
import { app } from '../app';
import { env } from '../config/env';
import { cloudMedia, mediaService } from '../services/media.service';
import { localMedia, localMediaRoot } from '../services/local-media';
import { accountRepository } from '../repositories/account.repository';
import { mediaRepository } from '../repositories/media.repository';
import { platformRepository } from '../repositories/platform.repository';
import { contentImagePrefix, managedContentImageId } from '../utils/content-image';

beforeEach(() => { state.actor = null; vi.mocked(platformRepository.settings).mockResolvedValue({ mediaEnabled: true } as Awaited<ReturnType<typeof platformRepository.settings>>); vi.mocked(accountRepository.saveImage).mockReset(); });
afterAll(async () => { await rm(localMediaRoot, { recursive: true, force: true }); });
describe('server image storage', () => {
  it('processes, stores, serves and deletes an image without Cloudinary', async () => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
    const buffer = await mediaService.prepareImage({ buffer: input, size: input.length, mimetype: 'image/png' } as Express.Multer.File);
    expect((await sharp(buffer).metadata()).format).toBe('webp');
    const saved = await cloudMedia.upload(buffer);
    expect(saved.publicId).toMatch(/^local\/gda-aims\/profile-pictures\//);
    expect(await readFile(`${localMediaRoot}/${saved.publicId.slice(6)}.webp`)).toEqual(buffer);
    const response = await request(app).get(new URL(saved.url).pathname);
    expect(response.status).toBe(200); expect(response.headers['content-type']).toMatch(/^image\/webp/);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    await cloudMedia.destroy(saved.publicId);
    expect((await request(app).get(new URL(saved.url).pathname)).status).toBe(404);
    await cloudMedia.destroy(saved.publicId);
  });
  it('keeps uploads behind the platform switch and rejects corrupt images', async () => {
    expect((await mediaService.status()).enabled).toBe(true);
    vi.mocked(platformRepository.settings).mockResolvedValue({ mediaEnabled: false } as Awaited<ReturnType<typeof platformRepository.settings>>);
    expect((await mediaService.status()).enabled).toBe(false);
    await expect(mediaService.upload({ userId: 'test', role: 'ADMIN' }, undefined, 0)).rejects.toMatchObject({ statusCode: 503 });
    await expect(mediaService.prepareImage({ buffer: Buffer.from('not an image'), size: 12, mimetype: 'image/png' } as Express.Multer.File)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('explains missing storage separately from a disabled platform switch', async () => {
    const previous = { ...env };
    try {
      expect((await mediaService.status()).unavailableReason).toBeNull();
      env.MEDIA_STORAGE = 'cloudinary'; env.CLOUDINARY_CLOUD_NAME = undefined; env.CLOUDINARY_API_KEY = undefined; env.CLOUDINARY_API_SECRET = undefined;
      expect(await mediaService.status()).toMatchObject({ enabled: false, provider: 'cloudinary', unavailableReason: expect.stringContaining('storage is not configured') });
      env.CLOUDINARY_CLOUD_NAME = 'fixture'; env.CLOUDINARY_API_KEY = 'fixture'; env.CLOUDINARY_API_SECRET = 'fixture';
      vi.mocked(platformRepository.settings).mockResolvedValue({ mediaEnabled: false } as Awaited<ReturnType<typeof platformRepository.settings>>);
      expect(await mediaService.status()).toMatchObject({ enabled: false, unavailableReason: expect.stringContaining('disabled in Platform settings') });
      vi.mocked(platformRepository.settings).mockResolvedValue({ mediaEnabled: true } as Awaited<ReturnType<typeof platformRepository.settings>>);
      expect(await mediaService.status()).toMatchObject({ enabled: true, unavailableReason: null });
    } finally { Object.assign(env, previous); }
  });
  it('queues local assets for cleanup when saving the profile fails', async () => {
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
    vi.mocked(accountRepository.saveImage).mockRejectedValueOnce(new Error('Conflicting version'));
    await expect(mediaService.upload({ userId: 'test', role: 'ADMIN' }, { buffer: input, size: input.length, mimetype: 'image/png' } as Express.Multer.File, 0)).rejects.toThrow('Conflicting version');
    const publicId = vi.mocked(mediaRepository.queue).mock.calls.at(-1)![0];
    expect(publicId.startsWith('local/')).toBe(true);
    vi.mocked(mediaRepository.claim).mockResolvedValueOnce([{ id: 'job', publicId, attempts: 0, leaseToken: 'lease' }]);
    await mediaService.cleanup();
    await expect(stat(`${localMediaRoot}/${publicId.slice(6)}.webp`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('limits managed content images to their owning post and configured origin', async () => {
    const id = 'c123456789012345678901234', other = 'c987654321098765432109876';
    const image = await localMedia.upload(Buffer.from('test'), contentImagePrefix(id));
    expect(managedContentImageId(image.url, id, undefined, 'http://localhost:5000')).toBe(image.publicId);
    for (const url of [image.url.replace('localhost', 'example.test'), image.url + '?other=1', image.url + '#other']) expect(managedContentImageId(url, id, undefined, 'http://localhost:5000')).toBeUndefined();
    expect(managedContentImageId(image.url, other, undefined, 'http://localhost:5000')).toBeUndefined();
    await expect(localMedia.upload(Buffer.from('test'), '../')).rejects.toThrow();
    await expect(localMedia.destroy('local/../../.env')).rejects.toThrow();
    expect((await request(app).get('/api/media/images/.env')).status).toBe(404);
    expect((await request(app).get('/api/media/images/')).status).toBe(404);
  });
});
describe('Admin membership sharing access', () => {
  it('returns the configured public form URL only to Admin', async () => {
    expect((await request(app).get('/api/membership/access')).status).toBe(401);
    for (const role of ['SUPER_ADMIN', 'ALUMNI', 'STUDENT'] as const) {
      state.actor = { userId: 'test', role };
      expect((await request(app).get('/api/membership/access')).status).toBe(403);
    }
    state.actor = { userId: 'test', role: 'ADMIN' };
    const response = await request(app).get('/api/membership/access');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ url: `${env.FRONTEND_ORIGIN}/register` });
  });
});
