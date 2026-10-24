import { prisma } from '../config/prisma';
import { randomUUID } from 'node:crypto';
export const mediaRepository = {
  queue(publicId: string) { return prisma.mediaCleanup.upsert({ where: { publicId }, create: { publicId }, update: {} }); },
  pending() { return prisma.mediaCleanup.findMany({ take: 10, orderBy: { createdAt: 'asc' } }); },
  done(id: string) { return prisma.mediaCleanup.delete({ where: { id } }); },
  async claim() {
    const leaseToken = randomUUID();
    return prisma.$queryRaw<{ id: string; publicId: string; attempts: number; leaseToken: string }[]>`
      UPDATE "MediaCleanup" SET "leaseToken" = ${leaseToken}, "leaseUntil" = CURRENT_TIMESTAMP + INTERVAL '2 minutes'
      WHERE id IN (SELECT id FROM "MediaCleanup"
        WHERE "nextAttemptAt" <= CURRENT_TIMESTAMP AND ("leaseUntil" IS NULL OR "leaseUntil" < CURRENT_TIMESTAMP)
        ORDER BY "nextAttemptAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 3)
      RETURNING id, "publicId", attempts, "leaseToken"`;
  },
  complete(id: string, leaseToken: string) { return prisma.mediaCleanup.deleteMany({ where: { id, leaseToken } }); },
  retry(id: string, leaseToken: string, attempts: number) {
    return prisma.mediaCleanup.updateMany({ where: { id, leaseToken }, data: {
      attempts: { increment: 1 }, leaseToken: null, leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + Math.min(86400000, 60000 * 2 ** Math.min(attempts, 11))),
    } });
  },
};
