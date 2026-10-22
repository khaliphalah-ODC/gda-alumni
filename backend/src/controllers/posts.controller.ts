import type { ContentQuery } from '../validators/post.validator';
import type { RequestHandler } from 'express';
import { postsService } from '../services/posts.service';
import { sendSuccess } from '../utils/api-response';

export const createAnnouncement: RequestHandler = async (request, response, next) => {
  try {
    const post = await postsService.createAnnouncement(request.user!, request.body);
    return sendSuccess(response, 201, 'Announcement created successfully', post);
  } catch (error) { next(error); }
};

export const listAnnouncements: RequestHandler = async (request, response, next) => {
  try {
    const { page, limit } = request.query as unknown as { page: number; limit: number };
    const result = await postsService.listAnnouncements(request.user, page, limit, request.query as unknown as ContentQuery);
    return sendSuccess(response, 200, 'Announcements retrieved successfully', result.posts, result.pagination);
  } catch (error) { next(error); }
};
