import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { membershipInvitationService } from './services/membership-invitation.service';

const server = app.listen(env.PORT, () => {
  console.log(`Gray D. Allison API listening on port ${env.PORT}`);
});
// Long-running hosts resume committed outbox jobs after restarts. Serverless
// uses immediate awaited dispatch plus the authenticated scheduler endpoint.
let processingInvitations = false;
const invitationWorker = setInterval(async () => {
  if (processingInvitations || shuttingDown) return;
  processingInvitations = true;
  try { await membershipInvitationService.drain(1); }
  catch { if (env.NODE_ENV !== 'test') console.error('Invitation queue worker failed; check database readiness'); }
  finally { processingInvitations = false; }
}, 15000);
invitationWorker.unref();

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(invitationWorker);
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
