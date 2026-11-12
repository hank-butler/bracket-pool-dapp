import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Without this, vitest also picks up stale compiled copies in dist/.
    exclude: ['dist/**', 'node_modules/**'],
  },
});
