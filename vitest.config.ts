import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.RUN_INTEGRATION ? [] : ['tests/integration/**'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
