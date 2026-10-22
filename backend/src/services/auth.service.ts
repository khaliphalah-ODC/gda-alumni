import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { userRepository } from '../repositories/user.repository';
import { AppError } from '../utils/app-error';

interface Credentials { email: string; password: string }

export class AuthService {
  async register(_credentials: Credentials) {
    throw new AppError(403, 'Public registration is closed. Apply for alumni membership and activate your approved account');
  }

  async login({ email, password }: Credentials) {
    const user = await userRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Invalid email or password');
    }
    this.assertAllowed(user);
    return { ...this.toPublicUser(user), sessionVersion: user.sessionVersion };
  }

  async getCurrentUser(userId: string) {
    const user = await userRepository.findPublicById(userId);
    if (!user) throw new AppError(401, 'Authentication is no longer valid');
    this.assertAllowed(user);
    return this.toPublicUser(user);
  }

  async getSessionIdentity(userId: string, sessionVersion = 0) {
    const user = await userRepository.findPublicById(userId);
    if (!user) throw new AppError(401, 'Authentication is no longer valid');
    this.assertAllowed(user, 401);
    if ((user.sessionVersion ?? 0) !== sessionVersion) throw new AppError(401, 'Your session has ended. Please log in again');
    return { userId: user.id, role: user.role };
  }

  private assertAllowed(user: { isActive: boolean; role: Role; membershipApplication?: { status: string; activatedAt: Date | null } | null }, statusCode = 403) {
    if (!user.isActive || user.role === Role.STUDENT || (user.role === Role.ALUMNI && (user.membershipApplication?.status !== 'APPROVED' || !user.membershipApplication.activatedAt))) {
      throw new AppError(statusCode, 'This account is inactive or requires approved membership activation');
    }
  }

  private toPublicUser(user: { id: string; email: string; role: Role; createdAt: Date; updatedAt: Date; staffProfile?: { profileImage: string | null } | null; alumniProfile?: { profileImage: string | null } | null }) {
    return { id: user.id, email: user.email, role: user.role, profileImage: (user.role === 'ALUMNI' ? user.alumniProfile : user.staffProfile)?.profileImage ?? null, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
}

export const authService = new AuthService();
