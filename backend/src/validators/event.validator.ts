import { z } from 'zod';
import { contentListQuerySchema, imageSchema, versionSchema, eventCategories } from './post.validator';
export const eventListQuerySchema = contentListQuerySchema.extend({ period: z.enum(['upcoming', 'past', 'all']).default('upcoming'), category: z.enum(eventCategories).optional() });
export type EventQuery = z.infer<typeof eventListQuerySchema>;
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const eventFields = {
  title: z.string().trim().min(3).max(200), content: z.string().trim().min(1).max(20000), image: imageSchema,
  eventDate: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  eventTime: optionalText(50), eventLocation: optionalText(300), audience: optionalText(300),
  category: z.enum(eventCategories).nullable().optional(),
};
export const createEventSchema = z.object(eventFields).strict();
export const updateEventSchema = z.object({ ...eventFields, title: eventFields.title.optional(), content: eventFields.content.optional(), eventDate: eventFields.eventDate.optional(), version: versionSchema }).strict().refine((data) => Object.keys(data).some((key) => key !== 'version'), 'At least one event field is required');
