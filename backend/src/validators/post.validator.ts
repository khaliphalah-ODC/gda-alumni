import { z } from 'zod';
export const announcementCategories = ['Academic', 'Alumni', 'Events', 'Ministry', 'General'] as const;
export const eventCategories = ['Academic', 'Alumni', 'Ceremony', 'Sports', 'Community', 'Other'] as const;
export const postIdParamSchema = z.object({ id: z.string().cuid('A valid post identifier is required') }).strict();
export const contentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(), scope: z.enum(['public', 'manage', 'mine']).optional(),
  publication: z.enum(['all', 'published', 'draft']).default('all'),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();
export type ContentQuery = z.infer<typeof contentListQuerySchema>;
export const imageSchema = z.string().url().max(2000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS image URL').nullable().optional();
export const versionSchema = z.number().int().min(0).optional();
export const publicationSchema = z.object({ version: versionSchema }).strict().default({});
export const deletionQuerySchema = z.object({ version: z.coerce.number().int().min(0).optional() }).strict();
const basePostFields = { title: z.string().trim().min(3).max(200), content: z.string().trim().min(1).max(20000), image: imageSchema };
export const createAnnouncementSchema = z.object({ ...basePostFields, category: z.enum(announcementCategories).nullable().optional(), isPublished: z.boolean().default(true) }).strict();
export const updateAnnouncementSchema = z.object({ title: basePostFields.title.optional(), content: basePostFields.content.optional(), image: imageSchema, category: z.enum(announcementCategories).nullable().optional(), version: versionSchema }).strict().refine(data => Object.keys(data).some(key => key !== 'version'), 'At least one content field is required');
export const createStorySchema = z.object(basePostFields).strict();
export const updateStorySchema = z.object({ title: basePostFields.title.optional(), content: basePostFields.content.optional(), image: imageSchema, version: versionSchema }).strict().refine((data) => Object.keys(data).some((key) => key !== 'version'), 'At least one content field is required');
