# ADR 008: Performance Indexing — Phase 12.1

## Status

Accepted — Phase 12.1 baseline review. Re-run analysis before any schema change that adds significant write volume to the tables covered here.

## Context

As of migration 0019, the schema has 19 tables. Migrations 0001–0019 created single-column indexes on the most obviously filtered columns, which was appropriate at the time each table was introduced in isolation. Phase 12.1 is the first cross-cutting analysis that examines query patterns across all stored procedures together.

The triggering conditions for this review are:

- Phase 9 introduced six reporting stored procedures (0117–0122) that perform multi-table joins filtered by `run_id` or `execution_id`. These procs are called on every dashboard report render, which is synchronous from the user's perspective.
- Phase 11.1 introduced artifact retention procs (0123, 0125) that scan the `artifacts` table with two-branch OR expiry predicates. These run as scheduled jobs; slow scans degrade job reliability under large artifact volumes.
- `RUNNER_CONCURRENCY` defaults to 4, meaning up to four executions write run steps, friction signals, and artifacts simultaneously. At higher concurrency the benefit of selective composite indexes is amplified because each query touches a narrower fraction of a larger table.
- The `sp_audit_logs_query` proc (0021) is the sole read path for the audit log viewer. `audit_logs` is append-only and grows unboundedly; a single-column date index without a leading actor filter becomes a progressively wider range scan as the table grows.

**Scope of this review:**

- Migrations 0001–0019 (all table and index definitions)
- Stored procedures 0021, 0116–0123, 0125
- `RUNNER_CONCURRENCY` environment variable (default 4)

**What this review does not cover:**

- EXPLAIN ANALYZE output (no live database available during this review). All analysis is based on query-planner fundamentals: index selectivity, scan type selection, sort elimination, and write amplification trade-offs.
- Query plan regression testing. EXPLAIN ANALYZE should be run against a populated database before and after applying this migration in a staging environment.
- Tables not touched by the procs above (e.g., `personas`, `device_profiles`, `network_profiles`, `system_settings`, `secret_records`). These are either lookup tables with low row counts or write-heavy tables accessed by primary key.

## Decision

Apply migration `0020_performance_indexes.sql`, which adds 14 new indexes across 7 tables. No existing indexes are removed or modified. All `CREATE INDEX` statements use `IF NOT EXISTS` to be idempotent.

## Analysis

### Existing index coverage assessment

| Table | Existing indexes | Assessment |
|---|---|---|
| `runs` | site_id, site_environment_id, status, started_by, started_at, is_pinned | Adequate for single-column lookups. Missing composite for multi-column dashboard filters. |
| `run_executions` | run_id, persona_id, status, browser, flow_name | run_id and status are separate; reporting procs filter both simultaneously. |
| `run_steps` | run_execution_id, step_order, status, approval_id | execution_id and status are separate; step_order not composite with execution_id. |
| `approvals` | run_step_id, category, status, timeout_at | status and timeout_at are separate; approval poller needs both in one scan. |
| `artifacts` | run_execution_id, artifact_type, retention_date | retention_date index includes NULL rows; both expiry branches are suboptimal. |
| `friction_signals` | run_execution_id, signal_type, occurred_at | Separate; DISTINCT ON and GROUP BY in 0120 use the composite key simultaneously. |
| `llm_analysis_results` | Run_Execution_Id (+ unique), Status | Status index covers all statuses; failed-execution query only cares about actionable ones. |
| `api_test_suites` | run_execution_id, suite_type, status | Status index is full; dashboard failure panel only reads failed rows. |
| `email_validation_runs` | run_execution_id, inbox_id, status, correlation_token | Status index is full; poller only cares about pending rows. |
| `audit_logs` | actor_type, actor_id, action, target_type, target_id, created_date, status | created_date and actor_id are separate; time-range + actor filter merges two bitmap indexes. |

### Stored procedure query pattern analysis

#### sp_report_run_summary (0122)

Query pattern:
```sql
FROM runs r
LEFT JOIN run_executions re ON r.id = re.run_id
WHERE r.id = i_run_id
GROUP BY ...
```
The join on `run_executions.run_id` is already covered by `idx_run_executions_run_id`. The aggregation on `re.status` adds no additional index need here because the join drives the full set of rows for one run. IDX-01 primarily benefits the other reporting procs that add a status predicate to the same join column.

