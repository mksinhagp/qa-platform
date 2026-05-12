# ADR 009: Runner Concurrency Tuning and Resource Profiling

## Status

Active — Phase 12.2 baseline profiling

## Context

The runner service (`apps/runner/`) is a Node.js/TypeScript Express server that executes Playwright-based browser flows across a matrix of personas and browsers. Each matrix run dispatches many child executions, and `RUNNER_CONCURRENCY` caps how many execute simultaneously. As of Phase 12.2, no Docker resource limits have been set on the runner container, and no formal guidance exists for how to size the concurrency cap or container memory ceiling for different host tiers.

This ADR documents the concurrency model derived from code review, establishes a theoretical resource consumption model per execution slot, provides concrete sizing recommendations for four representative host tiers, and defines the configuration reference operators should use when deploying the runner. It is the complement to `docs/decisions/008-performance-indexing.md` (database-side tuning) and is the primary reference for runner-specific operational decisions.

All resource figures in this document are theoretical estimates based on code analysis and Playwright/Node.js resource model fundamentals. Live profiling on the target host machine must validate these estimates before hard limits are set in production.

---

## Decision

Set `RUNNER_CONCURRENCY` based on the host tier recommendations in this document. Add Docker resource constraints to the runner service using `deploy.resources.limits`. Monitor runner health via `GET /health` and `GET /status`. Treat this document as the authoritative tuning baseline until measured profiling supersedes it.

---

## Concurrency Model

### How RUNNER_CONCURRENCY works

`RUNNER_CONCURRENCY` is read once at process startup via `parseConcurrencyCap()`:

```typescript
// execution-manager.ts, line 43-50
const DEFAULT_CONCURRENCY_CAP = 4;

export function parseConcurrencyCap(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_CONCURRENCY_CAP), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONCURRENCY_CAP;
}

const CONCURRENCY_CAP = parseConcurrencyCap(process.env.RUNNER_CONCURRENCY);
```

If the value is missing, non-numeric, or zero/negative, it falls back to `4`. The cap is a process-level constant — changing the environment variable requires a container restart to take effect.

### Semaphore slot mechanism

The `ExecutionManager` class implements a manual semaphore using an integer counter (`running`) and a waiter queue (`_slotWaiters`). The key methods:

```typescript
// execution-manager.ts, lines 960-978
private waitForSlot(): Promise<void> {
  if (this.running < CONCURRENCY_CAP) {
    this.running++;
    return Promise.resolve();
  }
  return new Promise(resolve => this._slotWaiters.push(() => {
    this.running++;
    resolve();
  }));
}

private releaseSlot(): void {
  this.running--;
  const next = this._slotWaiters.shift();
  if (next) next();
}
```

The `drain()` method iterates the execution queue, calling `await this.waitForSlot()` before dequeuing each item. Because `waitForSlot` atomically increments `running` before resolving, there is no window between the slot check and the execution start where another coroutine could over-subscribe. Slots are released in the `finally` block of `runExecution`, guaranteeing release even on error or abort.

### What one execution slot covers

One execution slot corresponds to the entire lifecycle of one child execution:

1. Browser process launch (`chromium.launch()`, `firefox.launch()`, or `webkit.launch()`) — one OS process per execution.
2. One `BrowserContext` and one `Page` created by `PersonaRunner.setup()`.
3. Sequential flow steps (navigation, interaction, accessibility checks) within that browser/page.
4. API test post-step (`runApiTestPostStep`) — HTTP calls from Node.js, no additional browser.
5. Callback delivery to the dashboard (`sendCallback`, `sendApiTestCallback`) — HTTP from Node.js.
6. Browser teardown (`runner.teardown()`, `browser.close()`) in the `finally` block.

The slot is held for the full duration of steps 1–6. The slot is released before the LLM post-step fires.

### LLM post-step detachment

The LLM summarization post-step is explicitly fire-and-forget:

```typescript
// execution-manager.ts, lines 1068-1077
void runLlmPostStep(ex, result, persona, siteName, this._correlationId).catch((llmErr) => {
  logger.warn(
    `Execution ${ex.execution_id}: LLM post-step error (non-fatal): ${String(llmErr)}`,
    undefined,
    this._correlationId,
  );
});
```

