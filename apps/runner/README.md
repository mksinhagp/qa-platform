# Runner Service

Playwright runner service for the QA Automation Platform.

## Development

```bash
pnpm install
pnpm dev
```

The service will start on port 4000 (configurable via PORT env var).

## Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "runner",
  "timestamp": "2026-05-08T00:00:00.000Z"
}
```

### POST /run

Stub endpoint for run execution. Currently echoes back the config.

**Request:**
```json
{
  "siteId": 1,
  "environmentId": 1,
  "personas": ["confident_desktop"],
  "devices": ["desktop_1920x1080"]
}
```

**Response:**
```json
{
  "message": "Run received (stub)",
  "config": { /* request body */ },
  "timestamp": "2026-05-08T00:00:00.000Z"
}
```

## Phase 0 Status

- ✅ Express server skeleton
- ✅ /health endpoint
- ✅ Stub /run endpoint
- ✅ Playwright dependency wired
- ⏳ Real Playwright flows (Phase 3)
