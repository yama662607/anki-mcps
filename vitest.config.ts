import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['clones/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
