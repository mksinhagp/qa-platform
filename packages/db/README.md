# @qa-platform/db

Database access layer for the QA Automation Platform.

## Purpose

Per global rules, all database access must go through PostgreSQL stored procedures. This package provides:

- **PostgreSQL client** with connection pooling
- **Transaction helper** for BEGIN/COMMIT/ROLLBACK operations
- **Stored procedure invocation wrapper** for type-safe proc calls
- **Migration runner** for applying numbered SQL files

## Usage

### Initialization

```typescript
import { initializePool } from '@qa-platform/db';

initializePool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

### Invoking Stored Procedures

```typescript
import { invokeProc, invokeProcScalar, invokeProcWrite } from '@qa-platform/db';

// Read operation (returns result set)
const result = await invokeProc('sp_operators_get_by_login', {
  i_login: 'admin@example.com',
});

// Scalar operation (returns single value)
const count = await invokeProcScalar('sp_operators_count');

// Write operation (auto-transaction)
await invokeProcWrite('sp_operators_insert', {
  i_login: 'user@example.com',
  i_password_hash: hashedPassword,
  i_display_name: 'John Doe',
  i_created_by: 'admin',
});
```

### Transactions

```typescript
import { withTransaction } from '@qa-platform/db';

await withTransaction(async ({ client, commit, rollback }) => {
  // Execute multiple procs in a single transaction
  await invokeProcInTransaction(client, 'sp_sites_insert', { i_name: 'Test Site' });
  await invokeProcInTransaction(client, 'sp_site_environments_set', { i_site_id: 1 });
  // Auto-commits on success, rolls back on error
});
```

### Migrations

```typescript
import { runMigrations } from '@qa-platform/db';

await runMigrations({
  migrationsDir: 'db/migrations',
  procsDir: 'db/procs',
});
```

## Conventions

- All parameters use snake_case with i_ prefix for input, o_ for output
- All tables use snake_case for column names
- Every table includes: created_date, updated_date, created_by, updated_by
- Stored procedures return tabular/scalar datasets only (no JSON)
- Migration files are numbered: 0001_description.sql, 0002_description.sql

## Directory Structure

```
db/
  migrations/    # Schema migration files (numbered)
  procs/         # Stored procedure definitions (numbered)
  seed/          # Seed data scripts
```
