import { RequestStatus, RequestType } from '@prisma/client';
import { z } from 'zod';

const requestId = z.string().cuid('A valid request identifier is required');

export const createRequestSchema = z.object({
  requestType: z.nativeEnum(RequestType),
  purpose: z.string().trim().min(3).max(1_000),
  fullNameAtGraduation: z.string().trim().min(2).max(150),
  graduationYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  studentIdOrIndexNumber: z.string().trim().min(2).max(100).optional(),
  contactPhone: z.string().trim().min(6).max(30),
}).strict();

export const requestIdParamSchema = z.object({ id: requestId }).strict();
export const updateRequestStatusSchema = z.object({
  status: z.nativeEnum(RequestStatus),
  version: z.number().int().min(0).optional(),
  adminNote: z.string().trim().max(2_000).nullable().optional(),
}).strict();

export const requestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(RequestStatus).optional(),
  search: z.string().trim().max(150).optional(),
}).strict();

export const updateRequestNoteSchema = z.object({ adminNote: z.string().trim().max(2000).nullable(), version: z.number().int().min(0).optional() }).strict();
export const requestVersionQuerySchema = z.object({ version: z.coerce.number().int().min(0).optional() }).strict();
