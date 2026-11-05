import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Never inherit a developer's live provider keys or local storage choice.
    // Tests may override these in memory for controlled mocks/local fixtures.
    env: {
      NODE_ENV: 'test', EMAIL_PROVIDER: '', ACTIVATION_DELIVERY: 'development', DEVELOPMENT_MAIL_CAPTURE: 'false',
      BREVO_API_KEY: '', BREVO_SENDER_EMAIL: '', BREVO_SENDER_NAME: '', GROQ_API_KEY: '',
      SMTP_HOST: 'localhost', SMTP_FROM: 'test@example.test', SMTP_USER: '', SMTP_PASSWORD: '',
      MEDIA_STORAGE: 'cloudinary', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
      RATE_LIMIT_STORAGE: 'memory',
    },
    // Database suites inspect global aggregates and must not mutate fixtures concurrently.
    fileParallelism: false,
  },
});
