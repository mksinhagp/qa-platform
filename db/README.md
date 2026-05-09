# Database Directory

This directory contains all database-related files for the QA Automation Platform.

## Structure

```
db/
  migrations/    # Schema migration files (numbered: 0001_*.sql)
  procs/         # Stored procedure definitions (numbered: 0001_sp_*.sql)
  seed/          # Seed data scripts for development/testing
```

## Conventions

Per global rules:
- All tables use snake_case for column names
- Every table includes: created_date, updated_date, created_by, updated_by
- All database access must go through stored procedures
- Stored procedures use i_/o_/io_ prefixes for parameters
- Migration and proc files are numbered in serial order
- Wrap SQL scripts between BEGIN and END for @variables

## Execution

The migration runner in `packages/db/src/migrations.ts` applies files in numerical order:
1. Migrations from `db/migrations/`
2. Stored procedures from `db/procs/`

Both directories share the same migration tracking table (`schema_migrations`).

## Development Workflow

1. Create a new migration file in `db/migrations/` with the next number
2. Create corresponding stored procedures in `db/procs/` with the next number
3. Run migrations: `pnpm --filter @qa-platform/db run migrate` (or via migrator service)
4. Test the stored procedures via the `packages/db` proc-invocation wrapper

## Important Notes

- Never delete database objects without explicit approval
- Never delete data without explicit request
- Analyze dependencies before executing scripts
- Use the public schema for all objects (unless requirements specify otherwise)
- All inserts/updates/reads must use stored procedures
