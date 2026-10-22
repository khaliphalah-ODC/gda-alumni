import { localMediaOrigin } from './local-media';
import type { PostType } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import { contentService } from './content.service';
import { cloudMedia, mediaService } from './media.service';
import { mediaRepository } from '../repositories/media.repository';
import { contentImagePrefix, managedContentImageId } from '../utils/content-image';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';
export const contentMediaService = {
  async upload(type: PostType, actor: AuthenticatedUser, id: string, file: Express.Multer.File | undefined, version: number) {
    // Authorize before allocating provider storage, including draft ownership.
    await contentService.editable(type, actor, id, version);
    if (!(await mediaService.status()).enabled) throw new AppError(503, 'Image uploads are unavailable. You can use an image URL instead');
    const buffer = await mediaService.prepareImage(file);
    let uploaded: Awaited<ReturnType<typeof cloudMedia.upload>>;
    try { uploaded = await cloudMedia.upload(buffer, contentImagePrefix(id)); }
    catch { throw new AppError(502, 'Image upload failed. Please try again'); }
    if (managedContentImageId(uploaded.url, id, env.CLOUDINARY_CLOUD_NAME, localMediaOrigin()) !== uploaded.publicId) {
      const prefix = `${uploaded.publicId.startsWith('local/') ? 'local/' : ''}${contentImagePrefix(id)}`;
      if (uploaded.publicId.startsWith(prefix) && /^[0-9a-f-]{36}$/.test(uploaded.publicId.slice(prefix.length))) {
        await mediaRepository.queue(uploaded.publicId); void mediaService.cleanup().catch(() => {});
      }
      throw new AppError(502, 'Image provider returned an invalid asset');
    }
    try {
      // Normal update policy retains version checks and unpublishes alumni edits.
      const post = await contentService.update(type, actor, id, { image: uploaded.url, version });
      void mediaService.cleanup().catch(() => {});
      return post;
    } catch (error) {
      await mediaRepository.queue(uploaded.publicId);
      void mediaService.cleanup().catch(() => {});
      throw error;
    }
  },
};