#### sp_report_persona_summary (0117)

Query pattern:
```sql
FROM run_executions re
WHERE re.run_id = i_run_id  -- outer query
-- AND re.run_id = i_run_id  -- CTE ranked_issues
```
Two separate scans of `run_executions` filtered by `run_id`. The status aggregation is computed as conditional `COUNT(CASE WHEN status IN (...))`, not a WHERE filter, so the composite on `(run_id, status)` does not narrow rows here but does eliminate the need to re-read the `status` column from the heap if PostgreSQL chooses an index-only scan (possible after a VACUUM).

#### sp_report_accessibility_summary (0118)

Query pattern:
```sql
FROM run_steps rs
JOIN run_executions re ON rs.run_execution_id = re.id
WHERE re.run_id = i_run_id
  AND rs.details -> 'accessibility' IS NOT NULL
```
The planner's most selective path is to find the executions for the run first (`idx_run_executions_run_id`), then look up run_steps per execution. IDX-02 `(run_execution_id, status)` narrows the run_steps scan; IDX-04 `(run_execution_id, step_order)` is not used here (no ORDER BY step_order in this proc), but the composite on execution_id is still beneficial as a leading column for the join.

#### sp_report_issues_deduplicated (0119)

Query pattern:
```sql
FROM run_steps rs
JOIN run_executions re ON rs.run_execution_id = re.id
WHERE re.run_id = i_run_id
  AND rs.status = 'failed'
  AND rs.error_message IS NOT NULL
```
This is the highest-value beneficiary of IDX-02. After the planner resolves the execution IDs for the run (via `idx_run_executions_run_id`), it must find all failed steps for each execution. Without a composite, it must use `idx_run_steps_run_execution_id` and then filter `status = 'failed'` in memory across all steps. With IDX-02 `(run_execution_id, status)`, only failed steps for each execution are returned by the index scan.

#### sp_report_friction_signals (0120)

Query pattern (outer query and CTE first_signals both scan friction_signals):
```sql
FROM friction_signals fs
JOIN run_executions re ON fs.run_execution_id = re.id
WHERE re.run_id = i_run_id
-- DISTINCT ON (fs.run_execution_id, fs.signal_type) in CTE
-- GROUP BY (fs.run_execution_id, fs.signal_type) in outer
```
IDX-03 `(run_execution_id, signal_type)` serves both the DISTINCT ON grouping (which PostgreSQL can satisfy with a sorted index scan rather than a sort node) and the GROUP BY aggregation in the outer query. This eliminates a sort step on what can be a large friction_signals result set for a concurrent run.

#### sp_report_execution_detail (0121)

Query pattern (two UNION ALL branches):
- Branch 1: `LEFT JOIN run_steps rs ON re.id = rs.run_execution_id WHERE re.id = i_execution_id ORDER BY step_order`
- Branch 2: `INNER JOIN artifacts a ON re.id = a.run_execution_id WHERE re.id = i_execution_id`

IDX-04 `(run_execution_id, step_order)` covers Branch 1: the composite satisfies the join predicate and provides pre-sorted rows, eliminating the sort on `step_order NULLS LAST`.

IDX-05 `(run_execution_id, artifact_type)` covers Branch 2: the composite satisfies the join predicate; `artifact_type` is included for future queries that filter by type within an execution.

#### sp_artifacts_list_expired (0123)

Query pattern:
```sql
FROM artifacts a
LEFT JOIN artifact_retention_config arc ON arc.artifact_type = a.artifact_type AND arc.is_active = TRUE
WHERE
    (a.retention_date IS NOT NULL AND a.retention_date < NOW())
    OR
    (a.retention_date IS NULL AND arc.id IS NOT NULL AND (a.created_date + interval) < NOW())
ORDER BY a.created_date ASC LIMIT i_limit
```
The OR predicate means the existing `idx_artifacts_retention_date` must be supplemented by a full scan of the `retention_date IS NULL` population. IDX-12 is a partial index over `retention_date IS NOT NULL` rows only, covering Case (a). IDX-13 is a partial index over `retention_date IS NULL` rows covering Case (b). The planner can use a `BitmapOr` of two partial index scans rather than a full sequential scan, or (in many cases) use the partial index for the limiting LIMIT clause directly.

