import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('A valid email address is required').max(254);
const passwordBytes = (value: string) => Buffer.byteLength(value, 'utf8') <= 72;
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72).refine(passwordBytes, 'Password must not exceed 72 UTF-8 bytes');

export const registerSchema = z.object({ email, password: passwordSchema }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(72).refine(passwordBytes, 'Password must not exceed 72 UTF-8 bytes') }).strict();
