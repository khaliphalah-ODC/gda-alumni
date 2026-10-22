import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`Gray D. Allison API listening on port ${env.PORT}`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down gracefully`);
  // Bound shutdown if a client or database connection remains open.
  const deadline = setTimeout(() => process.exit(1), 30000);
  deadline.unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
      clearTimeout(deadline);
      process.exit(0);
    } catch {
      console.error('Database shutdown failed');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
