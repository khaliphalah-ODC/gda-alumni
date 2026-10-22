import type { PostType } from '@prisma/client';
import type { RequestHandler } from 'express';
import { contentService } from '../services/content.service';
import { sendSuccess } from '../utils/api-response';
export function contentHandlers(type: PostType) {
  const detail: RequestHandler = async (req, res, next) => { try { return sendSuccess(res, 200, 'Content retrieved', await contentService.detail(type, req.params.id as string, req.user)); } catch (e) { next(e); } };
  const update: RequestHandler = async (req, res, next) => { try { return sendSuccess(res, 200, 'Content updated', await contentService.update(type, req.user!, req.params.id as string, req.body)); } catch (e) { next(e); } };
  const remove: RequestHandler = async (req, res, next) => { try { await contentService.remove(type, req.user!, req.params.id as string, req.query.version === undefined ? undefined : Number(req.query.version)); return sendSuccess(res, 200, 'Content deleted', null); } catch (e) { next(e); } };
  const publication = (published: boolean): RequestHandler => async (req, res, next) => { try { return sendSuccess(res, 200, published ? 'Content published' : 'Content unpublished', await contentService.publication(type, req.user!, req.params.id as string, published, req.body.version)); } catch (e) { next(e); } };
  return { detail, update, remove, publish: publication(true), unpublish: publication(false) };
}
