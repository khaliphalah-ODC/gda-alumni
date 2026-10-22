import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { healthRepository } from '../src/repositories/health.repository';

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log('Database connection and authentication verified.');
  await healthRepository.checkDatabase();
  console.log('Required portal tables and columns verified. No records were changed.');
}

main().catch((error: unknown) => {
  // Prisma messages can contain connection details; report only the error code.
  const failure = error as { code?: string; errorCode?: string } | null;
  const code = failure?.errorCode ?? failure?.code;
  console.error(`Database check failed${code && /^P\d{4}$/.test(code) ? ` (${code})` : ''}.`);
  console.error('Verify DATABASE_URL, Neon compute availability and network access to port 5432. For startup timeouts, use connect_timeout=15&pool_timeout=15. Apply migrations only after connectivity succeeds.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
