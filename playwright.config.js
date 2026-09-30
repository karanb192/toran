import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://127.0.0.1:8392',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1200, height: 800 },
  },
  webServer: {
    command: 'python3 -m http.server 8392 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8392',
  },
});
