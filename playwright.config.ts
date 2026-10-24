import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // The pilot runs on a technician's phone, so the same scenarios are proven at
  // phone width and with touch input; a desktop-only suite would hide exactly
  // the layout the field demo depends on.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec tsx --env-file=.env scripts/preview.ts',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    // Every scenario signs in from one address; the sign-in limit is pinned by
    // an integration test instead of by making this suite wait.
    env: { AUTH_SIGN_IN_MAX: '200' },
  },
});
