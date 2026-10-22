import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // Hosted PostgreSQL adds a network round trip to each statement inside an
  // interactive transaction. The default 5s budget failed real dashboard reads.
  transactionOptions: { maxWait: 5000, timeout: 15000 },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
});