#### sp_artifacts_retention_audit (0125)

Query pattern:
```sql
FROM artifacts a
LEFT JOIN artifact_retention_config arc ON ...
GROUP BY a.artifact_type
```
IDX-13 `(artifact_type, created_date)` supports the `GROUP BY artifact_type` aggregation and the `MIN(a.created_date)` calculation for the `o_oldest_artifact` column. With this composite the planner can use an index scan to pre-group by artifact_type and compute MIN(created_date) as the first entry per group, avoiding a full table sort.

#### sp_llm_analysis_list_failed_executions (0116)

Query pattern:
```sql
FROM run_executions re
INNER JOIN run_steps rs ON rs.Run_Execution_Id = re.Id AND rs.Status IN ('failed','error')
WHERE re.Run_Id = i_run_id
  AND NOT EXISTS (
      SELECT 1 FROM llm_analysis_results lar
      WHERE lar.Run_Execution_Id = re.Id
        AND lar.Task_Type = 'failure_summarization'
  )
```
The INNER JOIN on run_steps benefits from IDX-02 `(run_execution_id, status)`.

The NOT EXISTS subquery probes `llm_analysis_results` by `(Run_Execution_Id, Task_Type)`. The unique index `uq_llm_analysis_results_exec_task` already covers this lookup with equality on both columns; the NOT EXISTS is served efficiently. IDX-09 adds a partial index on `(run_execution_id)` for `status IN ('pending','error')` as a supplementary path for ad-hoc queries that filter by status alone without the task_type predicate.

#### sp_audit_logs_query (0021)

Query pattern:
```sql
FROM audit_logs al
WHERE
    (i_actor_type IS NULL OR al.actor_type = i_actor_type)
    AND (i_actor_id IS NULL OR al.actor_id = i_actor_id)
    AND (i_action IS NULL OR al.action = i_action)
    AND (i_start_date IS NULL OR al.created_date >= i_start_date)
    AND (i_end_date IS NULL OR al.created_date <= i_end_date)
    AND (i_status IS NULL OR al.status = i_status)
ORDER BY al.created_date DESC
LIMIT i_limit
```
The most common admin invocation provides a date range and optionally an actor_id. The existing separate indexes on `created_date` and `actor_id` require a bitmap-and merge. IDX-14 `(created_date DESC, actor_id)` satisfies the range scan on the leading column and the optional actor filter within the range in a single index scan. The `ORDER BY created_date DESC` is served directly by the index direction, eliminating a sort node.

### Overlap with Phase 10.2 security findings (ADR 006)

The following security findings from ADR 006 have a direct or indirect relationship to database access patterns addressed in this migration:

| ADR 006 Finding | Relationship to this migration |
|---|---|
| F-01 — No TLS | Not related to indexing. TLS affects transport, not query plans. |
| F-08 — `getVaultStateAction` has no auth check | Relates to `vault_state` table access. `vault_state` has one row; no indexing opportunity. |
| F-10 — `queryAuditLogs` accessible to all operators | `sp_audit_logs_query` is the proc in question. IDX-14 improves its performance, which is independently motivated. Restricting access (the security fix) does not change the index requirement. |
| F-16 — No concurrent session limit | Relates to `operator_sessions` table. Not in scope for this migration; the sessions table has its own index on `session_token`. |
| A09 — Login success/failure not audit-logged | If login events are added to `audit_logs` (the recommended fix), write volume to `audit_logs` will increase. IDX-14 is a write-once (append-only table) cost; its benefit scales with the volume added by security logging improvements. |

No ADR 006 finding directly conflicts with any index added here. Security fixes that increase audit log write volume (A09, F-10) increase IDX-14's value further.

### Runner concurrency amplification effect

At `RUNNER_CONCURRENCY=4` (the default), four executions operate simultaneously. Each writes to:

- `run_steps` (IDX-02, IDX-04 benefit)
- `friction_signals` (IDX-03 benefit)
- `artifacts` (IDX-05, IDX-12, IDX-13 benefit)
- `approvals` (IDX-08 benefit)

The index write overhead for composite indexes is proportional to the number of rows inserted. At concurrency 4, four sets of index pages are in the WAL simultaneously. Partial indexes (IDX-08, IDX-09, IDX-10, IDX-11) reduce this overhead because only rows matching the partial predicate (e.g., `status = 'pending'`) are indexed; once the row transitions to a terminal status, no further index maintenance occurs for those partial indexes.

