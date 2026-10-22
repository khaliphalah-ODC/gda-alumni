import { hasPermission } from '../policies/permission.policy';
import { RequestStatus, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import { requestRepository } from '../repositories/request.repository';
import { AppError } from '../utils/app-error';
import { getPagination } from '../utils/pagination';

interface CreateRequestInput {
  requestType: 'CERTIFICATE' | 'TRANSCRIPT' | 'DIPLOMA' | 'WAEC_CERTIFICATE' | 'WASSCE_CERTIFICATE';
  purpose: string;
  fullNameAtGraduation: string;
  graduationYear?: number;
  studentIdOrIndexNumber?: string;
  contactPhone: string;
}

const allowedTransitions: Record<RequestStatus, readonly RequestStatus[]> = {
  [RequestStatus.SUBMITTED]: [RequestStatus.IN_REVIEW],
  [RequestStatus.IN_REVIEW]: [RequestStatus.APPROVED, RequestStatus.REJECTED],
  [RequestStatus.APPROVED]: [RequestStatus.READY_FOR_PICKUP],
  [RequestStatus.REJECTED]: [RequestStatus.IN_REVIEW],
  [RequestStatus.READY_FOR_PICKUP]: [RequestStatus.COMPLETED],
  [RequestStatus.COMPLETED]: [],
};

export class RequestsService {
  create(actor: AuthenticatedUser, data: CreateRequestInput) {
    return requestRepository.create({ ...data, requestedBy: actor.userId });
  }

  async listMine(actor: AuthenticatedUser, page: number, limit: number, status?: RequestStatus, search?: string) {
    const [requests, total] = await requestRepository.list({ requestedBy: actor.userId, status, search, skip: (page - 1) * limit, take: limit });
    return { requests, pagination: getPagination(page, limit, total) };
  }

  async listAll(page: number, limit: number, status?: RequestStatus, search?: string) {
    const [requests, total] = await requestRepository.list({ status, search, skip: (page - 1) * limit, take: limit });
    return { requests, pagination: getPagination(page, limit, total) };
  }

  async getById(actor: AuthenticatedUser, id: string) {
    const request = await this.findRequest(id);
    this.assertOwnerOrAdmin(actor, request.requestedBy);
    return request;
  }

  async updateStatus(actor: AuthenticatedUser, id: string, status: RequestStatus, adminNote?: string | null, version?: number) {
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Only administrators can update request status');
    const request = await this.findRequest(id);
    this.assertVersion(request.version, version);
    if (!allowedTransitions[request.status].includes(status)) {
      throw new AppError(400, `Invalid status transition from ${request.status} to ${status}`);
    }
    const updated = await requestRepository.updateIfCurrent(id, request.version, request.status, {
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(status === RequestStatus.COMPLETED ? { completedAt: new Date() } : {}),
    });
    if (!updated) throw new AppError(409, 'Request changed during review. Refresh and try again.');
    return updated;
  }

  async delete(actor: AuthenticatedUser, id: string, version?: number) {
    const request = await this.findRequest(id);
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) {
      this.assertOwnerOrAdmin(actor, request.requestedBy);
      if (request.status !== RequestStatus.SUBMITTED && request.status !== RequestStatus.REJECTED) {
        throw new AppError(400, 'Only submitted or rejected requests can be deleted');
      }
    }
    this.assertVersion(request.version, version);
    const result = await requestRepository.deleteIfCurrent(id, request.version, request.status, hasPermission(actor.role, 'SCHOOL_MANAGE') ? undefined : actor.userId);
    if (result.count !== 1) throw new AppError(409, 'Request changed before deletion. Refresh and try again.');
  }

  async updateNote(actor: AuthenticatedUser, id: string, adminNote: string | null, version?: number) {
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Only administrators can update registrar notes');
    const request = await this.findRequest(id); this.assertVersion(request.version, version);
    const updated = await requestRepository.updateIfCurrent(id, request.version, request.status, { adminNote });
    if (!updated) throw new AppError(409, 'Request changed. Reload before saving notes');
    return updated;
  }
  private assertVersion(current: number, expected?: number) {
    if (expected !== undefined && expected !== current) throw new AppError(409, 'Request changed. Reload before taking action');
  }

  private async findRequest(id: string) {
    const request = await requestRepository.findById(id);
    if (!request) throw new AppError(404, 'Document request not found');
    return request;
  }

  private assertOwnerOrAdmin(actor: AuthenticatedUser, ownerId: string) {
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE') && actor.userId !== ownerId) {
      throw new AppError(403, 'You may only access your own document requests');
    }
  }
}

export const requestsService = new RequestsService();
