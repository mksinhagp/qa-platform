import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@qa-platform/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@qa-platform/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@qa-platform/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@qa-platform/vault': path.resolve(__dirname, 'packages/vault/src/index.ts'),
      '@qa-platform/rules': path.resolve(__dirname, 'packages/rules/src/index.ts'),
      '@qa-platform/shared-types': path.resolve(__dirname, 'packages/shared-types/src/index.ts'),
      '@qa-platform/api-testing': path.resolve(__dirname, 'packages/api-testing/src/index.ts'),
      '@qa-platform/llm': path.resolve(__dirname, 'packages/llm/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'apps/*/app/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', '.next', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
  },
});
