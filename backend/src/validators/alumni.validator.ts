import { z } from 'zod';
const nullableText = (max: number) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
export const updateAlumniProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(150).optional(),
  graduationYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  occupation: nullableText(500), location: nullableText(500),
  phone: z.preprocess((value) => value === '' ? null : value, z.string().trim().min(6).max(30).nullable().optional()),
  bio: nullableText(2000),
  profileImage: z.preprocess((value) => value === '' ? null : value, z.string().url().max(2000).refine((value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }, 'Use an HTTPS image URL').nullable().optional()),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one profile field is required');
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(), graduationYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
}).strict();
export const directoryIdSchema = z.object({ id: z.string().cuid() }).strict();