The `void` keyword discards the Promise. `releaseSlot()` is called in the `finally` block of `runExecution` before this line is reached (since the LLM call is outside the try/catch/finally that holds the slot). The LLM post-step:

- Does **not** consume a concurrency slot.
- Does **not** delay the main execution result callback to the dashboard.
- Fires only when `OLLAMA_BASE_URL` is set and the execution has failures or `friction_score > 0.1`.
- Can run concurrently alongside subsequent executions that have already claimed new slots.
- Errors are caught and logged at `warn` level; they never affect execution status.

### Singleton run constraint

The runner enforces a singleton active-run constraint via `reserveRun`:

```typescript
// execution-manager.ts, lines 1150-1156
export function reserveRun(req: RunRequest, correlationId: string): ExecutionManager {
  if (activeManager) {
    throw new Error('A run is already in progress');
  }
  activeManager = new ExecutionManager(correlationId, req.run_id);
  return activeManager;
}
```

A competing `POST /run` while a run is active receives `HTTP 409 Conflict`. The singleton is released in the `finally` block of `runReservedRun` after `startRun` (and therefore `drain`) completes. This means the runner is free for a new run as soon as all child executions finish — even if LLM post-steps are still running in the background.

---

## Resource Consumption Model

The following estimates are based on code analysis, Playwright documentation patterns, and Node.js runtime characteristics. They represent expected ranges under normal flow complexity. Unusually long flows, large pages, or accessibility checks with many DOM nodes will push toward the upper end.

### Node.js process baseline

- Express server with TypeScript runtime (compiled to ESM): approximately **50–100 MB** resident set size at idle.
- This baseline is shared across all concurrent executions — it is paid once per container, not per slot.

### Per-execution slot: browser process memory

Each browser is launched as a separate OS process:

| Browser   | Estimated RSS (headless, one context/page) |
|-----------|--------------------------------------------|
| Chromium  | 100–200 MB                                 |
| Firefox   | 120–200 MB                                 |
| WebKit    | 80–150 MB                                  |

Each additional `BrowserContext` adds approximately 10–30 MB. Each additional `Page` within a context adds approximately 10–50 MB depending on page complexity. The runner creates one context and one page per execution (`PersonaRunner.setup()`), so the per-slot browser footprint equals the browser baseline plus one context/page increment.

### Per-execution slot: API test post-step

`runApiTestPostStep` makes HTTP calls from the Node.js process using the Fetch API. There is no additional browser. Memory impact is negligible (HTTP response buffers, typically less than 1 MB per endpoint). CPU impact is bounded by the number of configured API endpoints and the `overall_timeout_ms` of 60 seconds.

### LLM post-step (fire-and-forget)

When `OLLAMA_BASE_URL` is set, the post-step makes one HTTP call to the Ollama server per qualifying execution. The Ollama server runs as a separate container (`qa-platform-ollama`). The runner's memory impact is the HTTP response buffer for the completion (~1–5 MB depending on model and output length). CPU impact within the runner container is negligible. The Ollama container itself may require 4–8 GB of RAM depending on the model (e.g., `llama3` requires ~4 GB for the 7B quantized model).

### Summary: peak memory per concurrency level

The formula for estimated runner container peak RSS is:

```
Peak RSS ≈ Node.js baseline + (RUNNER_CONCURRENCY × per-slot browser RSS)
```

Using Chromium at the midpoint (150 MB) as the representative browser:

| RUNNER_CONCURRENCY | Estimated Peak RSS |
|--------------------|--------------------|
| 2                  | ~350–500 MB        |
| 4                  | ~650–900 MB        |
| 6                  | ~950–1300 MB       |
| 8                  | ~1250–1700 MB      |

These figures assume Chromium. A mixed Chromium/Firefox/WebKit matrix will average out within the same ranges since WebKit is lighter and Firefox is comparable to Chromium.

---

## Sizing Recommendations by Host Tier

### Standard full matrix

