import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests for the website. They run against the DEV Supabase project
// (never production): the dev server below is started with scripts/with-dev-db.mjs.
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1300, height: 900 } } }],
  webServer: {
    // A production build (not `next dev`): closer to what users get, and it doesn't clash
    // with a dev server you already have running.
    command: `node ../../scripts/with-dev-db.mjs sh -c "npx next build && npx next start --port ${PORT}"`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
