import { env } from '../config/env';

export const MAX_IMAGE_FILE_SIZE = env.IMAGE_MAX_BYTES;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
