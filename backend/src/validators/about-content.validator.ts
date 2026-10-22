import { z } from 'zod';
import { imageSchema } from './post.validator';

// Keep year-only milestones as years, without inventing a month or day.
export const milestoneDateSchema = z.string().trim().refine((value) => {
  if (/^[1-9]\d{3}$/.test(value)) return true;
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a year (e.g. 1980) or a valid date (YYYY-MM-DD)');

const shared = {
  title: z.string().trim().min(2).max(200),
  image: imageSchema,
  displayOrder: z.number().int().min(0).max(1000000).default(0),
};
export const createHistorySchema = z.object({
  ...shared,
  content: z.string().trim().min(1).max(20000),
  milestoneDate: milestoneDateSchema,
}).strict();
export const createLeaderSchema = z.object({
  ...shared,
  title: z.string().trim().min(2).max(150),
  content: z.string().trim().min(1).max(2000),
  position: z.string().trim().min(2).max(150),
}).strict();
export const aboutVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export const aboutDeletionSchema = z.object({ version: z.coerce.number().int().min(0) }).strict();
export const updateHistorySchema = createHistorySchema.extend(aboutVersionSchema.shape);
export const updateLeaderSchema = createLeaderSchema.extend(aboutVersionSchema.shape);
export const aboutListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(150).optional(),
  scope: z.enum(['public', 'manage']).default('public'),
  publication: z.enum(['all', 'published', 'draft']).default('all'),
  historyOrder: z.enum(['display', 'chronological']).default('display'),
}).strict();
