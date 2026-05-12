BEGIN
-- ============================================================
-- Migration 0020: Performance indexes
-- Phase 12.1: Database Query Analysis and Indexing Review
--
-- Purpose: Add composite, covering, and partial indexes to close
--   query-performance gaps identified by analysing stored procedure
--   query patterns in Phase 9 (reporting), Phase 11.1 (artifact
--   retention), and core run-management / LLM / audit procs.
--
-- All indexes use CREATE INDEX IF NOT EXISTS to be idempotent.
-- No existing indexes are modified or dropped.
--
-- Analysis basis: stored procedure query patterns; no EXPLAIN ANALYZE
--   data is available (no live DB attached during this review).
--   Rationale for each index is grounded in query-planner fundamentals
--   and the specific WHERE / JOIN / ORDER BY clauses in each proc.
--
-- Grouping:
--   Section 1 — Composite indexes for reporting procs (0117–0122)
--   Section 2 — Composite indexes for run management / dashboard polling
--   Section 3 — Partial indexes (low-cardinality hot-path columns)
--   Section 4 — Composite index for artifact retention procs (0123, 0125)
--   Section 5 — Composite index for audit log queries (0021)
-- ============================================================


-- ============================================================
-- Section 1: Composite indexes for reporting procs
-- ============================================================

-- IDX-01: run_executions (run_id, status)
-- Used by:
--   sp_report_run_summary (0122)    — LEFT JOIN run_executions ON r.id = re.run_id; aggregates
--                                     status IN ('passed','completed','failed','skipped_by_approval','aborted')
--   sp_report_persona_summary (0117) — WHERE re.run_id = i_run_id; GROUP BY persona_id with status CASE
--   sp_report_accessibility_summary (0118) — WHERE re.run_id = i_run_id
--   sp_report_issues_deduplicated (0119)  — WHERE re.run_id = i_run_id
--   sp_report_friction_signals (0120)     — WHERE re.run_id = i_run_id
--   sp_llm_analysis_list_failed_executions (0116) — WHERE re.Run_Id = i_run_id
-- With RUNNER_CONCURRENCY=4 default, up to 4 executions write concurrently;
-- dashboard polling hits this filter on every render cycle.
-- A composite on (run_id, status) lets the planner satisfy the equality filter
-- on run_id and then filter status within the already-narrow result set in a
-- single index scan, eliminating a separate bitmap-and merge of two single-column
-- indexes.
create index if not exists idx_run_executions_run_id_status
    on run_executions (run_id, status);


-- IDX-02: run_steps (run_execution_id, status)
-- Used by:
--   sp_report_issues_deduplicated (0119) — JOIN run_steps WHERE rs.status = 'failed'
--   sp_report_accessibility_summary (0118) — JOIN run_steps; filters on details JSONB presence
--   sp_llm_analysis_list_failed_executions (0116) — INNER JOIN run_steps WHERE rs.Status IN ('failed','error')
--   sp_run_steps_list_by_execution (implicit) — WHERE run_execution_id = $1 ordered by step_order
-- The existing idx_run_steps_run_execution_id and idx_run_steps_status are separate.
-- The composite covers the two-column predicate (run_execution_id = $1 AND status IN (...))
-- in a single scan and dramatically reduces rows returned to the join before
-- any JSONB predicate is evaluated.
create index if not exists idx_run_steps_execution_id_status
    on run_steps (run_execution_id, status);


-- IDX-03: friction_signals (run_execution_id, signal_type)
-- Used by:
--   sp_report_friction_signals (0120) — JOIN friction_signals ON re.id; WHERE re.run_id = i_run_id;
--                                        DISTINCT ON (run_execution_id, signal_type); GROUP BY (execution_id, signal_type)
-- The DISTINCT ON and GROUP BY in the CTE both operate over the composite key
-- (run_execution_id, signal_type). A composite index on these two columns lets
-- PostgreSQL satisfy the grouping with an index scan rather than a hash/sort
-- aggregate over a larger row set.
create index if not exists idx_friction_signals_execution_id_signal_type
    on friction_signals (run_execution_id, signal_type);


