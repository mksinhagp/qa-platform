# ADR 010: Multi-Site Tenant Isolation Review

## Status

Active — Phase 13.2 baseline isolation review

## Context

The QA Automation Platform was designed with a single-site deployment model (Yugal Kunj) as the initial use case. As the platform matures, the requirement to support multiple independent sites (tenants) on the same infrastructure instance has emerged. This document analyzes the current data isolation mechanisms, identifies gaps, and provides a roadmap for safe multi-site deployment.

Multi-site isolation is critical because:
- Different sites may be managed by different operators with different access privileges
- Test data, credentials, and results must never leak between sites
- Audit trails must be clearly separated for compliance and troubleshooting
- Operational errors in one site must not impact another site's data or operations

This review examines database-level foreign key relationships, application-layer RBAC controls, vault access patterns, and operational procedures to ensure proper tenant separation.

## Decision

### Current Isolation Posture: Partially Isolated with Critical Gaps

The platform implements **strong database-level isolation** for core tenant data through foreign key relationships from `sites` and `site_environments` tables. However, **critical gaps exist in RBAC scoping, audit visibility, and resource sharing** that must be addressed before multi-site deployment.

### Isolation Analysis by Layer

#### 1. Database-Level Data Isolation

**Sites and Environments (0003_site_tables.sql)**
- **Mechanism**: `sites` table is the root tenant boundary. All downstream tables reference `site_id` or `site_environment_id` via foreign keys.
- **Isolation Quality**: **Strong** - Cascading deletes prevent orphaned data. FK constraints enforce referential integrity.
- **Assessment**: No gaps identified. This is the foundation of tenant isolation.

**Runs and Executions (0005_run_tables.sql)**
- **Mechanism**: `runs.site_id` and `runs.site_environment_id` provide direct tenant scoping. All child tables (`run_executions`, `run_steps`, `approvals`, `artifacts`) cascade from `runs`.
- **Isolation Quality**: **Strong** - Complete FK chain ensures no cross-site data mixing.
- **Stored Procedure Analysis**: `sp_runs_list` (0069) properly filters by `i_site_id` parameter. When `i_site_id IS NULL`, it returns runs from ALL sites, which is appropriate for admin views but requires capability gating.
- **Assessment**: Database isolation is solid. Application-layer controls must ensure unauthorized operators cannot call with `i_site_id = NULL`.

**Credentials and Secrets (0007_secret_tables.sql, 0008_credential_tables.sql)**
- **Mechanism**: 
  - `site_credentials` has explicit `site_id` and `site_environment_id` FK columns
  - `secret_records.owner_scope` is a string field (e.g., `sites/yugal-kunj/credentials/admin`) with no FK enforcement
  - `payment_profiles` and `email_inboxes` are global resources, bound to sites via `site_env_payment_bindings` and `site_env_email_bindings`
- **Isolation Quality**: **Mixed** - Strong for site_credentials, **weak for secret_records**.
- **Critical Gap**: `secret_records.owner_scope` is not enforced by database constraints. A bug in application code could reference a secret from site A in a credential for site B.
- **Assessment**: The shared resource model for payment/email profiles is acceptable, but secret scope validation must be hardened.

**Approval Policies (0009_approval_policies_table.sql)**
- **Mechanism**: Global table with no `site_id` column.
- **Isolation Quality**: **By Design** - Policies are intended to be platform-wide governance rules.
- **Assessment**: This is intentional and acceptable. Approval policies should be consistent across all sites for compliance.

**Audit Logs (0002_system_vault_audit_tables.sql)**
- **Mechanism**: `audit_logs` table has no `site_id` column. Uses `target_type` and `target_id` for context.
- **Isolation Quality**: **Gap** - Operators can potentially see audit events from other sites.
- **Assessment**: In single-operator model this is acceptable, but becomes a privacy issue with multiple operators managing different sites.

**Personas, Device Profiles, Network Profiles (0004_persona_device_network_tables.sql)**
- **Mechanism**: Global tables with no `site_id` columns. Marked with `is_system = TRUE`.
- **Isolation Quality**: **By Design** - These are shared test library resources.
- **Assessment**: Intentionally global. All sites benefit from the same persona library and device/network profiles.

**LLM Analysis Results (0018_llm_analysis_tables.sql)**
- **Mechanism**: `llm_analysis_results.run_execution_id` provides transitive isolation via runs → sites.
- **Isolation Quality**: **Strong** - Proper FK chain ensures site-level isolation.
- **Assessment**: No gaps identified. Isolation is traceable through the execution chain.

