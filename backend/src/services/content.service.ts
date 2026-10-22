import { localMediaOrigin } from './local-media';
import { mediaService } from './media.service';
import { env } from '../config/env';
import { managedContentImageId } from '../utils/content-image';
import { hasPermission } from '../policies/permission.policy';
import { PostType, Role, type Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import { postRepository } from '../repositories/post.repository';
import { AppError } from '../utils/app-error';
import { getPagination } from '../utils/pagination';
import type { ContentQuery } from '../validators/post.validator';
export class ContentService {
  async list(type: PostType, actor: AuthenticatedUser | undefined, page: number, limit: number, options?: Partial<ContentQuery> & { period?: 'upcoming' | 'past' | 'all'; historyOrder?: 'display' | 'chronological' }) {
    const scope = options?.scope ?? ((actor && hasPermission(actor.role, 'SCHOOL_MANAGE')) ? 'manage' : type === PostType.STORY && actor?.role === Role.ALUMNI ? 'mineAndPublic' : 'public');
    if (scope === 'manage' && (!actor || !hasPermission(actor.role, 'SCHOOL_MANAGE'))) throw new AppError(403, 'Administrator permission is required');
    if (scope === 'mine' && !actor) throw new AppError(401, 'Authentication is required');
    if (['mine', 'mineAndPublic'].includes(scope) && (!actor || (!hasPermission(actor.role, 'SCHOOL_MANAGE') && !hasPermission(actor.role, 'ALUMNI_ACCESS')))) throw new AppError(403, 'Alumni or school permission is required');
    const visibility: Prisma.PostWhereInput = scope === 'public' ? { isPublished: true }
      : scope === 'mine' ? { createdBy: actor!.userId }
      : scope === 'mineAndPublic' ? { OR: [{ isPublished: true }, { createdBy: actor!.userId }] } : {};
    const where: Prisma.PostWhereInput = { AND: [visibility,
      ...(options?.publication === 'draft' ? [{ isPublished: false }] : options?.publication === 'published' ? [{ isPublished: true }] : []),
      ...(options?.search ? [{ OR: [{ title: { contains: options.search, mode: 'insensitive' as const } }, { content: { contains: options.search, mode: 'insensitive' as const } }] }] : []),
      ...(type === PostType.EVENT && scope === 'public' ? [{ eventDate: options?.period === 'past' ? { lt: new Date() } : options?.period === 'all' ? { not: null } : { gte: new Date() } }] : []),
    ] };
    const [posts, total] = await postRepository.list({ type, where, skip: (page - 1) * limit, take: limit, chronological: type === PostType.HISTORY && options?.historyOrder === 'chronological' });
    return { posts, pagination: getPagination(page, limit, total) };
  }
  async detail(type: PostType, id: string, actor?: AuthenticatedUser) {
    const post = await this.find(type, id);
    if (!post.isPublished && (!actor || !hasPermission(actor.role, 'SCHOOL_MANAGE')) && !(type === PostType.STORY && actor?.role === Role.ALUMNI && post.createdBy === actor.userId)) throw new AppError(404, 'Content not found');
    return post;
  }
  async editable(type: PostType, actor: AuthenticatedUser, id: string, version?: number) {
    const post = await this.find(type, id); this.assertManager(type, actor, post.createdBy); this.assertVersion(post.version, version); return post;
  }
  async update(type: PostType, actor: AuthenticatedUser, id: string, input: Prisma.PostUpdateManyMutationInput & { version?: number }) {
    const post = await this.find(type, id); this.assertManager(type, actor, post.createdBy);
    const { version, ...data } = input; this.assertVersion(post.version, version);
    const cleanupId = typeof data.image !== 'undefined' && data.image !== post.image ? managedContentImageId(post.image, id, env.CLOUDINARY_CLOUD_NAME, localMediaOrigin()) : undefined;
    const requiresReview = ['HISTORY', 'SCHOOL_LEADER', 'ALUMNI_LEADER'].includes(type)
      || (type === PostType.STORY && !hasPermission(actor.role, 'SCHOOL_MANAGE'));
    const updated = await postRepository.updateIfCurrent(id, type, post.version, { ...data, ...(requiresReview ? { isPublished: false, publishedAt: null } : {}) }, cleanupId, actor);
    if (!updated) throw new AppError(409, 'Content changed. Reload before editing');
    if (cleanupId) void mediaService.cleanup().catch(() => {});
    return updated;
  }
  async remove(type: PostType, actor: AuthenticatedUser, id: string, version?: number) {
    const post = await this.find(type, id); this.assertManager(type, actor, post.createdBy); this.assertVersion(post.version, version);
    const cleanupId = managedContentImageId(post.image, id, env.CLOUDINARY_CLOUD_NAME, localMediaOrigin());
    if ((await postRepository.deleteIfCurrent(id, type, post.version, cleanupId)).count !== 1) throw new AppError(409, 'Content changed. Reload before deleting');
    if (cleanupId) void mediaService.cleanup().catch(() => {});
  }
  async publication(type: PostType, actor: AuthenticatedUser, id: string, published: boolean, version?: number) {
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Only administrators may publish content');
    const post = await this.find(type, id); this.assertVersion(post.version, version);
    if (post.isPublished === published) return post;
    const updated = await postRepository.updateIfCurrent(id, type, post.version, { isPublished: published, publishedAt: published ? new Date() : null });
    if (!updated) throw new AppError(409, 'Content changed during review. Reload and review the current content');
    return updated;
  }
  private async find(type: PostType, id: string) {
    const post = await postRepository.findById(id);
    if (!post || post.type !== type) throw new AppError(404, 'Content not found');
    return post;
  }
  private assertManager(type: PostType, actor: AuthenticatedUser, ownerId: string) {
    if (!hasPermission(actor.role, 'SCHOOL_MANAGE') && !(type === PostType.STORY && actor.role === Role.ALUMNI && ownerId === actor.userId)) throw new AppError(403, 'You do not have permission to manage this content');
  }
  private assertVersion(current: number, expected?: number) {
    if (expected !== undefined && expected !== current) throw new AppError(409, 'Content changed. Reload its latest version');
  }
}
export const contentService = new ContentService();
