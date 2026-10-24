import { createHmac } from 'node:crypto';
import rateLimit, { type Options, type Store } from 'express-rate-limit';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { isIP } from 'node:net';

export function clientIpKey(value: string | undefined) {
  if (!value) return 'unknown';
  if (isIP(value) !== 6) return value;
  try {
    const canonical = new URL(`http://[${value}]`).hostname.slice(1, -1);
    const [left, right] = canonical.split('::');
    const head = left ? left.split(':') : [], tail = right ? right.split(':') : [];
    const words = right === undefined ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
    const numbers = words.map(word => parseInt(word, 16));
    if (numbers.slice(0, 5).every(word => word === 0) && numbers[5] === 65535) return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join('.');
    return `${numbers[0].toString(16)}:${numbers[1].toString(16)}:${numbers[2].toString(16)}:${(numbers[3] & 0xff00).toString(16)}::/56`;
  } catch { return value.toLowerCase(); }
}

export class DatabaseRateLimitStore implements Store {
  localKeys = false;
  windowMs = 60000;
  prefix: string;
  constructor(scope: string) { this.prefix = `${scope}:`; }
  init(options: Options) { this.windowMs = options.windowMs; }
  private key(value: string) { return this.prefix + createHmac('sha256', env.JWT_SECRET).update(value).digest('hex'); }
  async increment(value: string) {
    const key = this.key(value);
    const [row] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + (${this.windowMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + (${this.windowMs} * INTERVAL '1 millisecond') ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", "resetAt"`;
    return { totalHits: row.count, resetTime: row.resetAt };
  }
  async decrement(value: string) {
    await prisma.$executeRaw`UPDATE "RateLimitBucket" SET "count" = GREATEST(0, "count" - 1) WHERE "key" = ${this.key(value)}`;
  }
  async resetKey(value: string) { await prisma.rateLimitBucket.deleteMany({ where: { key: this.key(value) } }); }
}

export function createLimiter(scope: string, options: Partial<Options>) {
  const shared = env.VERCEL === '1' || env.RATE_LIMIT_STORAGE === 'database'
    || (env.NODE_ENV === 'production' && env.RATE_LIMIT_STORAGE !== 'memory');
  return rateLimit({ keyGenerator: req => clientIpKey(req.ip), ...options, ...(shared ? { store: new DatabaseRateLimitStore(scope) } : {}), passOnStoreError: false });
}
