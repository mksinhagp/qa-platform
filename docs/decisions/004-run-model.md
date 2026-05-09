# ADR 004: Run Model

## Status

Accepted

## Context

The QA Automation Platform executes tests across multiple personas, devices, networks, and browsers. We need a data model that:

- Represents matrix runs (parent) and individual executions (children)
- Tracks execution status and results
- Supports approval-gated steps
- Captures friction telemetry
- Links to artifacts (traces, videos, screenshots)

## Decision

We use a **parent/child run model** with explicit matrix materialization.

### Data Model

**runs** (parent matrix run):
- Single row per test run
- Contains matrix configuration (site, environment, personas, devices, networks, browsers, flows)
- Tracks aggregate status (draft, running, completed, etc.)
- Tracks aggregate counts (total, successful, failed, skipped executions)

**run_executions** (children):
- One row per (persona × device × network × browser × flow) combination
- Tracks individual execution status
- Stores friction score and error messages
- Links to artifact base path

**run_steps** (per-execution steps):
- One row per step within an execution
- Tracks step status (pending, running, passed, failed, awaiting_approval)
- Links to approval record if step requires approval
- Stores step-specific data in JSONB

**approvals** (approval requests):
- One row per approval-gated step
- Tracks approval category, required strength, status
- Records decision (approved/rejected/timed_out) with reason and decider

**artifacts** (file index):
- One row per artifact file (trace, video, screenshot, HAR, logs)
- Links to run execution
- Stores file metadata (type, size, mime type, path, retention date)

### Lifecycle States

**runs.status**: draft, awaiting_approval, running, paused_for_approval, completed, aborted, failed

**run_executions.status**: queued, running, paused, passed, failed, aborted, skipped_by_approval, friction_flagged

**run_steps.status**: pending, running, passed, failed, skipped, awaiting_approval

**approvals.status**: pending, approved, rejected, timed_out

### Matrix Materialization

Operator selects:
- Site and environment
- Flows to test
- Persona set (e.g., 6 personas)
- Device set (e.g., 8 device profiles)
- Network set (e.g., 5 network profiles)
- Browser set (chromium, firefox, webkit)

System creates:
- 1 runs row (parent)
- N run_executions rows = personas × devices × networks × browsers × flows
- Each execution runs in parallel up to concurrency cap (default 4)

### Friction Telemetry

Runner captures confusion signals:
- Repeated clicks on non-interactive elements
- Hover-without-click on CTAs
- Scroll-up after submit
- Form fields edited > 2 times
- Focus exits required input without value
- Back-button presses inside flow
- Time-to-first-meaningful-action

Produces per-persona friction score (0-100) alongside hard pass/fail.

## Consequences

### Positive

- Clear parent/child relationship for reporting
- Matrix materialization enables parallel execution
- Approval model supports tiered approval strength
- Friction telemetry captures user experience signals
- Artifact indexing enables cleanup and retention policies

### Negative

- Large matrices create many execution rows (database growth)
- Complex state machine for run lifecycle
- Approval gating adds latency to runs
- Friction scoring requires calibration

### Alternatives Considered

- **Single run table**: Rejected - cannot represent matrix structure
- **Flat execution model**: Rejected - loses parent/child relationship
- **No friction telemetry**: Rejected - misses user experience signals
- **Approval in runner**: Rejected - dashboard should control approvals

## References

- Master Plan §9: Run Model
- Master Plan §3.5: Confusion / Friction Telemetry
- Master Plan §8: Approval Engine (Tiered)
