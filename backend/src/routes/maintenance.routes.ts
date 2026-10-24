import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { mediaService } from '../services/media.service';
import { sendError, sendSuccess } from '../utils/api-response';

export const maintenanceRouter = Router();
maintenanceRouter.get('/maintenance', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const provided = Buffer.from(req.get('Authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ''}`);
  if (!env.CRON_SECRET || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return sendError(res, 401, 'Unauthorized');
  try {
    // Bounded batches drain more than three jobs per daily Hobby invocation.
    // Stop with room for a provider timeout and the final database writes.
    const deadline = Date.now() + 35000;
    const drain = async () => {
      const total = { processed: 0, deleted: 0, deferred: 0 };
      do {
        const batch = await mediaService.cleanup();
        total.processed += batch.processed; total.deleted += batch.deleted; total.deferred += batch.deferred;
        if (batch.processed < 3) break;
      } while (Date.now() < deadline && total.processed < 90);
      return { ...total, remaining: await prisma.mediaCleanup.count() };
    };
    const [media, buckets, tokens] = await Promise.all([
      drain(),
      prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } }),
      prisma.accountToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400000) } } }),
    ]);
    return sendSuccess(res, 200, 'Maintenance completed', { media, expiredRateBuckets: buckets.count, expiredTokens: tokens.count });
  } catch (error) { next(error); }
});