The platform's standard full matrix is **6 personas × 3 browsers = 18 child executions** per run. Wall-clock time for a full run depends on `RUNNER_CONCURRENCY` (which determines batch depth) and per-execution duration (which depends on flow complexity and the target site's response times).

Estimated per-execution duration for a typical medium-complexity flow:
- Browser launch cold start: 2–4 seconds
- Flow navigation and interaction: 15–90 seconds
- API test post-step: 2–15 seconds
- Callback delivery: < 1 second

Total per-execution: **20–110 seconds**, central estimate ~60 seconds.

### Batch depth formula

With `RUNNER_CONCURRENCY = N`, the 18-execution matrix runs in `ceil(18 / N)` sequential batches (in practice, with continuous slot release, it is closer to a rolling pipeline, but batch count is a useful ceiling estimate):

| RUNNER_CONCURRENCY | Approx. batches for 18 executions | Estimated wall-clock (60 s/exec) |
|--------------------|-----------------------------------|----------------------------------|
| 2                  | 9 batches                         | ~540 s (~9 min)                  |
| 4                  | 5 batches                         | ~300 s (~5 min)                  |
| 6                  | 3 batches                         | ~180 s (~3 min)                  |
| 8                  | 3 batches                         | ~135 s (~2.25 min)               |

### Host tier recommendations

| Host Tier                              | Recommended RUNNER_CONCURRENCY | Expected Peak Container RSS | Wall-clock (18 exec, 60 s/exec) | Recommended Docker Memory Limit |
|----------------------------------------|--------------------------------|-----------------------------|---------------------------------|---------------------------------|
| Mac Mini M2 (8 GB RAM, 4 perf cores)  | 3                              | ~500–650 MB                 | ~360 s (~6 min)                 | 2 GB                            |
| Mac Mini M4 Pro (24 GB RAM, 12 cores) | 6                              | ~950–1300 MB                | ~180 s (~3 min)                 | 4 GB                            |
| Linux VPS (4 CPU, 8 GB RAM)           | 3                              | ~500–650 MB                 | ~360 s (~6 min)                 | 2 GB                            |
| Linux server (8 CPU, 32 GB RAM)       | 6–8                            | ~950–1700 MB                | ~135–180 s (~2.25–3 min)        | 6 GB                            |

**Rationale:**

- **Mac Mini M2 / Linux 4-CPU VPS**: The machine has limited cores and must share RAM with the OS, dashboard, and PostgreSQL containers. A cap of 3 keeps peak RSS well under 1 GB, leaving headroom for the dashboard (~200 MB) and Postgres (~100–300 MB). Setting a Docker memory limit of 2 GB provides a 3× safety margin over the expected peak and allows the OOM killer to act before the host swaps to disk.

- **Mac Mini M4 Pro**: The M4 Pro's unified memory architecture and 12 performance cores allow higher concurrency without memory pressure. A cap of 6 delivers roughly 3-minute full-matrix runs. The recommended 4 GB Docker limit provides a ~3× margin.

- **Linux 8-CPU / 32 GB server**: A production server can sustain 6–8 concurrent executions. Start at 6 and increase to 8 only after profiling confirms headroom. The 6 GB Docker limit accounts for peak RSS plus LLM post-step overhead if Ollama runs on the same host.

**Important**: The runner container competes with the Ollama container if both are on the same host. If Ollama is enabled, subtract at least 5 GB from available RAM before sizing the runner limit.

### Starting recommendation

Start at `RUNNER_CONCURRENCY=4` on all tiers. Profile actual container RSS during a full-matrix run using `docker stats qa-platform-runner`. Increase by 1 or 2 increments if peak RSS stays below 60% of the Docker memory limit. Do not exceed the CPU core count of the host.

---

## Docker Resource Constraint Configuration

As of Phase 12.2, the runner service in `docker-compose.yml` has no resource limits:

```yaml
runner:
  build:
    context: .
    dockerfile: ./docker/runner/Dockerfile
  container_name: qa-platform-runner
  environment:
    NODE_ENV: production
    PORT: 4000
  ports:
    - "4000:4000"
  networks:
    - qa-platform-network
```

