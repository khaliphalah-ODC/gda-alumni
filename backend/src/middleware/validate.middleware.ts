import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/app-error';

export const validateBody = (schema: z.ZodTypeAny): RequestHandler => (request, _response, next) => {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    return next(new AppError(400, 'Validation failed', result.error.flatten().fieldErrors));
  }
  request.body = result.data;
  next();
};

export const validateParams = (schema: z.ZodTypeAny): RequestHandler => (request, _response, next) => {
  const result = schema.safeParse(request.params);
  if (!result.success) return next(new AppError(400, 'Validation failed', result.error.flatten().fieldErrors));
  request.params = result.data;
  next();
};

export const validateQuery = (schema: z.ZodTypeAny): RequestHandler => (request, _response, next) => {
  const result = schema.safeParse(request.query);
  if (!result.success) return next(new AppError(400, 'Validation failed', result.error.flatten().fieldErrors));
  request.query = result.data;
  next();
};
