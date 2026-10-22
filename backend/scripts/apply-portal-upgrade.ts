// Narrow fallback for installations where Prisma's schema engine cannot connect
// although the application query engine can. Rehearse on a restored backup first.
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const migrations = [
  '20261017000100_phase1_account_and_request_guards',
  '20261017000200_membership_approval',
  '20261017000300_content_versions',
  '20261017000400_activation_delivery',
];
const prisma = new PrismaClient();
async function main() {
  const apply = process.argv.includes('--apply');
  const backup = process.argv.find((argument) => argument.startsWith('--backup='))?.slice(9);
  if (apply && (!backup || statSync(resolve(backup)).size < 100)) throw new Error('Applying requires --backup=<existing database dump>. Restore-test it before applying.');
  const files = migrations.map((name) => {
    const sql = readFileSync(resolve('prisma/migrations', name, 'migration.sql'), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
  await prisma.$transaction(async (transaction) => {
    // Serialize this upgrade with Prisma's migration advisory lock.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(72707369)`;
    const applied = await transaction.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    if (applied.some((row) => !row.finished_at && !row.rolled_back_at)) throw new Error('Resolve the existing failed migration before continuing.');
    const pending = files.filter((file) => {
      const row = applied.find((entry) => entry.migration_name === file.name && entry.finished_at && !entry.rolled_back_at);
      if (row && row.checksum !== file.checksum) throw new Error(`Checksum mismatch: ${file.name}`);
      return !row;
    });
    console.log('Pending portal migrations:', pending.map((file) => file.name).join(', ') || 'none');
    if (!apply || !pending.length) return;
    const countRows = () => transaction.$queryRaw<{ users: bigint; profiles: bigint; posts: bigint; requests: bigint }[]>`SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "AlumniProfile") AS profiles, (SELECT count(*) FROM "Post") AS posts, (SELECT count(*) FROM "Request") AS requests`;
    // Block concurrent writes briefly so preservation counts remain meaningful.
    await transaction.$executeRawUnsafe('LOCK TABLE "User", "AlumniProfile", "Post", "Request" IN SHARE ROW EXCLUSIVE MODE');
    const before = await countRows();
    for (const file of pending) {
      // These four reviewed SQL files contain only simple DDL, with no procedural
      // blocks or semicolons in quoted values. Do not generalize this SQL parser.
      for (const statement of file.sql.replace(/^\s*--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
        await transaction.$executeRawUnsafe(statement);
      }
      await transaction.$executeRaw`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (${randomUUID()}, ${file.checksum}, ${file.name}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`;
    }
    const after = await countRows();
    if (Object.keys(before[0]!).some((key) => before[0]![key as keyof typeof before[0]] !== after[0]![key as keyof typeof after[0]])) throw new Error('Record preservation check failed; rolling back.');
    console.log('Applied portal upgrade; existing user, profile, post and request counts preserved.');
  }, { maxWait: 10000, timeout: 60000 });
}
main().catch((error: unknown) => {
  console.error('Upgrade failed and was rolled back:', error instanceof Error && !('clientVersion' in error) ? error.message : 'Database error; inspect connectivity and migration state.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
