import { assertPermission } from '../policies/permission.policy';
import { PostType } from '@prisma/client';
import type { AuthenticatedUser } from '../types/auth.types';
import type { EventQuery } from '../validators/event.validator';
import { postRepository } from '../repositories/post.repository';
import { contentService } from './content.service';
interface EventInput { title: string; content: string; image?: string | null; eventDate: Date; eventTime?: string | null; eventLocation?: string | null; audience?: string | null; version?: number }
export class EventsService {
  create(actor: AuthenticatedUser, data: EventInput) {
    assertPermission(actor.role, 'SCHOOL_MANAGE');
    return postRepository.create({ ...data, type: PostType.EVENT, createdBy: actor.userId });
  }
  list(actor: AuthenticatedUser | undefined, page: number, limit: number, options?: Partial<EventQuery>) { return contentService.list(PostType.EVENT, actor, page, limit, options); }
  update(actor: AuthenticatedUser, id: string, data: Partial<EventInput>) { return contentService.update(PostType.EVENT, actor, id, data); }
  delete(actor: AuthenticatedUser, id: string, version?: number) { return contentService.remove(PostType.EVENT, actor, id, version); }
  publish(actor: AuthenticatedUser, id: string, version?: number) { return contentService.publication(PostType.EVENT, actor, id, true, version); }
}
export const eventsService = new EventsService();
