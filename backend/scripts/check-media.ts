import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { cloudMedia, mediaService, mediaConfiguration } from '../src/services/media.service';

class MediaCheckError extends Error {}

async function main() {
  if (!mediaConfiguration().configured) throw new MediaCheckError('Configure server storage or Cloudinary on the API server, then restart it.');
  if (env.MEDIA_STORAGE === 'cloudinary') {
    cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true, timeout: 10000 });
    await cloudinary.api.ping();
    console.log('Cloudinary authentication verified.');
  } else console.log('Server storage selected; --upload verifies writing and deleting a temporary image.');
  const status = await mediaService.status();
  if (!status.enabled) throw new MediaCheckError('Image storage is configured, but uploads are disabled. Enable image uploads in SuperAdmin > Platform settings.');
  console.log(`Platform uploads enabled; maximum ${status.maxBytes / 1024 / 1024} MB.`);
  if (process.argv.includes('--upload')) {
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } }).webp().toBuffer();
    const image = await cloudMedia.upload(buffer);
    try { console.log('Temporary image upload verified.'); }
    finally { await cloudMedia.destroy(image.publicId); console.log('Temporary diagnostic image deleted.'); }
  }
}
main().catch((error: unknown) => {
  if (error instanceof MediaCheckError) console.error(error.message);
  else console.error('Image storage check failed. Verify storage permissions or provider credentials and connectivity. No credentials were logged.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
