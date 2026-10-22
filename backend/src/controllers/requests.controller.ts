import { RequestStatus } from '@prisma/client';
import type { RequestHandler } from 'express';
import { requestsService } from '../services/requests.service';
import { sendSuccess } from '../utils/api-response';

export const createRequest: RequestHandler = async (request, response, next) => {
  try {
    const documentRequest = await requestsService.create(request.user!, request.body);
    return sendSuccess(response, 201, 'Document request submitted successfully', documentRequest);
  } catch (error) { next(error); }
};

export const listMyRequests: RequestHandler = async (request, response, next) => {
  try {
    const { page, limit, status, search } = request.query as unknown as { page: number; limit: number; status?: RequestStatus; search?: string };
    const result = await requestsService.listMine(request.user!, page, limit, status, search);
    return sendSuccess(response, 200, 'Your document requests retrieved successfully', result.requests, result.pagination);
  } catch (error) { next(error); }
};

export const listRequests: RequestHandler = async (request, response, next) => {
  try {
    const { page, limit, status, search } = request.query as unknown as { page: number; limit: number; status?: RequestStatus; search?: string };
    const result = await requestsService.listAll(page, limit, status, search);
    return sendSuccess(response, 200, 'Document requests retrieved successfully', result.requests, result.pagination);
  } catch (error) { next(error); }
};

export const getRequest: RequestHandler = async (request, response, next) => {
  try {
    const documentRequest = await requestsService.getById(request.user!, request.params.id as string);
    return sendSuccess(response, 200, 'Document request retrieved successfully', documentRequest);
  } catch (error) { next(error); }
};

export const updateRequestStatus: RequestHandler = async (request, response, next) => {
  try {
    const documentRequest = await requestsService.updateStatus(request.user!, request.params.id as string, request.body.status, request.body.adminNote, request.body.version);
    return sendSuccess(response, 200, 'Document request status updated successfully', documentRequest);
  } catch (error) { next(error); }
};

export const deleteRequest: RequestHandler = async (request, response, next) => {
  try {
    await requestsService.delete(request.user!, request.params.id as string, request.query.version === undefined ? undefined : Number(request.query.version));
    return sendSuccess(response, 200, 'Document request deleted successfully', null);
  } catch (error) { next(error); }
};

export const updateRequestNote: RequestHandler = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Registrar note updated', await requestsService.updateNote(req.user!, req.params.id as string, req.body.adminNote, req.body.version)); } catch (e) { next(e); }
};
