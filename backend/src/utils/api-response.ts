import type { Response } from 'express';

export function sendSuccess<T>(response: Response, statusCode: number, message: string, data: T, pagination: unknown = null) {
  return response.status(statusCode).json({ success: true, message, data, pagination });
}

export function sendError(response: Response, statusCode: number, message: string, details?: unknown) {
  return response.status(statusCode).json({ success: false, message, data: details ?? null, pagination: null });
}
