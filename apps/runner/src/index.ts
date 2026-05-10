import express, { Request, Response, NextFunction } from 'express';
import { Logger, generateCorrelationId } from '@qa-platform/shared-types';
import { reserveRun, runReservedRun, getActiveManager, type RunRequest } from './execution-manager.js';

const app = express();
const PORT = process.env.PORT || 4000;
const logger = new Logger('runner');

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

app.use(express.json({ limit: '2mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — used by Docker Compose healthcheck and dashboard polling
app.get('/health', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  const manager = getActiveManager();

  logger.info('Health check requested', undefined, correlationId);
  res.status(200).json({
    status: 'healthy',
    service: 'runner',
    busy: manager !== null,
    active_run_id: manager?.getRunId() ?? null,
    timestamp: new Date().toISOString(),
  });
});

// Start a matrix run — accepts RunRequest JSON
// The dashboard is responsible for pre-materializing executions and providing
// a callback URL+token for each child execution.
app.post('/run', async (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'] as string;

  const body = req.body as {
    run_id?: number;
    executions?: unknown[];
  };

  if (!body.run_id || !Array.isArray(body.executions) || body.executions.length === 0) {
    res.status(400).json({ error: 'run_id and executions[] are required' });
    return;
  }

  // Validate each execution object has required fields
  const executions = body.executions as Array<Record<string, unknown>>;
  for (const ex of executions) {
    if (
      typeof ex.execution_id !== 'number' ||
      typeof ex.site_id !== 'string' ||
      typeof ex.base_url !== 'string' ||
      typeof ex.callback_url !== 'string' ||
      typeof ex.callback_token !== 'string' ||
      typeof ex.flow_name !== 'string' ||
      typeof ex.persona_id !== 'string' ||
      typeof ex.browser !== 'string'
    ) {
      res.status(400).json({
        error: 'Each execution must include execution_id, site_id, base_url, callback_url, callback_token, flow_name, persona_id, and browser',
      });
      return;
    }
  }

  const runRequest: RunRequest = {
    run_id: body.run_id,
    executions: executions as unknown as RunRequest['executions'],
  };

  let manager;
  try {
    // Reserve the singleton synchronously before acknowledging the request so
    // a competing /run call receives 409 instead of a false 202 Accepted.
    manager = reserveRun(runRequest, correlationId);
  } catch {
    const activeManager = getActiveManager();
    res.status(409).json({
      error: 'A run is already in progress',
      active_run_id: activeManager?.getRunId() ?? null,
    });
    return;
  }

  logger.info(`Run ${body.run_id} accepted with ${body.executions.length} executions`, undefined, correlationId);

  // Acknowledge immediately; run is async
  res.status(202).json({
    message: 'Run accepted',
    run_id: body.run_id,
    execution_count: body.executions.length,
    timestamp: new Date().toISOString(),
  });

  // Run asynchronously — callbacks report results back to dashboard
  setImmediate(async () => {
    try {
      await runReservedRun(manager, runRequest);
      logger.info(`Run ${body.run_id} completed`, undefined, correlationId);
    } catch (err) {
      logger.error(
        `Run ${body.run_id} failed`,
        err instanceof Error ? err : new Error(String(err)),
        undefined,
        correlationId,
      );
    }
  });
});

// Abort the current run (best-effort — marks executions aborted, closes browsers)
app.post('/abort', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  const manager = getActiveManager();

  if (!manager) {
    res.status(404).json({ error: 'No active run to abort' });
    return;
  }

  logger.info(`Abort requested for run ${manager.getRunId()}`, undefined, correlationId);
  manager.abort();
  res.status(200).json({ message: 'Abort signal sent', run_id: manager.getRunId() });
});

// Status of the current run
app.get('/status', (_req: Request, res: Response) => {
  const manager = getActiveManager();

  if (!manager) {
    res.status(200).json({ busy: false, active_run_id: null });
    return;
  }

  const states = Array.from(manager.getState().entries()).map(([id, s]) => ({
    execution_id: id,
    status: s.status,
    error: s.error,
  }));

  res.status(200).json({
    busy: true,
    active_run_id: manager.getRunId(),
    executions: states,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Runner service listening on port ${PORT}`);
});
