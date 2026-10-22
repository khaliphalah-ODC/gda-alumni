import { RequestStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  updateIfCurrent: vi.fn(),
  deleteIfCurrent: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../repositories/request.repository', () => ({ requestRepository: repository }));

import { RequestsService } from '../services/requests.service';

const admin = { userId: 'cm9z2p7es0000l9m86e4w8v1a', role: Role.ADMIN };
const alumni = { userId: 'cm9z2p7es0001l9m86e4w8v1a', role: Role.ALUMNI };
const anotherAlumni = { userId: 'cm9z2p7es0002l9m86e4w8v1a', role: Role.ALUMNI };

const documentRequest = (status: RequestStatus, requestedBy = alumni.userId) => ({
  id: 'cm9z2p7es0003l9m86e4w8v1a',
  status,
  version: 0,
  requestedBy,
});

describe('RequestsService status workflow and ownership', () => {
  const service = new RequestsService();

  beforeEach(() => vi.clearAllMocks());

  it('allows only the next valid status transition', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.SUBMITTED));
    repository.updateIfCurrent.mockResolvedValue(documentRequest(RequestStatus.IN_REVIEW));

    await service.updateStatus(admin, 'cm9z2p7es0003l9m86e4w8v1a', RequestStatus.IN_REVIEW);
    expect(repository.updateIfCurrent).toHaveBeenCalledWith(
      'cm9z2p7es0003l9m86e4w8v1a',
      0,
      RequestStatus.SUBMITTED,
      expect.objectContaining({ status: RequestStatus.IN_REVIEW }),
    );
  });

  it('rejects an invalid status jump', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.SUBMITTED));

    await expect(service.updateStatus(admin, 'cm9z2p7es0003l9m86e4w8v1a', RequestStatus.APPROVED))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repository.updateIfCurrent).not.toHaveBeenCalled();
  });

  it('sets completion time only when a request reaches COMPLETED', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.READY_FOR_PICKUP));
    repository.updateIfCurrent.mockResolvedValue(documentRequest(RequestStatus.COMPLETED));

    await service.updateStatus(admin, 'cm9z2p7es0003l9m86e4w8v1a', RequestStatus.COMPLETED);
    expect(repository.updateIfCurrent).toHaveBeenCalledWith(
      'cm9z2p7es0003l9m86e4w8v1a',
      0,
      RequestStatus.READY_FOR_PICKUP,
      expect.objectContaining({ status: RequestStatus.COMPLETED, completedAt: expect.any(Date) }),
    );
  });

  it('returns a conflict when another reviewer wins the update', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.IN_REVIEW));
    repository.updateIfCurrent.mockResolvedValue(null);
    await expect(service.updateStatus(admin, 'id', RequestStatus.APPROVED)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('returns a conflict if status changes before owner deletion', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.SUBMITTED));
    repository.deleteIfCurrent.mockResolvedValue({ count: 0 });
    await expect(service.delete(alumni, 'id')).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.deleteIfCurrent).toHaveBeenCalledWith('id', 0, RequestStatus.SUBMITTED, alumni.userId);
  });

  it('rejects owner deletion after review starts', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.IN_REVIEW));
    await expect(service.delete(alumni, 'id')).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.deleteIfCurrent).not.toHaveBeenCalled();
  });

  it('prevents one alumni user from reading another user’s request', async () => {
    repository.findById.mockResolvedValue(documentRequest(RequestStatus.SUBMITTED));

    await expect(service.getById(anotherAlumni, 'cm9z2p7es0003l9m86e4w8v1a'))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
