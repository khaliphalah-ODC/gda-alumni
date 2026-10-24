import sharp from 'sharp';
import { managedImagePrefix } from '../utils/content-image';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { platformRepository } from '../repositories/platform.repository';
import { accountRepository } from '../repositories/account.repository';
import { mediaRepository } from '../repositories/media.repository';
import type { AuthenticatedUser } from '../types/auth.types';
import { AppError } from '../utils/app-error';
import { localMedia, localAssetPath } from './local-media';
import { background } from '../utils/background';
const folder = 'gda-aims/profile-pictures/';
function configure() { cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true, timeout: 10000 }); }
export const cloudMedia = {
  upload(buffer: Buffer, prefix = folder): Promise<{ url: string; publicId: string }> {
    if (!managedImagePrefix(prefix)) return Promise.reject(new AppError(400, 'Invalid image destination'));
    if (env.MEDIA_STORAGE === 'local') return localMedia.upload(buffer, prefix);
    configure();
    const publicId = `${prefix}${randomUUID()}`;
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: 'image', overwrite: false, timeout: 20000 }, (error, result) => {
        if (error || !result || !result.secure_url.startsWith('https://') || result.public_id !== publicId) return reject(new AppError(502, 'Image upload failed. Please try again'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }).end(buffer);
    });
  },
  async destroy(publicId: string) {
    if (publicId.startsWith('local/')) return localMedia.destroy(publicId);
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary cleanup requires credentials');
    configure(); const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true }); if (!['ok', 'not found'].includes(result.result)) throw new Error('Cleanup failed');
  },
};
export function mediaConfiguration() {
  return { provider: env.MEDIA_STORAGE, configured: env.MEDIA_STORAGE === 'local' || Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), maxBytes: env.IMAGE_MAX_BYTES, formats: ['JPEG', 'PNG', 'WebP'], status: env.MEDIA_STORAGE === 'local' ? 'Images are stored on the API server. Hosting requires a persistent disk and backups.' : 'Not externally verified' };
}
export const mediaService = {
  async status() { const settings = await platformRepository.settings(); const config = mediaConfiguration(); return { enabled: Boolean(settings?.mediaEnabled && config.configured), maxBytes: config.maxBytes, provider: config.provider }; },
  async cleanup() {
    const jobs = await mediaRepository.claim();
    const results = await Promise.all(jobs.map(async job => {
      try {
        if (job.publicId.startsWith('local/') ? !localAssetPath(`${job.publicId.slice(6)}.webp`) : !(/^gda-aims\/profile-pictures\/[A-Za-z0-9_-]{1,200}$/.test(job.publicId) || /^gda-aims\/content-images\/c[a-z0-9]{24}\/[0-9a-f-]{36}$/.test(job.publicId))) throw new Error('Invalid managed asset');
        await cloudMedia.destroy(job.publicId); await mediaRepository.complete(job.id, job.leaseToken); return true;
      } catch { await mediaRepository.retry(job.id, job.leaseToken, job.attempts); return false; }
    }));
    return { processed: jobs.length, deleted: results.filter(Boolean).length, deferred: results.filter(value => !value).length };
  },
  async prepareImage(file: Express.Multer.File | undefined): Promise<Buffer> {
    if (!file || file.size > env.IMAGE_MAX_BYTES) throw new AppError(400, 'Choose an image within the upload size limit');
    let buffer: Buffer;
    try {
      const source = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning', animated: false });
      const metadata = await source.metadata();
      const mime = ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[metadata.format ?? ''];
      if (!mime || file.mimetype !== mime || (metadata.pages ?? 1) > 1) throw new Error('Invalid format');
      buffer = await source.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new AppError(400, 'Choose a valid, uncorrupted JPEG, PNG or WebP image'); }
    return buffer;
  },
  async upload(actor: AuthenticatedUser, file: Express.Multer.File | undefined, version: number) {
    if (!(await this.status()).enabled) throw new AppError(503, 'Image uploads are unavailable. You can use an HTTPS image URL instead');
    const buffer = await this.prepareImage(file);
    if (!await accountRepository.image(actor.userId, actor.role)) throw new AppError(400, 'Save your personal profile first');
    let uploaded: { url: string; publicId: string };
    try { uploaded = await cloudMedia.upload(buffer); } catch { throw new AppError(502, 'Image upload failed. Please try again'); }
    try { await accountRepository.saveImage(actor.userId, actor.role, version, actor.sessionVersion ?? 0, uploaded.url, uploaded.publicId); }
    catch (error) { await mediaRepository.queue(uploaded.publicId); background(this.cleanup()); throw error; }
    background(this.cleanup());
  },
  async url(actor: AuthenticatedUser, url: string | null, version: number) {
    await accountRepository.saveImage(actor.userId, actor.role, version, actor.sessionVersion ?? 0, url, null);
    background(this.cleanup());
  },
};
