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
  it('accepts authenticated SMTP with mandatory STARTTLS', () => {
    const result = environmentSchema.parse({ ...settings, ACTIVATION_DELIVERY: 'smtp', SMTP_HOST: 'smtp.school.example', SMTP_FROM: 'registrar@school.example', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'registrar', SMTP_PASSWORD: 'provider-credential' });
    expect(result.SMTP_SECURE).toBe(false);
    expect(result.SMTP_PORT).toBe(587);
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
