import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { sendError } from '../utils/api-response';
import { AppError } from '../utils/app-error';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(404, `Route ${request.method} ${request.originalUrl} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) return sendError(response, error.statusCode, error.message, error.details);
  if (error instanceof MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? `Uploaded image exceeds the ${env.IMAGE_MAX_BYTES / (1024 * 1024)} MB limit` : 'Invalid image upload';
    return sendError(response, 400, message);
  }
  if (error instanceof ZodError) return sendError(response, 400, 'Validation failed', error.flatten().fieldErrors);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2021', 'P2022'].includes(error.code)) return sendError(response, 503, 'The portal database needs an update. Please contact the administrator.');
    if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2028'].includes(error.code)) return sendError(response, 503, 'The portal database is temporarily unavailable. Please try again shortly.');
    if (error.code === 'P2002') return sendError(response, 409, 'A record with these details already exists');
    if (error.code === 'P2025') return sendError(response, 404, 'Record not found');
    if (error.code === 'P2003') return sendError(response, 409, 'This operation conflicts with related records');
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return sendError(response, 503, 'The portal database is unavailable. Please contact the administrator.');
  const parserError = error as { type?: string };
  if (parserError?.type === 'entity.parse.failed') return sendError(response, 400, 'Malformed JSON body');
  if (parserError?.type === 'entity.too.large') return sendError(response, 413, 'Request body is too large');
  // Do not log full Prisma errors, submitted records, or parser bodies.
  if (env.NODE_ENV !== 'test') console.error('Unhandled API error', error instanceof Error ? error.name : 'UnknownError');
  return sendError(response, 500, 'Something went wrong');
};
