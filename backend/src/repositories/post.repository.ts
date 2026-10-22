import { AppError } from '../utils/app-error';
import type { AuthenticatedUser } from '../types/auth.types';
import type { PostType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const postSelection = {
  id: true,
  version: true,
  title: true,
  content: true,
  image: true,
  type: true,
  isPublished: true,
  publishedAt: true,
  createdBy: true,
  eventDate: true,
  eventTime: true,
  eventLocation: true,
  audience: true,
  milestoneDate: true,
  position: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true } },
} satisfies Prisma.PostSelect;

export class PostRepository {
  create(data: Prisma.PostUncheckedCreateInput) {
    return prisma.post.create({ data, select: postSelection });
  }

  findById(id: string) {
    return prisma.post.findUnique({ where: { id }, select: postSelection });
  }

  async updateIfCurrent(id: string, type: PostType, version: number, data: Prisma.PostUpdateManyMutationInput, cleanupPublicId?: string, actor?: AuthenticatedUser) {
    return prisma.$transaction(async (tx) => {
      if (actor) {
        const accounts = await tx.$queryRaw<{ role: string; sessionVersion: number; isActive: boolean }[]>`SELECT "role"::text, "sessionVersion", "isActive" FROM "User" WHERE id = ${actor.userId} FOR SHARE`;
        const account = accounts[0];
        if (!account || !account.isActive || account.role !== actor.role || account.sessionVersion !== (actor.sessionVersion ?? 0)) throw new AppError(401, 'Your account changed. Please sign in again');
      }
      const result = await tx.post.updateMany({ where: { id, type, version }, data: { ...data, version: { increment: 1 } } });
      if (result.count === 1 && cleanupPublicId) await tx.mediaCleanup.upsert({ where: { publicId: cleanupPublicId }, create: { publicId: cleanupPublicId }, update: {} });
      return result.count === 1 ? tx.post.findUnique({ where: { id }, select: postSelection }) : null;
    });
  }
  deleteIfCurrent(id: string, type: PostType, version: number, cleanupPublicId?: string) {
    return prisma.$transaction(async tx => {
      const result = await tx.post.deleteMany({ where: { id, type, version } });
      if (result.count === 1 && cleanupPublicId) await tx.mediaCleanup.upsert({ where: { publicId: cleanupPublicId }, create: { publicId: cleanupPublicId }, update: {} });
      return result;
    });
  }

  list({ type, where, skip, take, chronological = false }: { type: PostType; where?: Prisma.PostWhereInput; skip: number; take: number; chronological?: boolean }) {
    const finalWhere: Prisma.PostWhereInput = { ...where, type };
    return prisma.$transaction([
      prisma.post.findMany({ where: finalWhere, skip, take, orderBy: type === 'HISTORY' && chronological
        ? [{ milestoneDate: { sort: 'asc', nulls: 'last' } }, { displayOrder: 'asc' }, { id: 'asc' }]
        : ['HISTORY', 'SCHOOL_LEADER', 'ALUMNI_LEADER'].includes(type)
        ? [{ displayOrder: 'asc' }, { id: 'asc' }]
        : type === 'EVENT' ? [{ eventDate: 'asc' }, { id: 'asc' }] : [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }], select: postSelection }),
      prisma.post.count({ where: finalWhere }),
    ]);
  }
}

export const postRepository = new PostRepository();
