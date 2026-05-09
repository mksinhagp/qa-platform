// Database package exports
// Provides pg client, transaction helper, proc-invocation wrapper, and migration runner
// Per global rules: All database access must go through stored procedures

export {
  initializePool,
  getPool,
  closePool,
  getClient,
} from './client';

export {
  withTransaction,
  query,
  type TransactionContext,
} from './transaction';

export {
  invokeProc,
  invokeProcInTransaction,
  invokeProcScalar,
  invokeProcWrite,
  type ProcParams,
  type ProcResult,
} from './procedures';

export {
  runMigrations,
  getCurrentVersion,
  getAppliedMigrations,
  type MigrationOptions,
} from './migrations';
