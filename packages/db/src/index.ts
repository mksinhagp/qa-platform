// Database package exports
// Provides pg client, transaction helper, proc-invocation wrapper
// Per global rules: All database access must go through stored procedures
// Note: Migration functions are available via '@qa-platform/db/migrations' for server-side use

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
