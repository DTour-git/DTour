import { defineConfig } from 'vitest/config';

// Unit tests for pure code shared by both apps. Runs in plain Node — no network, no database.
export default defineConfig({
  test: {
    include: ['packages/shared/src/**/*.test.ts', 'apps/mobile/src/lib/**/*.test.ts'],
    environment: 'node',
  },
});
