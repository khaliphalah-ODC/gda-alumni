import { defineConfig, devices } from '@playwright/test';
for (const name of ['GDA_HOSTED_FRONTEND_URL', 'GDA_HOSTED_API_URL']) {
  const value = process.env[name];
  if (!value || new URL(value).protocol !== 'https:') throw new Error(`Set ${name} to the deployed HTTPS origin before running hosted checks`);
}
export default defineConfig({
  testDir: './e2e', testMatch: 'hosted.spec.ts', workers: 1, timeout: 90000, expect: { timeout: 20000 }, reporter: 'list',
  use: { baseURL: process.env.GDA_HOSTED_FRONTEND_URL, trace: 'off', screenshot: 'off', video: 'off', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
