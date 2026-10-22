import type { RequestHandler } from 'express';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/api-response';
export const dashboard: RequestHandler = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Administrator dashboard retrieved', await adminService.dashboard(req.user!)); } catch (e) { next(e); }
};
