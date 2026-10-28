import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'file-picker.spec.ts', workers: 1,
  timeout: 30000, expect: { timeout: 5000 }, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:55748', trace: 'off',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 55748 --strictPort',
    url: 'http://127.0.0.1:55748', reuseExistingServer: false, timeout: 60000,
  },
});
