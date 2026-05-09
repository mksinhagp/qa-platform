import { loadEnv, resetEnv } from '@qa-platform/config';
import { beforeEach } from 'vitest';

// Set minimal test environment variables
// ESM imports are hoisted, but process.env assignments in the module body
// run before vitest collects tests, so this order is fine.
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.DASHBOARD_PORT = '3000';
process.env.DASHBOARD_SESSION_SECRET = 'test-session-secret-32-chars-long!!';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5434';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'qa_platform';
process.env.VAULT_ARGON2ID_MEMORY = '65536';
process.env.VAULT_ARGON2ID_ITERATIONS = '2';
process.env.VAULT_ARGON2ID_PARALLELISM = '1';
process.env.VAULT_ARGON2ID_SALT_LENGTH = '16';
process.env.VAULT_UNLOCK_TTL_SECONDS = '1800';
process.env.VAULT_UNLOCK_IDLE_RESET_SECONDS = '300';
process.env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS = '28800';
process.env.AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS = '2592000';
process.env.COMPOSE_PROFILES = '';

// Reset and reload env before each test so getEnv() works
beforeEach(() => {
  resetEnv();
  loadEnv();
});
