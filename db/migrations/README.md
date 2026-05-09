# Database Migrations

This directory contains numbered SQL migration files for schema changes.

## Naming Convention

Files must be named in the format: `XXXX_description.sql` where XXXX is a 4-digit number.

Examples:
- `0001_create_operators_table.sql`
- `0002_create_roles_table.sql`
- `0003_add_audit_columns.sql`

## Execution Order

Migrations are executed in numerical order by the migration runner in `packages/db/src/migrations.ts`.

## Guidelines

- Each migration should be idempotent (safe to run multiple times)
- Use `IF NOT EXISTS` for CREATE statements
- Wrap migrations in BEGIN/END blocks when using variables
- Include comments explaining what the migration does
- Follow snake_case naming for all tables and columns
- Every table must include: created_date, updated_date, created_by, updated_by

## Audit Columns

All tables should include these standard audit columns:

```sql
created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
created_by VARCHAR(255) NOT NULL,
updated_by VARCHAR(255) NOT NULL
```

## Example Migration

```sql
-- Create operators table for authentication
BEGIN;

CREATE TABLE IF NOT EXISTS operators (
  id SERIAL PRIMARY KEY,
  login VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_operators_login ON operators(login);

COMMIT;
```
