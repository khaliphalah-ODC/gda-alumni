import type { RequestHandler } from 'express';
import { alumniService } from '../services/alumni.service';
import { sendSuccess } from '../utils/api-response';

export const getProfile: RequestHandler = async (request, response, next) => {
  try {
    const profile = await alumniService.getOwnProfile(request.user!.userId);
    return sendSuccess(response, 200, 'Alumni profile retrieved successfully', profile);
  } catch (error) { next(error); }
};

export const updateProfile: RequestHandler = async (request, response, next) => {
  try {
    const profile = await alumniService.updateOwnProfile(request.user!.userId, request.body);
    return sendSuccess(response, 200, 'Alumni profile saved successfully', profile);
  } catch (error) { next(error); }
};

export const listDirectory: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit, search, graduationYear } = req.query as unknown as { page: number; limit: number; search?: string; graduationYear?: number };
    const result = await alumniService.directory(page, limit, search, graduationYear);
    return sendSuccess(res, 200, 'Alumni directory retrieved', result.alumni, result.pagination);
  } catch (e) { next(e); }
};
export const directoryDetail: RequestHandler = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Alumni member retrieved', await alumniService.directoryDetail(req.params.id as string)); } catch (e) { next(e); }
};
export const dashboard: RequestHandler = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Alumni dashboard retrieved', await alumniService.dashboard(req.user!.userId)); } catch (e) { next(e); }
};
