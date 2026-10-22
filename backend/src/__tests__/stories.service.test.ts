import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostType, Role } from '@prisma/client';
const repository = vi.hoisted(() => ({ findById: vi.fn(), updateIfCurrent: vi.fn() }));
vi.mock('../repositories/post.repository', () => ({ postRepository: repository }));
import { StoriesService } from '../services/stories.service';
const actor = { userId: 'owner', role: Role.ALUMNI };

describe('story moderation and ownership', () => {
  const service = new StoriesService();
  beforeEach(() => {
    vi.resetAllMocks();
    repository.updateIfCurrent.mockResolvedValue({ id: 'story' });
    repository.findById.mockResolvedValue({ id: 'story', createdBy: 'owner', type: PostType.STORY, isPublished: true, version: 0 });
  });
  it('returns alumni edits to draft and clears publication time', async () => {
    await service.update(actor, 'story', { content: 'Changed text' });
    expect(repository.updateIfCurrent).toHaveBeenCalledWith('story', PostType.STORY, 0, { content: 'Changed text', isPublished: false, publishedAt: null }, undefined, actor);
  });
  it('does not allow an unrelated alumni to edit or publish', async () => {
    await expect(service.update({ ...actor, userId: 'other' }, 'story', { title: 'Changed' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.publish(actor, 'story')).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.updateIfCurrent).not.toHaveBeenCalled();
  });
  it('preserves administrator editorial access', async () => {
    await service.update({ ...actor, role: Role.ADMIN }, 'story', { title: 'Correction' });
    expect(repository.updateIfCurrent).toHaveBeenCalledWith('story', PostType.STORY, 0, { title: 'Correction' }, undefined, { ...actor, role: Role.ADMIN });
  });
});