If `RUNNER_CONCURRENCY` is raised beyond 4 in production, re-evaluate whether additional partial indexes on hot paths are needed.

## Index catalog

| Index ID | Index name | Table | Columns | Type | Replaces / supplements |
|---|---|---|---|---|---|
| IDX-01 | `idx_run_executions_run_id_status` | `run_executions` | `(run_id, status)` | Composite | Supplements separate `idx_run_executions_run_id` and `idx_run_executions_status` |
| IDX-02 | `idx_run_steps_execution_id_status` | `run_steps` | `(run_execution_id, status)` | Composite | Supplements separate `idx_run_steps_run_execution_id` and `idx_run_steps_status` |
| IDX-03 | `idx_friction_signals_execution_id_signal_type` | `friction_signals` | `(run_execution_id, signal_type)` | Composite | Supplements separate `idx_friction_signals_execution_id` and `idx_friction_signals_signal_type` |
| IDX-04 | `idx_run_steps_execution_id_step_order` | `run_steps` | `(run_execution_id, step_order)` | Composite | New; no prior composite covering these two columns |
| IDX-05 | `idx_artifacts_execution_id_type` | `artifacts` | `(run_execution_id, artifact_type)` | Composite | Supplements separate `idx_artifacts_run_execution_id` and `idx_artifacts_artifact_type` |
| IDX-06 | `idx_runs_site_id_status_started_at` | `runs` | `(site_id, status, started_at DESC)` | Composite | Supplements three separate single-column indexes |
| IDX-07 | `idx_runs_is_pinned_started_at` | `runs` | `(is_pinned, started_at DESC)` | Composite | Supplements `idx_runs_is_pinned` and `idx_runs_started_at` |
| IDX-08 | `idx_approvals_pending_timeout` | `approvals` | `(timeout_at ASC)` WHERE `status='pending'` | Partial | Supplements full `idx_approvals_status` and `idx_approvals_timeout_at` |
| IDX-09 | `idx_llm_analysis_results_pending_error` | `llm_analysis_results` | `(run_execution_id)` WHERE `status IN ('pending','error')` | Partial | Supplements full `idx_llm_analysis_results_status` |
| IDX-10 | `idx_api_test_suites_failed` | `api_test_suites` | `(run_execution_id)` WHERE `status='failed'` | Partial | Supplements full `idx_api_test_suites_status` |
| IDX-11 | `idx_email_validation_runs_pending` | `email_validation_runs` | `(run_execution_id)` WHERE `status='pending'` | Partial | Supplements full `idx_email_validation_runs_status` |
| IDX-12 | `idx_artifacts_retention_date_notnull` | `artifacts` | `(retention_date ASC, created_date ASC)` WHERE `retention_date IS NOT NULL` | Partial composite | Supplements full `idx_artifacts_retention_date` |
| IDX-13 | `idx_artifacts_type_created_no_retention_date` | `artifacts` | `(artifact_type, created_date ASC)` WHERE `retention_date IS NULL` | Partial composite | New; no prior index on this predicate combination |
| IDX-14 | `idx_audit_logs_created_date_actor_id` | `audit_logs` | `(created_date DESC, actor_id)` | Composite | Supplements separate `idx_audit_logs_created_date` and `idx_audit_logs_actor_id` |

## Consequences

### Positive

- Reporting procs (0117–0122) eliminate bitmap-and merges on `run_executions` and `run_steps` for the most common filter pattern `(run_id, status)`. At default `RUNNER_CONCURRENCY=4`, a typical run with 20 executions × 10 steps each (200 run_steps rows) benefits marginally; a run with 100 executions × 30 steps (3,000 run_steps rows) benefits materially.
- `sp_report_execution_detail` (0121) eliminates a sort node on `step_order` for every execution detail page load. This is a synchronous user-facing operation.
- `sp_artifacts_list_expired` (0123) transitions from a possible full sequential scan to two targeted partial index scans, bounded by `LIMIT i_limit` (default 500). This is critical for scheduled jobs that run against tables with many thousands of artifact rows.
- Partial indexes (IDX-08 through IDX-11) are intentionally narrow: they index only rows in actionable states (`pending`, `failed`, `error`). Once a row transitions to a terminal state it is no longer indexed in these partials, keeping index maintenance cost proportional to active work rather than historical volume.
- IDX-14 on `audit_logs` converts a growing unbounded scan into a bounded range scan, which is critical for operational compliance: as ADR 007 Policy 5.3 mandates one year of audit log retention, the table is expected to hold hundreds of thousands of rows in production.

