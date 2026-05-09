import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@qa-platform/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@qa-platform/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@qa-platform/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@qa-platform/vault': path.resolve(__dirname, 'packages/vault/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', '.next', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
  },
});
