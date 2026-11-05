import { membershipInvitationService } from '../src/services/membership-invitation.service';
import { prisma } from '../src/config/prisma';
membershipInvitationService.drain(10).then(result => console.log(JSON.stringify(result)))
  .catch(() => { console.error('Invitation queue failed. Check database readiness and safe delivery diagnostics.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
