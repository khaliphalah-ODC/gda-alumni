import { hasPermission } from '../policies/permission.policy';
import { PostType, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import type { ContentQuery } from '../validators/post.validator';
import { postRepository } from '../repositories/post.repository';
import { contentService } from './content.service';
import { AppError } from '../utils/app-error';
interface StoryInput { title: string; content: string; image?: string | null; version?: number }
export class StoriesService {
  create(actor: AuthenticatedUser, data: StoryInput) {
    if (actor.role !== Role.ALUMNI && !hasPermission(actor.role, 'SCHOOL_MANAGE')) throw new AppError(403, 'Alumni membership is required');
    return postRepository.create({ title: data.title, content: data.content, image: data.image, type: PostType.STORY, createdBy: actor.userId });
  }
  list(actor: AuthenticatedUser | undefined, page: number, limit: number, options?: Partial<ContentQuery>) { return contentService.list(PostType.STORY, actor, page, limit, options); }
  update(actor: AuthenticatedUser, id: string, data: Partial<StoryInput>) { return contentService.update(PostType.STORY, actor, id, data); }
  delete(actor: AuthenticatedUser, id: string, version?: number) { return contentService.remove(PostType.STORY, actor, id, version); }
  publish(actor: AuthenticatedUser, id: string, version?: number) { return contentService.publication(PostType.STORY, actor, id, true, version); }
}
export const storiesService = new StoriesService();
