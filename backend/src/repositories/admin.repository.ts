import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
export class AdminRepository {
  dashboard() {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const [statsRows, requestCounts, recentApplications, recentRequests, membershipActivity] = await Promise.all([
        tx.$queryRaw<{ totalApprovedAlumni: number; pendingApplications: number; rejectedApplications: number; activatedAlumniAccounts: number; activeAlumniAccounts: number; publishedAnnouncements: number; publishedStories: number; upcomingEvents: number }[]>`
          SELECT
            (SELECT count(*)::int FROM "MembershipApplication" WHERE status = 'APPROVED') AS "totalApprovedAlumni",
            (SELECT count(*)::int FROM "MembershipApplication" WHERE status = 'PENDING') AS "pendingApplications",
            (SELECT count(*)::int FROM "MembershipApplication" WHERE status = 'REJECTED') AS "rejectedApplications",
            (SELECT count(*)::int FROM "User" u JOIN "MembershipApplication" a ON a."userId" = u.id WHERE u.role = 'ALUMNI' AND a.status = 'APPROVED' AND a."activatedAt" IS NOT NULL) AS "activatedAlumniAccounts",
            (SELECT count(*)::int FROM "User" u JOIN "MembershipApplication" a ON a."userId" = u.id WHERE u.role = 'ALUMNI' AND u."isActive" AND a.status = 'APPROVED' AND a."activatedAt" IS NOT NULL) AS "activeAlumniAccounts",
            (SELECT count(*)::int FROM "Post" WHERE type = 'ANNOUNCEMENT' AND "isPublished") AS "publishedAnnouncements",
            (SELECT count(*)::int FROM "Post" WHERE type = 'STORY' AND "isPublished") AS "publishedStories",
            (SELECT count(*)::int FROM "Post" WHERE type = 'EVENT' AND "isPublished" AND "eventDate" >= ${now}) AS "upcomingEvents"
        `,
        tx.request.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.membershipApplication.findMany({ where: { status: 'PENDING' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, reference: true, fullName: true, graduationYear: true, createdAt: true } }),
        tx.request.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 6, select: { id: true, requestType: true, status: true, fullNameAtGraduation: true, createdAt: true } }),
        tx.membershipReview.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: { id: true, action: true, createdAt: true, application: { select: { reference: true, fullName: true } }, actor: { select: { email: true } } } }),
      ]);
      return { stats: statsRows[0]!, requestCounts, recentApplications, recentRequests, membershipActivity, asOf: now };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
export const adminRepository = new AdminRepository();
