import { assertPermission } from '../policies/permission.policy';
import { contentService } from './content.service';
import type { ContentQuery } from '../validators/post.validator';
import { PostType } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import { postRepository } from '../repositories/post.repository';

interface PostInput { title: string; content: string; image?: string | null }

export class PostsService {
  async createAnnouncement(actor: AuthenticatedUser, data: PostInput & { isPublished?: boolean }) {
    assertPermission(actor.role, 'SCHOOL_MANAGE');
    const { isPublished = true, ...fields } = data;
    return postRepository.create({ ...fields, type: PostType.ANNOUNCEMENT, createdBy: actor.userId, isPublished, publishedAt: isPublished ? new Date() : null });
  }
  listAnnouncements(actor: AuthenticatedUser | undefined, page: number, limit: number, options?: Partial<ContentQuery>) {
    return contentService.list(PostType.ANNOUNCEMENT, actor, page, limit, options);
  }
}
export const postsService = new PostsService();
