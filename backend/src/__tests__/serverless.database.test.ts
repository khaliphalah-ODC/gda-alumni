import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (databaseUrl) { const url = new URL(databaseUrl); if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/gda_phase1_test') throw new Error('Use isolated local gda_phase1_test'); process.env.DATABASE_URL = databaseUrl; }
vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });
describe.skipIf(!databaseUrl)('Shared rate counters and leased maintenance', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasourceUrl: databaseUrl }); });
  afterAll(async () => { await db.rateLimitBucket.deleteMany(); await db.mediaCleanup.deleteMany(); await db.$disconnect(); const { prisma } = await import('../config/prisma.js'); await prisma.$disconnect(); });
  it('shares atomic increments across independent store instances and expires a window', async () => {
    const { DatabaseRateLimitStore } = await import('../utils/shared-rate-limit.js');
    const scope = 'fixture-' + randomUUID(), first = new DatabaseRateLimitStore(scope), second = new DatabaseRateLimitStore(scope);
    const results = await Promise.all(Array.from({ length: 16 }, (_, index) => (index % 2 ? first : second).increment('198.51.100.10')));
    expect(results.map(result => result.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const row = await db.rateLimitBucket.findFirstOrThrow({ where: { key: { startsWith: scope } } }); expect(row.key).not.toContain('198.51.100.10');
    await db.rateLimitBucket.update({ where: { key: row.key }, data: { resetAt: new Date(0) } }); expect((await second.increment('198.51.100.10')).totalHits).toBe(1);
    await first.resetKey('198.51.100.10'); expect(await db.rateLimitBucket.count({ where: { key: { startsWith: scope } } })).toBe(0);
  });
  it('normalizes IPv4-mapped addresses and groups equivalent IPv6 subnets', async () => {
    const { clientIpKey } = await import('../utils/shared-rate-limit.js');
    expect(clientIpKey('::ffff:192.0.2.8')).toBe('192.0.2.8');
    expect(clientIpKey('2001:db8:abcd:1234::1')).toBe(clientIpKey('2001:0db8:abcd:12ff:0000:0000:0000:0002'));
    expect(clientIpKey('2001:db8:abcd:1234::1')).not.toBe(clientIpKey('2001:db8:abce:1234::1'));
  });
  it('does not lease the same job twice and rejects a stale worker acknowledgement', async () => {
    const { mediaRepository } = await import('../repositories/media.repository.js'); await db.mediaCleanup.deleteMany();
    await db.mediaCleanup.createMany({ data: Array.from({ length: 5 }, () => ({ publicId: `gda-aims/profile-pictures/${randomUUID()}` })) });
    const [first, second] = await Promise.all([mediaRepository.claim(), mediaRepository.claim()]);
    expect(new Set([...first, ...second].map(job => job.id)).size).toBe(5);
    const job = first[0]; await db.mediaCleanup.update({ where: { id: job.id }, data: { leaseUntil: new Date(0) } });
    const [reclaimed] = await mediaRepository.claim(); expect(reclaimed.id).toBe(job.id); expect(reclaimed.leaseToken).not.toBe(job.leaseToken);
    expect((await mediaRepository.complete(job.id, job.leaseToken)).count).toBe(0);
    await mediaRepository.retry(job.id, reclaimed.leaseToken, 0); const retry = await db.mediaCleanup.findUniqueOrThrow({ where: { id: job.id } });
    expect(retry.attempts).toBe(1); expect(retry.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()); expect(retry.leaseToken).toBeNull();
  });
  it('retains failed deletions, backs off, then removes the job after a successful retry', async () => {
    const { mediaService, cloudMedia } = await import('../services/media.service.js'); await db.mediaCleanup.deleteMany();
    const job = await db.mediaCleanup.create({ data: { publicId: `gda-aims/profile-pictures/${randomUUID()}` } });
    const destroy = vi.spyOn(cloudMedia, 'destroy').mockRejectedValueOnce(new Error('Private provider failure')).mockResolvedValue(undefined);
    try {
      expect((await mediaService.cleanup()).deferred).toBe(1); expect((await db.mediaCleanup.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(1);
      expect((await mediaService.cleanup()).processed).toBe(0);
      await db.mediaCleanup.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
      expect((await mediaService.cleanup()).deleted).toBe(1); expect(await db.mediaCleanup.findUnique({ where: { id: job.id } })).toBeNull();
    } finally { destroy.mockRestore(); }
  });
  it('authenticates cron requests and prunes expired counters without removing active ones', async () => {
    const { app } = await import('../app.js'); const { env } = await import('../config/env.js'); const previous = env.CRON_SECRET;
    env.CRON_SECRET = 'isolated-maintenance-fixture-0123456789';
    const expired = 'expired-' + randomUUID(), active = 'active-' + randomUUID();
    await db.rateLimitBucket.createMany({ data: [{ key: expired, count: 1, resetAt: new Date(0) }, { key: active, count: 1, resetAt: new Date(Date.now() + 60000) }] });
    try {
      expect((await request(app).get('/api/cron/maintenance')).status).toBe(401);
      expect((await request(app).get('/api/cron/maintenance').set('Authorization', 'Bearer incorrect')).status).toBe(401);
      const response = await request(app).get('/api/cron/maintenance').set('Authorization', `Bearer ${env.CRON_SECRET}`); expect(response.status).toBe(200);
      expect(await db.rateLimitBucket.findUnique({ where: { key: expired } })).toBeNull(); expect(await db.rateLimitBucket.findUnique({ where: { key: active } })).not.toBeNull();
    } finally { env.CRON_SECRET = previous; }
  });
});