Add a `deploy.resources.limits` block to constrain the container. The `deploy` key is honoured by Docker Compose when used with `docker compose up` (Compose V2) and by Docker Swarm. For plain `docker compose` (non-Swarm), limits are applied via the generated container configuration.

### Example: Mac Mini M4 Pro / Linux production server (6 GB limit)

```yaml
runner:
  build:
    context: .
    dockerfile: ./docker/runner/Dockerfile
  container_name: qa-platform-runner
  environment:
    NODE_ENV: production
    PORT: 4000
    RUNNER_CONCURRENCY: "6"
  ports:
    - "4000:4000"
  networks:
    - qa-platform-network
  deploy:
    resources:
      limits:
        memory: 6g
        cpus: "8.0"
      reservations:
        memory: 1g
        cpus: "2.0"
```

### Example: Mac Mini M2 / Linux 4-CPU VPS (2 GB limit)

```yaml
runner:
  build:
    context: .
    dockerfile: ./docker/runner/Dockerfile
  container_name: qa-platform-runner
  environment:
    NODE_ENV: production
    PORT: 4000
    RUNNER_CONCURRENCY: "3"
  ports:
    - "4000:4000"
  networks:
    - qa-platform-network
  deploy:
    resources:
      limits:
        memory: 2g
        cpus: "3.0"
      reservations:
        memory: 512m
        cpus: "1.0"
```

### Notes on deploy.resources

- `limits.memory`: Hard ceiling. If the container exceeds this, the Linux OOM killer terminates the process. Set it high enough to include the safety margin described in the tier table.
- `limits.cpus`: Soft ceiling on CPU shares. Playwright browsers are CPU-intensive during page rendering. This prevents a saturated runner from starving the dashboard and Postgres containers.
- `reservations.memory` / `reservations.cpus`: Used by Docker Swarm for scheduling; in non-Swarm Compose they are informational only but do not hurt to include.
- For the staging override (`docker/docker-compose.staging.yml`), add the `deploy` block to the `runner` service entry in that file rather than modifying `docker-compose.yml` directly, following the existing pattern of environment-specific overrides.

---

## Configuration Reference

### Environment variables affecting runner performance

| Variable                            | Default                                         | Effect                                                                                                                                                      |
|-------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `RUNNER_CONCURRENCY`                | `4`                                             | Maximum number of child executions that may run simultaneously. Parsed at startup; container restart required to change.                                     |
| `PORT`                              | `4000`                                          | HTTP port the Express server listens on. Change only if 4000 is in use on the host.                                                                         |
| `NODE_ENV`                          | (unset)                                         | When set to `production`: flow module cache TTL is 5 minutes. When unset or `development`: cache TTL is 30 seconds. Also affects Express error detail verbosity. |
| `OLLAMA_BASE_URL`                   | (unset)                                         | When set (e.g., `http://qa-platform-ollama:11434`), enables the LLM failure-summarization post-step. When unset, the post-step is silently skipped.           |
| `OLLAMA_MODEL`                      | (unset; defaults handled in `@qa-platform/llm`) | Ollama model name to use for failure summarization (e.g., `llama3`). Consult `packages/llm` for the current default.                                        |
| `BUSINESS_RULES_PATH`               | `./sites`                                       | Path (inside the container) where site flow modules and API endpoint configs are loaded from. Must be an absolute path in Docker.                             |
| `RUNNER_CALLBACK_ALLOWED_ORIGINS`   | `http://dashboard-web:3000,http://localhost:3000` | Comma-separated list of origins that the runner will POST callbacks to. Prevents SSRF via crafted callback URLs. Add the dashboard's public hostname here in production. |

### Playwright environment variables (operational reference)

| Variable    | Effect                                                                                                                      |
|-------------|-----------------------------------------------------------------------------------------------------------------------------|
| `PWDEBUG`   | Set to `1` to launch Playwright in headed mode with the Inspector. Not meaningful inside a headless Docker container.       |
| `PLAYWRIGHT_BROWSERS_PATH` | Override the path where Playwright looks for browser binaries. The runner Dockerfile pre-installs browsers; this variable should not need to be set unless the image is customised. |
| `DEBUG`     | Set to `pw:api` to enable verbose Playwright API logging (extremely verbose; use only for targeted debugging).              |

