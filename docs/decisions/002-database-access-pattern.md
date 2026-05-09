# ADR 002: Database Access Pattern

## Status

Accepted

## Context

The QA Automation Platform uses PostgreSQL as its primary data store. We need a consistent, secure, and maintainable pattern for all database access across the application.

## Decision

All database access must go through **PostgreSQL stored procedures**. No ad-hoc SQL is allowed in application code.

### Pattern

1. **Stored Procedures Only**: All reads, inserts, and updates use stored procedures
2. **Typed Wrappers**: packages/db provides TypeScript wrappers for proc invocation
3. **Tabular Returns**: Procedures return result sets (tables), not JSON
4. **Parameterized Queries**: All proc calls use parameterized queries (no SQL injection risk)
5. **Audit Columns**: All tables include created_date, updated_date, created_by, updated_by

### Implementation

**Stored Procedure Naming**:
```
XXXX_sp_entity_action.sql
```
Example: `0006_sp_sites_insert.sql`

**Procedure Signature**:
```sql
CREATE OR REPLACE FUNCTION sp_sites_insert(
    i_name VARCHAR(255),
    i_base_url VARCHAR(2048),
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(255),
    ...
)
```

**Application Code**:
```typescript
import { invokeProc, invokeProcScalar, invokeProcWrite } from '@qa-platform/db';

// Read with result set
const sites = await invokeProc('sp_sites_list', { i_is_active: true });

// Write operation
const result = await invokeProcWrite('sp_sites_insert', {
  i_name: 'Example Site',
  i_base_url: 'https://example.com',
  i_created_by: 'admin'
});
```

### Migration Strategy

- Numbered SQL files in `db/migrations/` for schema changes
- Numbered SQL files in `db/procs/` for stored procedures
- Sequential versioning across both directories (0001, 0002, 0003, ...)
- Migration runner tracks applied versions via schema_migrations table
- SHA-256 checksums for migration integrity

## Consequences

### Positive

- Business logic centralized in database layer
- Type safety via TypeScript wrappers
- SQL injection prevention via parameterized queries
- Clear audit trail via audit columns
- Performance optimization possible at database level
- Easier to evolve schema without application changes

### Negative

- Slower initial development (need to write procs)
- Database becomes deployment bottleneck
- Testing requires database setup
- Refactoring business logic requires proc changes
- Debugging requires database-level tools

### Alternatives Considered

- **ORM (Prisma, TypeORM)**: Rejected per global rules - database-first approach preferred
- **Query Builder (Knex, Kysely)**: Rejected - stored procedures provide better encapsulation
- **Direct SQL in app code**: Rejected - violates separation of concerns, SQL injection risk
- **GraphQL**: Rejected - overkill for our use case, adds complexity

## References

- Master Plan §5.1: Conventions
- Master Plan §5.4: Stored Procedure Set
- Global Rules: Database Principles
