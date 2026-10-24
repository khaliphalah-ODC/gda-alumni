import { z } from 'zod';
import { imageSchema } from './post.validator';

const httpsUrl = z.string().url().max(2000).refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}, 'Use an HTTPS source URL without credentials');
const fields = {
  title: z.string().trim().min(3).max(200), content: z.string().trim().min(1).max(20000),
  image: imageSchema, imageAlt: z.string().trim().min(3).max(500),
  imageCaption: z.string().trim().max(500).nullable().optional(),
  imageWidth: z.number().int().min(1).max(20000).default(1200), imageHeight: z.number().int().min(1).max(20000).default(900),
  displayOrder: z.number().int().min(0).max(10000).default(0),
};
export const gallerySchema = z.object({ ...fields, category: z.enum(['School life', 'Parade', 'Graduation']) }).strict();
export const achievementSchema = z.object({ ...fields,
  category: z.string().trim().min(2).max(100), summary: z.string().trim().min(3).max(1500), heading: z.string().trim().min(3).max(200),
  milestoneDate: z.string().regex(/^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/, 'Use YYYY, YYYY-MM or YYYY-MM-DD').refine(value => value.length !== 10 || (!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value), 'Use a valid calendar date'),
  sourceUrl: httpsUrl, sourceLabel: z.string().trim().min(3).max(300),
}).strict();
export const galleryUpdateSchema = gallerySchema.extend({ version: z.number().int().nonnegative() });
export const achievementUpdateSchema = achievementSchema.extend({ version: z.number().int().nonnegative() });
