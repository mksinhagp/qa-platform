# ADR 005: Reporting Model

## Status

Accepted

## Context

The QA Automation Platform generates test results that need to be presented to both technical and non-technical stakeholders. We need a reporting model that:

- Provides narrative summaries for non-technical users
- Offers technical drill-down for debugging
- Aggregates results across matrix executions
- Highlights accessibility issues
- Generates shareable artifacts

## Decision

We use a **two-layer reporting model**: narrative layer for stakeholders, technical drill-down for developers.

### Narrative Layer (Top of Run Page)

**Per-Persona Summary Cards**:
- Persona name and display name
- Completion status (passed/failed/abandoned)
- Total time
- Friction score
- Top 3 issues

**Aggregate Accessibility Scorecard**:
- axe-core severity counts (critical, serious, moderate, minor)
- Keyboard navigation pass rate
- Contrast pass rate
- Reflow pass rate

**Severity-Ranked Issue List**:
- Deduplicated issues across all executions
- Grouped by issue type
- Shows affected personas/devices
- Links to technical drill-down

**Generated MP4 Walkthrough**:
- 5-30 second clip from Playwright trace per persona
- Shareable for non-technical stakeholders
- Shows key interactions and failures

### Technical Drill-Down (Per Execution)

**Playwright Trace Viewer Link**:
- Full trace file for debugging
- Timeline view of all actions
- Network requests, console logs, screenshots

**Screenshots and Video**:
- Screenshot at failure points
- Full execution video
- Before/after screenshots for assertions

**HAR (HTTP Archive)**:
- Network request/response data
- Headers, timings, payloads
- Useful for API debugging

**Console and Network Logs**:
- Browser console errors and warnings
- Network failures and timing data
- Structured logs with correlation IDs

**Step-by-Step Timeline**:
- All run_steps with status and timing
- Friction signals overlaid
- Approval decision points marked

**LLM Failure Explanation** (when Ollama enabled):
- Advisory-only summary of failure
- Clearly labeled as non-authoritative
- Helps identify common patterns

### Storage Strategy

- **Structured data**: Stored in PostgreSQL (runs, run_executions, run_steps, approvals)
- **Binary artifacts**: Stored on disk under `artifacts/<run_id>/<execution_id>/`
- **Artifact indexing**: artifacts table tracks file metadata and retention dates
- **Reports**: Rendered server-side from indexed data (not precomputed)
- **MP4 walkthroughs**: Generated at run time, stored as artifacts

### Retention Policy

| Artifact | Default Retention |
|----------|------------------|
| Playwright trace zip | 30 days |
| Video | 30 days |
| Screenshots | 90 days |
| HAR | 30 days |
| Console + network logs | 90 days |
| Narrative MP4 walkthroughs | 180 days |
| Run/execution/step records | 1 year |
| Audit logs | indefinite |

Per-site override in `system_settings`. Daily cleanup job enforces retention.

## Consequences

### Positive

- Non-technical stakeholders can understand results without technical knowledge
- Developers have full debugging capability via technical drill-down
- Artifact retention policy prevents unbounded disk growth
- Reports generated on-demand from source of truth (no stale precomputation)
- MP4 walkthroughs enable sharing with external stakeholders

### Negative

- MP4 generation adds runtime overhead
- Large artifact storage requires cleanup job
- Report rendering may be slow for large matrices
- Need to balance detail vs. performance

### Alternatives Considered

- **Precomputed reports**: Rejected - stale data, complex invalidation
- **Single-layer reporting**: Rejected - doesn't serve both audiences
- **External reporting service**: Rejected - adds dependency, violates local-first
- **No narrative layer**: Rejected - non-technical users cannot interpret results

## References

- Master Plan §10: Reporting
- Master Plan §14: Artifact Retention
