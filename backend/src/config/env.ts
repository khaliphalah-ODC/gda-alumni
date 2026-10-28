import 'dotenv/config';
import { z } from 'zod';
import { supportedGroqModels, defaultGroqModel } from './ai';
import { resolveEmailProvider } from './email';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VERCEL: z.enum(['1']).optional(),
  RATE_LIMIT_STORAGE: z.enum(['memory', 'database']).optional(),
  CRON_SECRET: z.string().min(32).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  ACTIVATION_DELIVERY: z.enum(['development', 'smtp']).default('development'),
  EMAIL_PROVIDER: z.preprocess(value => value === '' ? undefined : value, z.enum(['brevo', 'smtp', 'development']).optional()),
  BREVO_API_KEY: z.preprocess(value => value === '' ? undefined : value, z.string().trim().min(1).optional()),
  BREVO_SENDER_EMAIL: z.preprocess(value => value === '' ? undefined : value, z.string().trim().email().optional()),
  BREVO_SENDER_NAME: z.preprocess(value => value === '' ? undefined : value, z.string().trim().min(1).max(150).regex(/^[^\r\n]+$/).optional()),
  CLOUDINARY_CLOUD_NAME: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()),
  CLOUDINARY_API_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  CLOUDINARY_API_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  GROQ_API_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  GROQ_MODEL: z.enum(supportedGroqModels).default(defaultGroqModel),
  AI_CHAT_ENABLED: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
  AI_PDF_MAX_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(10 * 1024 * 1024),
  IMAGE_MAX_BYTES: z.coerce.number().int().min(1024).max(5 * 1024 * 1024).default(5 * 1024 * 1024),
  MEDIA_STORAGE: z.enum(['cloudinary', 'local']).default('cloudinary'),
  MEDIA_UPLOAD_DIR: z.string().trim().min(1).optional(),
  MEDIA_PUBLIC_ORIGIN: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  }, 'Use a public API origin without a path or credentials').optional(),
  SMTP_HOST: z.string().trim().min(1).max(253).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  SMTP_FROM: z.string().email().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9]\d*(s|m|h|d)$/, 'Use a duration such as 30m, 12h, or 7d').default('7d'),
  FRONTEND_ORIGIN: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  }, 'Use a frontend origin without a path, credentials, or query').transform((value) => new URL(value).origin).default('http://localhost:3000'),
});

export const environmentSchema = schema.superRefine((config, context) => {
  if (config.VERCEL === '1' && !config.CRON_SECRET) {
    context.addIssue({ code: 'custom', path: ['CRON_SECRET'], message: 'Vercel scheduled maintenance requires a random CRON_SECRET of at least 32 characters' });
  }
  if (config.VERCEL === '1' && config.RATE_LIMIT_STORAGE === 'memory') {
    context.addIssue({ code: 'custom', path: ['RATE_LIMIT_STORAGE'], message: 'Vercel requires shared database rate limiting' });
  }
  if (config.VERCEL === '1' && config.MEDIA_STORAGE === 'local') {
    context.addIssue({ code: 'custom', path: ['MEDIA_STORAGE'], message: 'Vercel cannot persist server image uploads. Use MEDIA_STORAGE=cloudinary.' });
  }
  const emailProvider = resolveEmailProvider(config);
  if (emailProvider === 'brevo') {
    for (const key of ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'] as const) {
      if (!config[key]) context.addIssue({ code: 'custom', path: [key], message: `${key} is required when EMAIL_PROVIDER=brevo` });
    }
  }
  if (emailProvider === 'smtp' && (!config.SMTP_HOST || !config.SMTP_FROM)) {
    context.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'SMTP delivery requires SMTP_HOST and SMTP_FROM' });
  }
  if (emailProvider !== 'brevo' && Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    context.addIssue({ code: 'custom', path: ['SMTP_USER'], message: 'Configure both SMTP_USER and SMTP_PASSWORD, or neither for a trusted relay' });
  }
  if (config.NODE_ENV !== 'production') return;
  if (config.MEDIA_STORAGE === 'local' && (!config.MEDIA_UPLOAD_DIR || !config.MEDIA_PUBLIC_ORIGIN?.startsWith('https://'))) {
    context.addIssue({ code: 'custom', path: ['MEDIA_STORAGE'], message: 'Production server uploads require a persistent MEDIA_UPLOAD_DIR and HTTPS MEDIA_PUBLIC_ORIGIN' });
  }
  if (!config.FRONTEND_ORIGIN.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['FRONTEND_ORIGIN'], message: 'Production requires an HTTPS frontend origin' });
  }
  if (/replace|example|change.?me|secret|choose/i.test(config.JWT_SECRET) || new Set(config.JWT_SECRET).size < 12) {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Production requires a unique random secret' });
  }
});
const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

const expiryUnits = { s: 1, m: 60, h: 3600, d: 86400 };
const expiryUnit = env.JWT_EXPIRES_IN.slice(-1) as keyof typeof expiryUnits;
export const authLifetimeSeconds = Number(env.JWT_EXPIRES_IN.slice(0, -1)) * expiryUnits[expiryUnit];
if (!Number.isSafeInteger(authLifetimeSeconds) || authLifetimeSeconds > 30 * 86400) {
  throw new Error('JWT_EXPIRES_IN must be at most 30 days');
}