#### 2. Application-Layer Isolation

**RBAC Model (0001_auth_rbac_tables.sql, capabilities.ts, guards.ts)**
- **Mechanism**: Role-based capabilities without site scoping. `operator_role_assignments` table has no `site_id` column.
- **Isolation Quality**: **Critical Gap** - All operators with a role have access to ALL sites.
- **Gap Details**: 
  - No per-site role assignment capability
  - `hasCapability()` and related functions check global capabilities only
  - Guards (`requireCapability`, `requireAnyCapability`) do not validate site access
- **Assessment**: This is the most critical gap preventing multi-site deployment.

**Session and Vault Isolation**
- **Mechanism**: Vault is site-agnostic with single master password. Unlock sessions are per-operator but not per-site.
- **Isolation Quality**: **Acceptable for v1** but needs attention for multi-operator.
- **Gap**: An operator's vault session can decrypt secrets for any site they have access to. With proper RBAC scoping, this is acceptable.
- **Assessment**: Shared vault is operationally simpler. The master password governance (ADR 007) provides adequate protection.

**Site Rules Files**
- **Mechanism**: Rules loaded from `sites/<siteId>/rules.ts` with path traversal protection via regex.
- **Isolation Quality**: **Strong** - File system isolation and regex validation prevent cross-site contamination.
- **Assessment**: No gaps identified. Cache isolation should be verified but appears correct.

#### 3. Operational Isolation

**Secret Access Logging (0007_secret_tables.sql)**
- **Mechanism**: `secret_access_logs` records every secret access with operator_id, run_execution_id, and timestamp.
- **Isolation Quality**: **Strong** - Complete audit trail with site context via run_execution_id.
- **Assessment**: Well-designed for multi-site accountability.

**Runner Callback Isolation**
- **Mechanism**: Runner callbacks include site context in execution metadata.
- **Isolation Quality**: **Strong** - Callbacks are routed to specific run executions which are site-scoped.
- **Assessment**: No cross-site contamination risk identified.

### Gap Summary Table

| Table/Component | Isolation Mechanism | Gap | Severity | Resolution |
|---|---|---|---|---|
| `operator_role_assignments` | Global role assignments | No site-scoped role assignments | Must fix before second site | Add `site_id` column and update RBAC logic |
| `capabilities.ts` guards | Global capability checks | No site access validation | Must fix before second site | Add site context to capability checks |
| `secret_records.owner_scope` | String convention only | No FK enforcement of scope | Must fix before second site | Add CHECK constraint or FK validation |
| `audit_logs` | Global table with target context | No site_id column | Acceptable for v1, fix before multi-operator | Add `site_id` column for visibility filtering |
| `sp_runs_list` procedure | Optional site filter | Returns all sites when i_site_id=NULL | Must fix before second site | Add capability check for cross-site access |
| `payment_profiles` | Global with bindings | Shared resource model | By design | Document as intentional sharing |
| `email_inboxes` | Global with bindings | Shared resource model | By design | Document as intentional sharing |
| `approval_policies` | Global table | Platform-wide governance | By design | Document as intentional sharing |
| Personas/Device/Network profiles | Global system data | Shared test library | By design | Document as intentional sharing |

### Recommendations

#### Must Fix Before Second Site

1. **Add Site-Scoped RBAC**
   ```sql
   -- Add site_id to operator_role_assignments
   ALTER TABLE operator_role_assignments 
   ADD COLUMN site_id INTEGER REFERENCES sites(id);
   
   -- Create unique constraint for per-site role assignments
   ALTER TABLE operator_role_assignments 
   ADD CONSTRAINT uq_operator_site_role 
   UNIQUE(operator_id, site_id, role_id);
   ```
   - Update `capabilities.ts` to accept optional `siteId` parameter
   - Modify guards to validate site access when `siteId` is provided
   - Create stored procedures for site-scoped capability resolution

