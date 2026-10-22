import { prisma } from '../config/prisma';
export const healthRepository = {
  async checkDatabase() {
    // Connectivity alone is insufficient: an unmigrated database accepts SELECT 1
    // while every login, membership action and content query fails.
    // Validate the required relations/columns in one round trip without reading
    // personal records. This also works when every table is empty.
    await prisma.$queryRaw`
      SELECT
        (SELECT "sessionVersion" FROM "User" LIMIT 1),
        (SELECT "isActive" FROM "User" LIMIT 1),
        (SELECT "version" FROM "Post" LIMIT 1),
        (SELECT "milestoneDate" FROM "Post" LIMIT 1),
        (SELECT "position" FROM "Post" LIMIT 1),
        (SELECT "displayOrder" FROM "Post" LIMIT 1),
        (SELECT "version" FROM "Request" LIMIT 1),
        (SELECT "activationDeliveryStatus" FROM "MembershipApplication" LIMIT 1),
        (SELECT "activationDeliveryAt" FROM "MembershipApplication" LIMIT 1),
        (SELECT "id" FROM "MembershipReview" LIMIT 1),
        (SELECT "profileImagePublicId" FROM "StaffProfile" LIMIT 1),
        (SELECT "profileImagePublicId" FROM "AlumniProfile" LIMIT 1),
        (SELECT "id" FROM "AccountToken" LIMIT 1),
        (SELECT "id" FROM "PlatformSettings" LIMIT 1),
        (SELECT "id" FROM "AuditRecord" LIMIT 1),
        (SELECT "id" FROM "ChatbotSettings" LIMIT 1),
        (SELECT "id" FROM "ChatbotFaq" LIMIT 1),
        (SELECT "day" FROM "ChatbotUsage" LIMIT 1),
        (SELECT "id" FROM "MediaCleanup" LIMIT 1)
      LIMIT 0
    `;
  },
};
