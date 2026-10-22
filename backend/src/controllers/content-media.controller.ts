import type { RequestHandler } from 'express';
import type { PostType } from '@prisma/client';
import { contentMediaService } from '../services/content-media.service';
import { sendSuccess } from '../utils/api-response';
export function uploadContentImage(type: PostType): RequestHandler {
  return async (req, res, next) => {
    try { return sendSuccess(res, 200, 'Content image saved', await contentMediaService.upload(type, req.user!, req.params.id as string, req.file, req.body.version)); }
    catch (error) { next(error); }
  };
}
