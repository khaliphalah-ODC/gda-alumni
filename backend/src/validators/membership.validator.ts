import { z } from 'zod';
import { passwordSchema } from './auth.validator';
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(6).max(30),
  location: optionalText(300), previousName: optionalText(150),
  graduationYear: z.number().int().min(1900).max(new Date().getFullYear()),
  studentIndexNumber: optionalText(100), lastClassAttended: optionalText(100),
  verificationInformation: optionalText(2000),
}).strict();
export const trackingSchema = z.object({ reference: z.string().regex(/^GDA-[A-F0-9]{24}$/), secret: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const correctionSchema = trackingSchema.extend({ application: applicationSchema }).strict();
export const activationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordSchema }).strict();
export const membershipIdSchema = z.object({ id: z.string().cuid() }).strict();
export const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), notes: z.string().trim().max(2000).optional(), rejectionReason: z.string().trim().min(3).max(2000).optional() }).strict().refine((data) => data.decision !== 'REJECTED' || Boolean(data.rejectionReason), { message: 'Explain why the application was rejected', path: ['rejectionReason'] });
export const membershipListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(150).optional(), status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }).strict();
export type ApplicationInput = z.infer<typeof applicationSchema>;
