import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:9223',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', // Only take screenshots on failure for speed
    video: 'retain-on-failure', // Only record video on failure for speed
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    // Test against standalone build (what users actually get)
    // Note: Standalone build must exist before running tests (run npm run build:standalone first)
    // Note: index.html must exist (copy from pinball-trainer-standalone.html)
    // serve will use serve.json config which already has cleanUrls:false (SPA mode)
    command: 'npx serve -p 9223 dist-standalone',
    cwd: '..', // Run from project root since config is in config/ subdirectory
    url: 'http://localhost:9223',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
