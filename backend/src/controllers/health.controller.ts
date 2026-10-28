import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { healthRepository } from '../repositories/health.repository';
import { sendError, sendSuccess } from '../utils/api-response';
import { emailConfiguration } from '../services/email.service';
export const readiness: RequestHandler = async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([healthRepository.checkDatabase(), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Readiness timeout')), 10000); })]);
    if (env.NODE_ENV === 'production' && !emailConfiguration().configured) return sendError(res, 503, 'Invitation delivery must be configured before production release');
    return sendSuccess(res, 200, 'API is ready', { database: 'connected' });
  } catch { return sendError(res, 503, 'Database readiness check failed. Verify database connectivity and apply the required migrations.'); }
  finally { if (timer) clearTimeout(timer); }
};