2. **Enforce Secret Scope Validation**
   ```sql
   -- Add check constraint to owner_scope format
   ALTER TABLE secret_records 
   ADD CONSTRAINT chk_owner_scope_format 
   CHECK (owner_scope ~ '^sites/[^/]+/credentials/[^/]+$');
   
   -- Add trigger to validate scope matches credential's site
   CREATE OR REPLACE FUNCTION trg_validate_secret_scope()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Validate that secret owner_scope matches the site_environment's site
     IF NEW.owner_scope IS NOT NULL THEN
       -- Extract site name from scope and validate against site_credentials
       -- Implementation needed
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Update Stored Procedures for Site Scoping**
   - Modify `sp_runs_list` to require `sites_view_all` capability when `i_site_id IS NULL`
   - Add site context to all credential-related stored procedures
   - Ensure all list procedures have appropriate capability checks

#### Acceptable for v1 (Single Operator)

1. **Audit Log Cross-Site Visibility**
   - Current single-operator model means no privacy risk
   - Plan: Add `site_id` column before adding second operator
   - Migration: `ALTER TABLE audit_logs ADD COLUMN site_id INTEGER REFERENCES sites(id);`

2. **Shared Vault Master Password**
   - Acceptable with proper governance (ADR 007)
   - Two-person rule and rotation procedures provide adequate protection
   - Consider per-site vault keys only if regulatory requirements demand it

#### By Design (No Changes Needed)

1. **Shared Resources**
   - `payment_profiles` and `email_inboxes` as global resources with site bindings
   - `approval_policies` as platform-wide governance
   - Personas, device profiles, network profiles as shared test library

2. **Operational Procedures**
   - Secret access logging provides complete audit trail
   - Runner callbacks properly scoped to executions
   - Site rules file loading is secure

### Pre-Second-Site Checklist

1. [ ] **Database Schema Updates**
   - [ ] Add `site_id` column to `operator_role_assignments`
   - [ ] Add unique constraint for per-site role assignments
   - [ ] Add CHECK constraint to `secret_records.owner_scope`
   - [ ] Create trigger for secret scope validation
   - [ ] Add `site_id` column to `audit_logs` (for future multi-operator)

2. [ ] **RBAC Implementation**
   - [ ] Update `capabilities.ts` to support site-scoped capability checks
   - [ ] Modify `guards.ts` to validate site access
   - [ ] Create `sp_capabilities_for_operator_site` stored procedure
   - [ ] Add `sites_view_all` capability for cross-site admin access
   - [ ] Update all server actions to pass site context to capability checks

3. [ ] **Stored Procedure Security**
   - [ ] Audit all list procedures for cross-site access risks
   - [ ] Add capability checks to procedures that accept optional site filters
   - [ ] Update `sp_runs_list` to require `sites_view_all` for global access
   - [ ] Test all credential procedures with site-scoped access

4. [ ] **Application Layer Updates**
   - [ ] Update all dashboard components to handle site-scoped access
   - [ ] Add site selection UI for operators with multi-site access
   - [ ] Update API routes to validate site context
   - [ ] Add site context to all relevant audit log entries

5. [ ] **Testing and Validation**
   - [ ] Create test suite for site isolation scenarios
   - [ ] Test cross-site data access attempts (should fail)
   - [ ] Validate secret scope enforcement
   - [ ] Test RBAC with per-site role assignments
   - [ ] Verify audit trails maintain site context

6. [ ] **Documentation and Procedures**
   - [ ] Document shared resource model (payment/email profiles)
   - [ ] Update operational runbooks for multi-site scenarios
   - [ ] Create procedure for adding new sites
   - [ ] Document capability matrix for multi-site operators

7. [ ] **Migration Planning**
   - [ ] Create migration script for schema changes
   - [ ] Plan data migration for existing role assignments
   - [ ] Test migration on staging environment
   - [ ] Create rollback procedure

## Consequences

### Positive

- **Strong Foundation**: The existing FK-based isolation provides a solid base for multi-site deployment
- **Comprehensive Audit Trail**: Secret access logging and execution tracking provide complete accountability
- **Scalable Model**: Site-scoped RBAC will enable flexible operator management across multiple sites
- **Shared Resource Efficiency**: Global personas, devices, and network profiles reduce duplication while maintaining isolation

### Negative

- **RBAC Complexity**: Site-scoped role assignments increase the complexity of user management
- **Migration Effort**: Schema changes and application updates required before second site deployment
- **Operational Overhead**: Multi-site deployment requires additional procedures and monitoring

### Risks

- **Implementation Risk**: Complex RBAC changes could introduce security bugs if not thoroughly tested
- **Data Migration Risk**: Schema changes must be carefully planned to avoid data loss
- **Operational Risk**: New multi-site procedures must be documented and followed to prevent misconfiguration

## References

- ADR 003: Vault Cryptography Design
- ADR 006: Security Review (findings F-01 through F-13)
- ADR 007: Vault Operations Policy
- Migration files: 0001-0018 (database schema)
- Stored procedures: sp_sites_insert, sp_runs_list
- Auth package: capabilities.ts, guards.ts
- Security review findings on RBAC and session management