### Negative / trade-offs

- **Write amplification:** Each new index increases the per-INSERT cost on its table. The 14 indexes added here are distributed across 7 tables. The most write-intensive tables during a run are `run_steps` (IDX-02, IDX-04 — two new composite indexes) and `artifacts` (IDX-05, IDX-12, IDX-13 — three new indexes of which two are partial and therefore cheaper). This overhead is proportional to write volume and is acceptable given the read-to-write ratio of an analytics-heavy QA platform.
- **Existing single-column indexes are not removed.** Composite indexes do not replace their component single-column indexes in all query patterns. Removing single-column indexes would risk plan regressions for queries not analysed here (e.g., ad-hoc REPL queries, future procs). The additional storage cost of retaining both is accepted.
- **No EXPLAIN ANALYZE validation.** All analysis in this document is based on query-planner fundamentals. Before applying this migration in production, the following should be confirmed on a staging database with representative data volumes:
  - `EXPLAIN (ANALYZE, BUFFERS)` on each reporting proc with a run containing at least 50 executions.
  - `EXPLAIN (ANALYZE, BUFFERS)` on `sp_artifacts_list_expired` with at least 10,000 artifact rows.
  - `EXPLAIN (ANALYZE, BUFFERS)` on `sp_audit_logs_query` with at least 50,000 audit log rows (representative of six months of production activity at moderate use).
- **Index bloat under high churn.** If future features cause high UPDATE rates on `status` columns (e.g., rapid execution state transitions), partial indexes will incur HOT update overhead. This is not expected to be significant at current concurrency levels but should be monitored with `pg_stat_user_indexes` in production.

## Validation checklist

Before applying in production:

- [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` on procs 0117–0122 against a staging DB with representative data.
- [ ] Confirm `idx_run_steps_execution_id_status` and `idx_run_executions_run_id_status` are used (not just created) in reporting query plans.
- [ ] Confirm `idx_approvals_pending_timeout` is used by the approval poller query.
- [ ] Confirm `idx_artifacts_retention_date_notnull` and `idx_artifacts_type_created_no_retention_date` eliminate sequential scans in `sp_artifacts_list_expired`.
- [ ] Confirm `idx_audit_logs_created_date_actor_id` eliminates the bitmap-and merge in `sp_audit_logs_query` for date-range + actor_id queries.
- [ ] Review `pg_stat_user_indexes` after one week of production load to identify any indexes with zero or near-zero `idx_scan` counts.

## References

- `db/migrations/0020_performance_indexes.sql` — migration that implements all indexes in this ADR
- `db/procs/0117_sp_report_persona_summary.sql` — reporting proc: run_executions filter by run_id
- `db/procs/0118_sp_report_accessibility_summary.sql` — reporting proc: run_steps JSONB filter
- `db/procs/0119_sp_report_issues_deduplicated.sql` — reporting proc: run_steps status='failed'
- `db/procs/0120_sp_report_friction_signals.sql` — reporting proc: friction_signals DISTINCT ON
- `db/procs/0121_sp_report_execution_detail.sql` — reporting proc: UNION ALL steps + artifacts
- `db/procs/0122_sp_report_run_summary.sql` — reporting proc: run + run_executions join
- `db/procs/0123_sp_artifacts_list_expired.sql` — retention proc: two-branch OR expiry predicate
- `db/procs/0125_sp_artifacts_retention_audit.sql` — retention proc: GROUP BY artifact_type
- `db/procs/0116_sp_llm_analysis_list_failed_executions.sql` — LLM proc: NOT EXISTS subquery
- `db/procs/0021_sp_audit_logs_query.sql` — audit proc: date-range + actor filter
- `docs/decisions/006-security-review.md` — Phase 10.2 security findings referenced in overlap analysis
- `docs/decisions/007-vault-operations-policy.md` — audit log retention policy (Policy 5.3)
- `packages/config/src/env.schema.ts` — `RUNNER_CONCURRENCY` default value
