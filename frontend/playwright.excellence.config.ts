import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'excellence.spec.ts', workers: 1,
  outputDir: 'test-results/excellence',
  timeout: 90000, expect: { timeout: 15000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:55747', trace: 'off', screenshot: 'only-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 55747 --strictPort', url: 'http://127.0.0.1:55747', reuseExistingServer: false, timeout: 60000 },
});
