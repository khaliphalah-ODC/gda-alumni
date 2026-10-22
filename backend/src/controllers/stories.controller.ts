import type { ContentQuery } from '../validators/post.validator';
import type { RequestHandler } from 'express';
import { storiesService } from '../services/stories.service';
import { sendSuccess } from '../utils/api-response';

export const createStory: RequestHandler = async (request, response, next) => {
  try {
    const story = await storiesService.create(request.user!, request.body);
    return sendSuccess(response, 201, 'Story created successfully', story);
  } catch (error) { next(error); }
};

export const listStories: RequestHandler = async (request, response, next) => {
  try {
    const { page, limit } = request.query as unknown as { page: number; limit: number };
    const result = await storiesService.list(request.user, page, limit, request.query as unknown as ContentQuery);
    return sendSuccess(response, 200, 'Stories retrieved successfully', result.posts, result.pagination);
  } catch (error) { next(error); }
};

export const updateStory: RequestHandler = async (request, response, next) => {
  try {
    const story = await storiesService.update(request.user!, request.params.id as string, request.body);
    return sendSuccess(response, 200, 'Story updated successfully', story);
  } catch (error) { next(error); }
};

export const deleteStory: RequestHandler = async (request, response, next) => {
  try {
    await storiesService.delete(request.user!, request.params.id as string, request.query.version === undefined ? undefined : Number(request.query.version));
    return sendSuccess(response, 200, 'Story deleted successfully', null);
  } catch (error) { next(error); }
};

export const publishStory: RequestHandler = async (request, response, next) => {
  try {
    const story = await storiesService.publish(request.user!, request.params.id as string, request.body.version);
    return sendSuccess(response, 200, 'Story published successfully', story);
  } catch (error) { next(error); }
};
