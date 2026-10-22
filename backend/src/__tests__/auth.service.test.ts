import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
const repository = vi.hoisted(() => ({ findPublicById: vi.fn(), findByEmail: vi.fn() }));
vi.mock('../repositories/user.repository', () => ({ userRepository: repository }));
import { AuthService } from '../services/auth.service';

describe('current account permissions', () => {
  const service = new AuthService();
  beforeEach(() => vi.resetAllMocks());
  it.each([
    null,
    { id: 'id', role: Role.ALUMNI, isActive: true },
    { id: 'id', role: Role.ALUMNI, isActive: true, membershipApplication: { status: 'APPROVED', activatedAt: null } },
    { id: 'id', role: Role.ALUMNI, isActive: false },
    { id: 'id', role: Role.STUDENT, isActive: true },
  ])('rejects missing, inactive and historical student accounts: %j', async (user) => {
    repository.findPublicById.mockResolvedValue(user);
    await expect(service.getSessionIdentity('id')).rejects.toBeDefined();
  });
  it('loads the current role from the account', async () => {
    repository.findPublicById.mockResolvedValue({ id: 'id', role: Role.ALUMNI, isActive: true, membershipApplication: { status: 'APPROVED', activatedAt: new Date() } });
    await expect(service.getSessionIdentity('id')).resolves.toEqual({ userId: 'id', role: Role.ALUMNI });
  });
});
