import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { emailSchema, newPassword } from '../src/validators/account.validator';
import { PASSWORD_SALT_ROUNDS } from '../src/constants/auth.constants';
const prisma = new PrismaClient();
async function main() {
  const email = emailSchema.parse(process.env.SUPER_ADMIN_EMAIL);
  const password = newPassword.parse(process.env.SUPER_ADMIN_PASSWORD);
  const fullName = process.env.SUPER_ADMIN_NAME?.trim();
  if (!fullName || fullName.length < 2 || fullName.length > 150) throw new Error('Set SUPER_ADMIN_NAME to 2–150 characters');
  const hash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72707370)`;
    if (await tx.user.count({ where: { role: 'SUPER_ADMIN' } })) throw new Error('A SuperAdmin already exists; bootstrap is initial-only');
    if (await tx.user.findUnique({ where: { email } })) throw new Error('This email already has an account. Bootstrap never promotes existing accounts');
    const user = await tx.user.create({ data: { email, password: hash, role: 'SUPER_ADMIN', staffProfile: { create: { fullName } } } });
    await tx.auditRecord.create({ data: { actorId: user.id, action: 'SUPER_ADMIN_BOOTSTRAPPED', targetId: user.id } });
  }, { maxWait: 10000, timeout: 60000 });
  console.log('Initial SuperAdmin created. Existing Admin accounts remain unchanged.');
}
main()
  .catch((error: unknown) => {
    if (error instanceof ZodError) {
      console.error(`Invalid bootstrap configuration: ${error.issues.map((issue) => issue.message).join('; ')}`);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Bootstrap failed with database error ${error.code}. Check DATABASE_URL, migration status, and whether the initial SuperAdmin already exists.`);
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error(`Could not connect to the database${error.errorCode ? ` (${error.errorCode})` : ''}. Check DATABASE_URL and database availability.`);
    } else if (error instanceof Error && !('clientVersion' in error)) {
      console.error(error.message);
    } else {
      console.error('Bootstrap failed due to a database or client error. Check DATABASE_URL, migration status, and server availability.');
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
