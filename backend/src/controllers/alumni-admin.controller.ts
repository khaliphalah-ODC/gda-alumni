import type { RequestHandler } from 'express';
import { alumniAdminService } from '../services/alumni-admin.service';
import { sendSuccess } from '../utils/api-response';
import { getPagination } from '../utils/pagination';
export const list: RequestHandler = async (req, res, next) => { try { const { page, search, active, graduationYear } = req.query as unknown as { page: number; search: string; active?: string; graduationYear?: number }; const result = await alumniAdminService.list(req.user!, page, search, active === undefined ? undefined : active === 'true', graduationYear); return sendSuccess(res, 200, 'Alumni accounts', result.users, getPagination(page, 12, result.total)); } catch (e) { next(e); } };
export const setActive = (active: boolean): RequestHandler => async (req, res, next) => { try { await alumniAdminService.update(req.user!, req.params.id as string, req.body.currentPassword, active); return sendSuccess(res, 200, active ? 'Alumni enabled' : 'Alumni disabled; sessions revoked', null); } catch (e) { next(e); } };
