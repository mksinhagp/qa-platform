# Stored Procedures

This directory contains numbered SQL files defining PostgreSQL stored procedures.

## Naming Convention

Files must be named in the format: `XXXX_sp_entity_action.sql` where:
- XXXX is a 4-digit number
- sp_ prefix indicates stored procedure
- entity is the table name (singular)
- action describes the operation (insert, update, delete, get_by_id, list, etc.)

Examples:
- `0001_sp_operators_insert.sql`
- `0002_sp_operators_update.sql`
- `0003_sp_operators_get_by_login.sql`
- `0004_sp_sites_list.sql`

## Parameter Naming

Per global rules, use snake_case with prefixes:
- `i_` for input parameters
- `o_` for output parameters
- `io_` for input/output parameters

## Procedure Structure

```sql
-- Insert a new operator
-- Returns: operator_id
CREATE OR REPLACE FUNCTION sp_operators_insert(
  i_login VARCHAR(255),
  i_password_hash VARCHAR(255),
  i_display_name VARCHAR(255),
  i_created_by VARCHAR(255)
) RETURNS INTEGER AS $$
BEGIN
  INSERT INTO operators (
    login,
    password_hash,
    display_name,
    created_by,
    updated_by
  ) VALUES (
    i_login,
    i_password_hash,
    i_display_name,
    i_created_by,
    i_created_by
  )
  RETURNING id;
END;
$$ LANGUAGE plpgsql;
```

## Guidelines

- All database access must go through stored procedures (per global rules)
- Procs should return tabular/scalar datasets only (no JSON)
- Use RETURNS TABLE(...) for multi-column result sets
- Use RETURNS <type> for single scalar values
- Include comments explaining the proc's purpose
- Parameterized queries only - never concatenate strings
- Handle errors appropriately with EXCEPTION blocks when needed
- Use snake_case for all identifiers

## Return Types

- **Scalar**: Use `RETURNS <type>` for single values (id, count, boolean)
- **Table**: Use `RETURNS TABLE(...)` for multi-column result sets
- **Void**: Use `RETURNS VOID` for operations with no return value

## Example: Table Return

```sql
-- Get operator by login with all fields
CREATE OR REPLACE FUNCTION sp_operators_get_by_login(
  i_login VARCHAR(255)
) RETURNS TABLE(
  id INTEGER,
  login VARCHAR(255),
  display_name VARCHAR(255),
  active BOOLEAN,
  created_date TIMESTAMP WITH TIME ZONE,
  updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    login,
    display_name,
    active,
    created_date,
    updated_date
  FROM operators
  WHERE login = i_login;
END;
$$ LANGUAGE plpgsql;
```