### Cache TTL operational constraint

The flow module cache (`flowCache`) and API endpoint cache (`apiEndpointCache`) share the same TTL:

```typescript
// execution-manager.ts, line 110
const CACHE_TTL_MS = process.env.NODE_ENV === 'production' ? 5 * 60_000 : 30_000;
```

In `production` mode, newly deployed or edited site flow files under `sites/<site_id>/flows/` will not be reflected in the runner until the cache entry expires (up to 5 minutes) or the container is restarted. This is intentional — it prevents hot-reloading cost during active runs — but means that updating a site's flows requires either:

1. Waiting up to 5 minutes for the cache to expire naturally, or
2. Restarting the runner container: `docker compose restart runner`.

Document this constraint in team procedures to prevent confusion during site flow development.

---

## Monitoring and Observability

### GET /health

The health endpoint is available at `http://localhost:4000/health` and is used by Docker Compose healthchecks and dashboard polling.

Response structure:
```json
{
  "status": "healthy",
  "service": "runner",
  "busy": true,
  "active_run_id": 42,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

- `busy: false` — the runner is idle and will accept a new `POST /run`.
- `busy: true` with `active_run_id` — a run is in progress. A new `POST /run` will receive `HTTP 409`.

**Monitoring use**: Poll `GET /health` every 10–30 seconds from an external monitor. Alert if `status` is not `"healthy"` or if `busy` remains `true` for longer than the expected maximum run duration for your matrix size.

### GET /status

The status endpoint provides per-execution state for the active run.

Response structure:
```json
{
  "busy": true,
  "active_run_id": 42,
  "executions": [
    { "execution_id": 101, "status": "running", "error": null },
    { "execution_id": 102, "status": "queued", "error": null },
    { "execution_id": 103, "status": "passed", "error": null }
  ]
}
```

Possible `status` values: `queued`, `running`, `passed`, `failed`, `aborted`, `friction_flagged`, `skipped_by_approval`.

**Recommended polling interval**: 15–30 seconds during an active run from the dashboard or an operator script. More frequent polling (e.g., every 5 seconds) is acceptable but unnecessary for most operational use cases.

### Log format and location

The runner uses the `Logger` class from `@qa-platform/shared-types` for all structured logging. In Docker, logs are written to stdout and captured by the Docker logging driver. The staging compose override (`docker/docker-compose.staging.yml`) configures the `json-file` driver with rotation:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Access runner logs:
```bash
docker logs qa-platform-runner --follow
docker logs qa-platform-runner --since 1h
```

Each log entry includes the service name (`runner` or `execution-manager`), a correlation ID (propagated from the originating HTTP request), and a structured metadata object where relevant.

### Detecting and aborting a stuck run

A run is considered stuck if no execution-result callbacks have been delivered for longer than the expected maximum per-execution duration (recommended threshold: **10 minutes** for typical flows; **20 minutes** for flows with approval gates, given the 15-minute approval timeout).

**Detection procedure:**
1. Poll `GET /health` — confirm `busy: true` and note the `active_run_id`.
2. Poll `GET /status` — look for executions stuck in `running` status for an extended period.
3. Check `docker logs qa-platform-runner --since 30m` for the last log entry from the suspect execution ID.

**Abort procedure:**
```bash
# Abort the stuck run (replace 42 with the actual run_id from /health)
curl -X POST http://localhost:4000/abort \
  -H "Content-Type: application/json" \
  -d '{"run_id": 42}'
