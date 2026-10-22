import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { managedImagePrefix } from '../utils/content-image';

export const localMediaRoot = resolve(env.MEDIA_UPLOAD_DIR ?? 'uploads');
export const localMediaOrigin = () => new URL(env.MEDIA_PUBLIC_ORIGIN ?? `http://localhost:${env.PORT}`).origin;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export function localAssetPath(asset: string): boolean {
  return new RegExp(`^gda-aims/(profile-pictures/|content-images/c[a-z0-9]{24}/)${uuid}\\.webp$`).test(asset);
}
export const localMedia = {
  async upload(buffer: Buffer, prefix: string) {
    if (!managedImagePrefix(prefix)) throw new Error('Invalid image destination');
    const asset = `${prefix}${randomUUID()}`;
    const destination = resolve(localMediaRoot, `${asset}.webp`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: 'wx', mode: 0o644 });
    return { publicId: `local/${asset}`, url: `${localMediaOrigin()}/api/media/images/${asset}.webp` };
  },
  async destroy(publicId: string) {
    if (!publicId.startsWith('local/') || !localAssetPath(`${publicId.slice(6)}.webp`)) throw new Error('Invalid local image identifier');
    try { await unlink(resolve(localMediaRoot, `${publicId.slice(6)}.webp`)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  },
};
