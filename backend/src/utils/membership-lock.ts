import type { Prisma } from '@prisma/client';

// Serialize invitation state changes independently of millisecond timestamp
// precision. Transaction-scoped locks also work with pooled PostgreSQL.
export async function lockMembershipInvitation(tx: Prisma.TransactionClient, applicationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('membership-invitation'), hashtext(${applicationId}))`;
}