```

The abort endpoint:
- Sets the internal abort flag on the active `ExecutionManager`.
- Marks all queued (not-yet-started) executions as `aborted`.
- Drains the slot waiter queue.
- Does **not** forcefully terminate in-progress browser processes — executions that are already running will complete their current step, hit a failure, or time out at the Playwright level. The browser process will be closed in the `finally` block of `runExecution`.

If a browser process is genuinely hung and the container must be freed immediately, restart the container:
```bash
docker compose restart runner
```

Note that restarting the container does not send abort callbacks to the dashboard. The dashboard will detect the missing callbacks after its own timeout and mark executions as failed. Consult `docs/runbooks/troubleshooting.md` for the full stuck-run runbook.

---

## Known Limitations

### 1. Singleton run constraint

The runner accepts only one active run at a time (`reserveRun` enforces this). Concurrent runs from multiple dashboard sessions receive `HTTP 409`. Horizontal scaling (multiple runner instances on different ports with a load balancer in front) is architecturally possible but is out of scope for v1. The dashboard's run submission flow must ensure it does not submit a second run while one is active.

### 2. No in-flight concurrency adjustment

`RUNNER_CONCURRENCY` is a process-level constant read at startup. There is no API to change it without a container restart. If a run is in progress when the container restarts, all active executions are lost (see abort procedure above).

### 3. Browser cold start time

Each execution launches a new browser process. Cold start overhead is approximately 2–4 seconds per browser. This overhead is amortized across the duration of the execution but cannot be eliminated. Persistent browser contexts (reusing a launched browser across executions) would reduce this cost but introduce state contamination risk between persona runs and add complexity to teardown — not recommended for v1.

### 4. Callback delivery failure handling

The callback retry policy is: up to 3 retries with exponential backoff (1s, 2s, 4s) for HTTP 5xx and network errors. HTTP 4xx errors are not retried. If the dashboard callback URL is unreachable after all retries, the runner logs an error and continues to the next execution. The dashboard will not receive the result for that execution; manual recovery is required (rerun the affected execution or mark it failed manually). This is a known gap — a dead-letter mechanism for failed callbacks is a potential future improvement.

### 5. Flow module cache and hot deploy

As noted in the Configuration Reference section, the 5-minute production cache TTL means flow changes are not immediately reflected without a container restart. This is an intentional trade-off but requires operator awareness during site flow development and deployment.

### 6. LLM post-step resource leakage

Because the LLM post-step fires as a detached Promise after slot release, it can be running when a new run begins. Under the maximum concurrency scenario (previous run's 18 LLM calls all still in flight when the next run starts), there could be up to 18 concurrent Ollama HTTP connections open from the runner container. This is unlikely in practice (LLM calls complete in 5–90 seconds each, and a new run typically starts minutes after the previous one completes), but it is a theoretical resource accumulation scenario. The Ollama container's own resource limits govern the actual impact.

---

## Consequences

### Positive

- Operators have a concrete, code-grounded baseline for sizing `RUNNER_CONCURRENCY` instead of relying on default values indefinitely.
- Docker resource limits prevent the runner from consuming unbounded RAM and starving the dashboard and Postgres containers under high concurrency.
- The monitoring guidance (health/status endpoints, log access, abort procedure) gives operators actionable tools for diagnosing and recovering from stuck runs without needing to read the source code.
- The LLM post-step detachment analysis confirms that enabling Ollama does not increase execution wall-clock time or consume concurrency slots — operators can enable it without changing `RUNNER_CONCURRENCY`.

### Negative / Trade-offs

- Resource figures are theoretical until live profiling is performed on each target host. Setting Docker memory limits too low (below the expected peak RSS) will cause OOM container termination mid-run, which is more disruptive than not having a limit.
- The singleton run constraint limits throughput to one active matrix per runner instance. High-demand scenarios require multiple runner containers, which is out of scope for v1.
- The 5-minute production cache TTL means flow hot-deploy requires a container restart or a cache wait — acceptable for v1 but an operational friction point for teams with frequent flow changes.

### Next steps

1. Run a full 18-execution matrix on the Mac Mini M4 Pro target host with `RUNNER_CONCURRENCY=4` and record peak container RSS using `docker stats`.
2. Compare measured RSS against the estimates in this document and adjust the tier recommendations if they diverge significantly.
3. Apply Docker memory limits in `docker/docker-compose.staging.yml` for the runner service once measured values are confirmed.
4. Update this document with measured figures and change status to "Confirmed — measured baseline."
5. Consult `docs/decisions/008-performance-indexing.md` for database-side tuning that complements runner-level concurrency settings, particularly for callback write throughput under high concurrency.
6. Consult `docs/runbooks/troubleshooting.md` for runner-specific issue diagnosis procedures including stuck runs, OOM recovery, and callback delivery failures.