-- IDX-04: run_steps (run_execution_id, step_order)
-- Used by:
--   sp_report_execution_detail (0121) — LEFT JOIN run_steps ON re.id = rs.run_execution_id;
--                                        ORDER BY step_order NULLS LAST
-- The ORDER BY step_order is currently not covered by any composite index that
-- also carries run_execution_id. This composite allows the planner to return
-- steps pre-sorted from the index, avoiding a separate sort node on what can be
-- a large run_steps scan per execution.
create index if not exists idx_run_steps_execution_id_step_order
    on run_steps (run_execution_id, step_order);


-- IDX-05: artifacts (run_execution_id, artifact_type)
-- Used by:
--   sp_report_execution_detail (0121) — INNER JOIN artifacts ON re.id = a.run_execution_id
-- When the UNION ALL branch for artifact rows executes, the planner must look up
-- all artifacts for a given execution. A composite on (run_execution_id, artifact_type)
-- both satisfies the join predicate and pre-sorts results in a way compatible with
-- the ORDER BY artifact_type display that most UIs impose.
create index if not exists idx_artifacts_execution_id_type
    on artifacts (run_execution_id, artifact_type);


-- ============================================================
-- Section 2: Composite indexes for run management and dashboard polling
-- ============================================================

-- IDX-06: runs (site_id, status, started_at)
-- Used by:
--   sp_runs_list (run list / dashboard) — typically filters WHERE site_id = $1
--                                          AND status IN (...) ORDER BY started_at DESC
-- The existing indexes idx_runs_site_id, idx_runs_status, and idx_runs_started_at
-- are separate. A composite on (site_id, status, started_at) converts a three-way
-- bitmap-and merge into a single range scan and eliminates a sort node on started_at
-- for the common site-scoped, status-filtered, date-ordered list query.
create index if not exists idx_runs_site_id_status_started_at
    on runs (site_id, status, started_at desc);


-- IDX-07: runs (is_pinned, started_at)
-- Used by:
--   sp_runs_list — the "pinned runs" section of the dashboard filters
--                   WHERE is_pinned = TRUE ORDER BY started_at DESC
-- The existing idx_runs_is_pinned is a single-column boolean index. A composite
-- on (is_pinned, started_at DESC) avoids a separate sort after the boolean filter
-- for the pinned-first display pattern.
create index if not exists idx_runs_is_pinned_started_at
    on runs (is_pinned, started_at desc);


-- ============================================================
-- Section 3: Partial indexes
-- ============================================================

-- IDX-08: approvals — partial index on (status, timeout_at) WHERE status = 'pending'
-- Used by:
--   Approval poller (runner/dashboard) — polls WHERE status = 'pending'
--                                         ORDER BY timeout_at ASC to find approvals
--                                         approaching their deadline.
-- The existing idx_approvals_status is a full-column index over all rows.
-- Pending approvals are a small, time-bounded fraction of the total approvals table.
-- A partial index covering only pending rows keeps the index tiny, reducing write
-- amplification during high-concurrency runs (RUNNER_CONCURRENCY=4 creates approval
-- rows frequently). The included timeout_at column allows timeout-ordered scans
-- without an additional sort.
create index if not exists idx_approvals_pending_timeout
    on approvals (timeout_at asc)
    where status = 'pending';


-- IDX-09: llm_analysis_results — partial index on (Run_Execution_Id) WHERE Status IN ('pending', 'error')
-- Used by:
--   sp_llm_analysis_list_failed_executions (0116) — NOT EXISTS subquery checks
--     llm_analysis_results WHERE Run_Execution_Id = re.Id AND Task_Type = 'failure_summarization'
-- The NOT EXISTS subquery is evaluated for every candidate execution row. The unique
-- index uq_llm_analysis_results_exec_task already covers this but spans all statuses.
-- A partial index restricted to actionable statuses ('pending','error') keeps the
-- index footprint minimal; completed/skipped rows (the majority once a run finishes)
-- are excluded and do not inflate index pages accessed during the NOT EXISTS probe.
create index if not exists idx_llm_analysis_results_pending_error
    on llm_analysis_results (run_execution_id)
    where status in ('pending', 'error');


