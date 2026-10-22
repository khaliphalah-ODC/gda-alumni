import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const profileSelection = {
  id: true,
  userId: true,
  fullName: true,
  graduationYear: true,
  occupation: true,
  location: true,
  phone: true,
  bio: true,
  profileImage: true,
  imageVersion: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, role: true } },
} satisfies Prisma.AlumniProfileSelect;

const directorySelection = { id: true, fullName: true, graduationYear: true, occupation: true, location: true, bio: true, profileImage: true } satisfies Prisma.AlumniProfileSelect;
const approvedMember: Prisma.AlumniProfileWhereInput = {
  user: { role: 'ALUMNI', isActive: true, membershipApplication: { is: { status: 'APPROVED', activatedAt: { not: null } } } },
};

export class AlumniRepository {
  findByUserId(userId: string) {
    return prisma.alumniProfile.findUnique({ where: { userId }, select: profileSelection });
  }

  listDirectory(page: number, limit: number, search?: string, graduationYear?: number) {
    const where: Prisma.AlumniProfileWhereInput = { ...approvedMember, graduationYear, ...(search ? { fullName: { contains: search, mode: 'insensitive' } } : {}) };
    return prisma.$transaction([
      prisma.alumniProfile.findMany({ where, select: directorySelection, skip: (page - 1) * limit, take: limit, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] }),
      prisma.alumniProfile.count({ where }),
    ]);
  }
  directoryDetail(id: string) {
    return prisma.alumniProfile.findFirst({ where: { ...approvedMember, id }, select: directorySelection });
  }
  dashboard(userId: string) {
    return prisma.$transaction(async (tx) => {
      const [profile, membership, announcements, stories, events, requests, requestCounts] = await Promise.all([
        tx.alumniProfile.findUnique({ where: { userId }, select: profileSelection }),
        tx.membershipApplication.findUnique({ where: { userId }, select: { reference: true, status: true, reviewedAt: true, activatedAt: true } }),
        tx.post.findMany({ where: { type: 'ANNOUNCEMENT', isPublished: true }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, title: true, content: true, publishedAt: true } }),
        tx.post.findMany({ where: { type: 'STORY', createdBy: userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 6, select: { id: true, title: true, content: true, isPublished: true, publishedAt: true, updatedAt: true } }),
        tx.post.findMany({ where: { type: 'EVENT', isPublished: true, eventDate: { gte: new Date() } }, orderBy: [{ eventDate: 'asc' }, { id: 'asc' }], take: 5, select: { id: true, title: true, content: true, eventDate: true, eventTime: true, eventLocation: true, audience: true } }),
        tx.request.findMany({ where: { requestedBy: userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, requestType: true, status: true, adminNote: true, createdAt: true, completedAt: true } }),
        tx.request.groupBy({ by: ['status'], where: { requestedBy: userId }, _count: { _all: true } }),
      ]);
      return { profile, membership, announcements, stories, events, requests, requestCounts };
    });
  }

  upsert(userId: string, data: Omit<Prisma.AlumniProfileUncheckedCreateInput, 'userId'>) {
    return prisma.$transaction(async (tx) => {
      const old = await tx.alumniProfile.findUnique({ where: { userId } });
      const changes = data.profileImage !== undefined && data.profileImage !== old?.profileImage;
      if (changes && old?.profileImagePublicId) await tx.mediaCleanup.upsert({ where: { publicId: old.profileImagePublicId }, create: { publicId: old.profileImagePublicId }, update: {} });
      return tx.alumniProfile.upsert({ where: { userId }, create: { ...data, userId }, update: { ...data, ...(changes ? { profileImagePublicId: null, imageVersion: { increment: 1 } } : {}) }, select: profileSelection });
    });
  }
}

export const alumniRepository = new AlumniRepository();
