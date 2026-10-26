import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
const databaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set PHASE1_TEST_DATABASE_URL to an isolated local gda_phase1_test database with migrations applied');
const database = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/gda_phase1_test') throw new Error('Browser tests refuse non-local or non-test databases');
const liveMedia = process.env.GDA_LIVE_MEDIA_TEST === '1';
const mediaCredentials = {
  CLOUDINARY_CLOUD_NAME: liveMedia ? process.env.GDA_TEST_CLOUDINARY_CLOUD_NAME || '' : '',
  CLOUDINARY_API_KEY: liveMedia ? process.env.GDA_TEST_CLOUDINARY_API_KEY || '' : '',
  CLOUDINARY_API_SECRET: liveMedia ? process.env.GDA_TEST_CLOUDINARY_API_SECRET || '' : '',
};
if (liveMedia && Object.values(mediaCredentials).some(value => !value)) throw new Error('The opt-in live media test requires all three GDA_TEST_CLOUDINARY_* variables');
export default defineConfig({
  testDir: './e2e', timeout: 240000, expect: { timeout: 15000 }, workers: 1, fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['github']] : 'list', use: { baseURL: 'http://127.0.0.1:55741', actionTimeout: 15000, navigationTimeout: 30000, trace: 'off', screenshot: 'off', video: 'off', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: 'node dist/src/server.js', cwd: '../backend', url: 'http://127.0.0.1:55740/api/health', reuseExistingServer: false, timeout: 60000, env: { DATABASE_URL: databaseUrl, NODE_ENV: 'test', JWT_SECRET: randomBytes(48).toString('hex'), PORT: '55740', FRONTEND_ORIGIN: 'http://127.0.0.1:55741', GROQ_API_KEY: '', ACTIVATION_DELIVERY: 'development', TRUST_PROXY_HOPS: '0', MEDIA_STORAGE: 'cloudinary', RATE_LIMIT_STORAGE: 'memory', ...mediaCredentials, IMAGE_MAX_BYTES: '5242880', SMTP_HOST: 'localhost', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'test@example.test', SMTP_USER: 'test', SMTP_PASSWORD: 'test' }, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
    { command: 'npm run preview -- --host 127.0.0.1 --port 55741 --strictPort', url: 'http://127.0.0.1:55741', reuseExistingServer: false, timeout: 60000, env: { GDA_API_PORT: '55740' }, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
  ],
});
