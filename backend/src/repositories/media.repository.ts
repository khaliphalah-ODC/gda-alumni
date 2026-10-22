import { prisma } from '../config/prisma';
export const mediaRepository = {
  queue(publicId: string) { return prisma.mediaCleanup.upsert({ where: { publicId }, create: { publicId }, update: {} }); },
  pending() { return prisma.mediaCleanup.findMany({ take: 10, orderBy: { createdAt: 'asc' } }); },
  done(id: string) { return prisma.mediaCleanup.delete({ where: { id } }); },
};