-- IDX-10: api_test_suites — partial index on (run_execution_id) WHERE status = 'failed'
-- Used by:
--   Dashboard API test summary — queries for failed suites across a run;
--     WHERE status = 'failed' is the dominant display filter in the UI.
-- A partial index over failed suites only keeps the index small (failed suites are
-- typically a minority) and gives the planner a fast path when the dashboard
-- renders the "failures" panel without reading passed/skipped suite rows.
create index if not exists idx_api_test_suites_failed
    on api_test_suites (run_execution_id)
    where status = 'failed';


-- IDX-11: email_validation_runs — partial index on (run_execution_id) WHERE status = 'pending'
-- Used by:
--   Email validation poller — polls WHERE status = 'pending' to find outstanding
--     email checks that still need IMAP polling.
-- Completed/failed validation runs are the majority; restricting to pending keeps
-- this index very small and avoids write amplification once a check resolves.
create index if not exists idx_email_validation_runs_pending
    on email_validation_runs (run_execution_id)
    where status = 'pending';


-- ============================================================
-- Section 4: Artifact retention composite indexes
-- ============================================================

-- IDX-12: artifacts (retention_date, artifact_type, created_date) — partial WHERE retention_date IS NOT NULL
-- Used by:
--   sp_artifacts_list_expired (0123) — WHERE (retention_date IS NOT NULL AND retention_date < NOW())
--                                       ORDER BY created_date ASC LIMIT i_limit
-- The existing idx_artifacts_retention_date indexes all rows including those with a
-- NULL retention_date. Case (a) of the expiry predicate (explicit date) benefits from
-- a partial index that excludes NULL rows (those without an explicit date are handled
-- by the config-driven path). Including artifact_type and created_date as additional
-- columns provides a covering index for the ORDER BY + LIMIT pattern: the planner can
-- walk the index in created_date order and stop at the limit without a sort node.
create index if not exists idx_artifacts_retention_date_notnull
    on artifacts (retention_date asc, created_date asc)
    where retention_date is not null;


-- IDX-13: artifacts (artifact_type, created_date) — partial WHERE retention_date IS NULL
-- Used by:
--   sp_artifacts_list_expired (0123) — Case (b): WHERE retention_date IS NULL AND
--     (created_date + retention_days interval) < NOW()
--   sp_artifacts_retention_audit (0125) — GROUP BY artifact_type; aggregates created_date
-- The config-driven expiry path evaluates (created_date + interval) < NOW() per row
-- after the JOIN to artifact_retention_config. A partial index on (artifact_type,
-- created_date) restricted to rows without an explicit retention_date lets the planner
-- probe only the relevant set of rows and supports the aggregation in the audit proc.
create index if not exists idx_artifacts_type_created_no_retention_date
    on artifacts (artifact_type, created_date asc)
    where retention_date is null;


-- ============================================================
-- Section 5: Audit log composite index
-- ============================================================

-- IDX-14: audit_logs (created_date, actor_id) — covering common admin time-range queries
-- Used by:
--   sp_audit_logs_query (0021) — WHERE (i_start_date IS NULL OR created_date >= i_start_date)
--                                  AND (i_end_date IS NULL OR created_date <= i_end_date)
--                                  AND (i_actor_id IS NULL OR actor_id = i_actor_id)
--                                  ORDER BY created_date DESC LIMIT i_limit
-- The most common admin query pattern is a date-range filter (all entries in a time
-- window) optionally narrowed by actor. The existing idx_audit_logs_created_date and
-- idx_audit_logs_actor_id are separate. A composite on (created_date, actor_id) with
-- date first satisfies the range scan on the leading column, then filters actor within
-- the range without a separate heap lookup or bitmap merge. ORDER BY created_date DESC
-- is served by the same index scan in reverse.
-- Note: audit_logs has no updated_date (append-only design from migration 0002).
-- The table is INSERT-only; index write amplification is therefore a write-once cost.
create index if not exists idx_audit_logs_created_date_actor_id
    on audit_logs (created_date desc, actor_id);

END;
