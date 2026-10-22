import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, include: { staffProfile: { select: { profileImage: true } }, alumniProfile: { select: { profileImage: true } }, membershipApplication: { select: { status: true, activatedAt: true } } } });
  }

  findPublicById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true, sessionVersion: true, staffProfile: { select: { profileImage: true } }, alumniProfile: { select: { profileImage: true } }, membershipApplication: { select: { status: true, activatedAt: true } }, createdAt: true, updatedAt: true },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }
}

export const userRepository = new UserRepository();
