import type { Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

const requestSelection = {
  id: true,
  version: true,
  requestType: true,
  purpose: true,
  status: true,
  adminNote: true,
  requestedBy: true,
  fullNameAtGraduation: true,
  graduationYear: true,
  studentIdOrIndexNumber: true,
  contactPhone: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, role: true } },
} satisfies Prisma.RequestSelect;

export class RequestRepository {
  create(data: Prisma.RequestUncheckedCreateInput) {
    return prisma.request.create({ data, select: requestSelection });
  }

  findById(id: string) {
    return prisma.request.findUnique({ where: { id }, select: requestSelection });
  }

  async updateIfCurrent(id: string, version: number, status: RequestStatus, data: Prisma.RequestUpdateManyMutationInput) {
    return prisma.$transaction(async (transaction) => {
      const result = await transaction.request.updateMany({
        where: { id, version, status },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1) return null;
      return transaction.request.findUnique({ where: { id }, select: requestSelection });
    });
  }

  deleteIfCurrent(id: string, version: number, status: RequestStatus, requestedBy?: string) {
    return prisma.request.deleteMany({ where: { id, version, status, ...(requestedBy ? { requestedBy } : {}) } });
  }

  list({ requestedBy, status, search, skip, take }: { requestedBy?: string; status?: RequestStatus; search?: string; skip: number; take: number }) {
    const where: Prisma.RequestWhereInput = { ...(requestedBy ? { requestedBy } : {}), ...(status ? { status } : {}), ...(search ? { OR: [{ id: { contains: search, mode: 'insensitive' } }, { fullNameAtGraduation: { contains: search, mode: 'insensitive' } }, { studentIdOrIndexNumber: { contains: search, mode: 'insensitive' } }, { user: { email: { contains: search, mode: 'insensitive' } } }] } : {}) };
    return prisma.$transaction([
      prisma.request.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: requestSelection }),
      prisma.request.count({ where }),
    ]);
  }
}

export const requestRepository = new RequestRepository();
