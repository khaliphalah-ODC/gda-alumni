import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    // Database suites inspect global aggregates and must not mutate fixtures concurrently.
    fileParallelism: false,
  },
});
