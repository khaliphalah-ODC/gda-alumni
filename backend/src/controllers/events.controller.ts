import type { EventQuery } from '../validators/event.validator';
import type { RequestHandler } from 'express';
import { eventsService } from '../services/events.service';
import { sendSuccess } from '../utils/api-response';

export const createEvent: RequestHandler = async (request, response, next) => {
  try {
    const event = await eventsService.create(request.user!, request.body);
    return sendSuccess(response, 201, 'Event created successfully', event);
  } catch (error) { next(error); }
};

export const listEvents: RequestHandler = async (request, response, next) => {
  try {
    const { page, limit } = request.query as unknown as { page: number; limit: number };
    const result = await eventsService.list(request.user, page, limit, request.query as unknown as EventQuery);
    return sendSuccess(response, 200, 'Events retrieved successfully', result.posts, result.pagination);
  } catch (error) { next(error); }
};

export const updateEvent: RequestHandler = async (request, response, next) => {
  try {
    const event = await eventsService.update(request.user!, request.params.id as string, request.body);
    return sendSuccess(response, 200, 'Event updated successfully', event);
  } catch (error) { next(error); }
};

export const deleteEvent: RequestHandler = async (request, response, next) => {
  try {
    await eventsService.delete(request.user!, request.params.id as string, request.query.version === undefined ? undefined : Number(request.query.version));
    return sendSuccess(response, 200, 'Event deleted successfully', null);
  } catch (error) { next(error); }
};

export const publishEvent: RequestHandler = async (request, response, next) => {
  try {
    const event = await eventsService.publish(request.user!, request.params.id as string, request.body.version);
    return sendSuccess(response, 200, 'Event published successfully', event);
  } catch (error) { next(error); }
};
