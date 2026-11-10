import { defineConfig } from 'vitest/config';

// Runs in plain Node without network or database access.
export default defineConfig({
  test: {
    include: ['packages/shared/src/**/*.test.ts', 'apps/mobile/src/lib/**/*.test.ts', 'scripts/*.test.ts'],
    environment: 'node',
  },
});
