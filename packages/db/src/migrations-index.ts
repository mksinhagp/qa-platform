// Migration runner exports - server-side only
// These exports use Node.js-specific APIs (fs, path, crypto)
// Import from '@qa-platform/db/migrations' for server-side use only

export {
  runMigrations,
  getCurrentVersion,
  getAppliedMigrations,
  type MigrationOptions,
} from './migrations';
