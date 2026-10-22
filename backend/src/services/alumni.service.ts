import type { Prisma } from '@prisma/client';
import { alumniRepository } from '../repositories/alumni.repository';
import { getPagination } from '../utils/pagination';
import { AppError } from '../utils/app-error';

type AlumniProfileInput = Omit<Prisma.AlumniProfileUncheckedCreateInput, 'userId' | 'id' | 'createdAt' | 'updatedAt'>;

export class AlumniService {
  async directory(page: number, limit: number, search?: string, graduationYear?: number) {
    const [alumni, total] = await alumniRepository.listDirectory(page, limit, search, graduationYear);
    return { alumni, pagination: getPagination(page, limit, total) };
  }
  async directoryDetail(id: string) {
    const profile = await alumniRepository.directoryDetail(id);
    if (!profile) throw new AppError(404, 'Alumni member not found');
    return profile;
  }
  async dashboard(userId: string) {
    const data = await alumniRepository.dashboard(userId);
    const fields = ['fullName', 'graduationYear', 'occupation', 'location', 'phone', 'bio', 'profileImage'] as const;
    const complete = fields.filter((field) => Boolean(data.profile?.[field])).length;
    return { ...data, profileCompletion: { completed: complete, total: fields.length, percent: Math.round(complete / fields.length * 100) } };
  }

  async getOwnProfile(userId: string) {
    const profile = await alumniRepository.findByUserId(userId);
    if (!profile) throw new AppError(404, 'Alumni profile not found');
    return profile;
  }

  async updateOwnProfile(userId: string, data: Partial<AlumniProfileInput>) {
    const existingProfile = await alumniRepository.findByUserId(userId);
    if (!existingProfile && !data.fullName) {
      throw new AppError(400, 'Full name is required when creating an alumni profile');
    }

    return alumniRepository.upsert(userId, data as AlumniProfileInput);
  }
}

export const alumniService = new AlumniService();
