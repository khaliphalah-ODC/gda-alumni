import { describe, expect, it } from 'vitest';
import { environmentSchema } from '../config/env';
const settings = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test@localhost/test', FRONTEND_ORIGIN: 'https://school.example', JWT_SECRET: 'Qz8!vK4$nM2@bP9#xL7&cR3*wH6%jD5+' };
describe('production configuration', () => {
  it('accepts HTTPS and a random secret', () => {
    expect(environmentSchema.safeParse(settings).success).toBe(true);
  });
  it.each([
    { FRONTEND_ORIGIN: 'http://school.example' },
    { FRONTEND_ORIGIN: 'https://school.example/path' },
    { JWT_SECRET: 'replace-this-with-a-long-random-secret-at-least-32-characters' },
    { JWT_SECRET: 'a'.repeat(40) },
    { JWT_EXPIRES_IN: 'invalid' },
    { MEDIA_STORAGE: 'local' },
    { MEDIA_STORAGE: 'local', MEDIA_UPLOAD_DIR: '/data/images', MEDIA_PUBLIC_ORIGIN: 'http://api.school.example' },
  ])('rejects unsafe settings %j', (change) => {
    expect(environmentSchema.safeParse({ ...settings, ...change }).success).toBe(false);
  });
  it('accepts server storage with a persistent directory and HTTPS public API origin', () => {
    expect(environmentSchema.safeParse({ ...settings, MEDIA_STORAGE: 'local', MEDIA_UPLOAD_DIR: '/data/images', MEDIA_PUBLIC_ORIGIN: 'https://api.school.example' }).success).toBe(true);
  });
  it('rejects local image storage on Vercel even with a configured upload directory', () => {
    const result = environmentSchema.safeParse({ ...settings, VERCEL: '1', MEDIA_STORAGE: 'local', MEDIA_UPLOAD_DIR: '/tmp/images', MEDIA_PUBLIC_ORIGIN: 'https://api.school.example' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.MEDIA_STORAGE).toContain('Vercel cannot persist server image uploads. Use MEDIA_STORAGE=cloudinary.');
  });
  it('accepts Vercel with external image storage and a smaller upload limit', () => {
    expect(environmentSchema.safeParse({ ...settings, VERCEL: '1', CRON_SECRET: 'isolated-maintenance-fixture-0123456789', MEDIA_STORAGE: 'cloudinary', IMAGE_MAX_BYTES: '4194304' }).success).toBe(true);
  });
  it('accepts authenticated SMTP with mandatory STARTTLS', () => {
    const result = environmentSchema.parse({ ...settings, ACTIVATION_DELIVERY: 'smtp', SMTP_HOST: 'smtp.school.example', SMTP_FROM: 'registrar@school.example', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'registrar', SMTP_PASSWORD: 'provider-credential' });
    expect(result.SMTP_SECURE).toBe(false);
    expect(result.SMTP_PORT).toBe(587);
  });
  it('selects Brevo without SMTP and overrides the legacy setting', () => {
    const result = environmentSchema.parse({ ...settings, EMAIL_PROVIDER: 'brevo', ACTIVATION_DELIVERY: 'smtp',
      BREVO_API_KEY: 'private-api-key', BREVO_SENDER_EMAIL: 'registrar@school.example', BREVO_SENDER_NAME: 'School Registrar' });
    expect(result.EMAIL_PROVIDER).toBe('brevo');
  });
  it('accepts an explicit development provider despite the legacy SMTP selection', () => {
    expect(environmentSchema.safeParse({ ...settings, EMAIL_PROVIDER: 'development', ACTIVATION_DELIVERY: 'smtp' }).success).toBe(true);
  });
  it('requires SMTP configuration when the explicit SMTP provider overrides development', () => {
    expect(environmentSchema.safeParse({ ...settings, EMAIL_PROVIDER: 'smtp' }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...settings, EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_FROM: 'sender@example.test' }).success).toBe(true);
  });
  it.each(['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'])('requires %s for Brevo', key => {
    const configuration: Record<string, unknown> = { ...settings, EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'api-key', BREVO_SENDER_EMAIL: 'registrar@school.example', BREVO_SENDER_NAME: 'School Registrar' };
    delete configuration[key];
    const result = environmentSchema.safeParse(configuration);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors).toHaveProperty(key);
  });
  it.each([
    { EMAIL_PROVIDER: 'unknown' }, { EMAIL_PROVIDER: 'brevo', BREVO_SENDER_EMAIL: 'not-an-email' },
    { EMAIL_PROVIDER: 'brevo', BREVO_SENDER_NAME: 'Sender\r\nInjected: value' },
    { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: ' ' },
  ])('rejects invalid email configuration %j', change => {
    expect(environmentSchema.safeParse({ ...settings, BREVO_API_KEY: 'api-key', BREVO_SENDER_EMAIL: 'registrar@school.example', BREVO_SENDER_NAME: 'Registrar', ...change }).success).toBe(false);
  });
  it.each([
    { ACTIVATION_DELIVERY: 'smtp' },
    { SMTP_USER: 'registrar' },
    { SMTP_PASSWORD: 'provider-credential' },
    { SMTP_SECURE: 'disabled' },
    { TRUST_PROXY_HOPS: 'true' },
  ])('rejects incomplete delivery or unsafe proxy settings %j', (change) => {
    expect(environmentSchema.safeParse({ ...settings, ...change }).success).toBe(false);
  });
});
