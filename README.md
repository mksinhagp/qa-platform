# QA Automation Platform (Master-Tester Edition)

A dockerized, local-first QA control plane that lets one operator act as the master tester on behalf of a diverse user population, exercising a single booking-style website end-to-end across personas, devices, networks, and accessibility profiles.

## Phase 0 Status

Bootable monorepo with all services running, schema migrated, baseline routes scaffolded, runner reachable, but no real auth/vault logic yet.

## Prerequisites

- Docker and Docker Compose
- pnpm (recommended) or npm
- Node.js 20+

## Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Start all services (postgres, migrator, dashboard-web, runner)
docker compose up

# Start with optional services
docker compose --profile llm --profile dev up
```

Services will be available at:
- Dashboard: http://localhost:3000
- Runner: http://localhost:4000
- PostgreSQL: localhost:5434
- Mailcatcher (dev profile): http://localhost:1080
- Ollama (llm profile): http://localhost:11434

### Production Build

```bash
# Build Docker images
docker compose build

# Start production stack
docker compose up
```

## Common Commands

### Dependency Management

```bash
# Install all dependencies
pnpm install

# Add a dependency
pnpm add <package> -w              # workspace root
pnpm add <package> -w --filter=db  # specific package

# Remove a dependency
pnpm remove <package> -w
```

### Database

```bash
# Run migrations (via migrator container)
docker compose up migrator

# Run migrations manually (local development)
cd packages/db
pnpm migrate

# Connect to PostgreSQL
psql -h localhost -p 5434 -U qa_user -d qa_platform
```

### Services

```bash
# Start dashboard-web in dev mode
cd apps/dashboard-web
pnpm dev

# Start runner in dev mode
cd apps/runner
pnpm dev

# Build dashboard-web
cd apps/dashboard-web
pnpm build

# Build runner
cd apps/runner
pnpm build
```

### Docker

```bash
# Start all services
docker compose up

# Start specific service
docker compose up postgres

# Start with profiles
docker compose --profile llm up
docker compose --profile dev up
docker compose --profile llm --profile dev up

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f dashboard-web
docker compose logs -f runner

# Rebuild service
docker compose up --build dashboard-web
```

## Architecture

### Services

- **dashboard-web**: Next.js dashboard (UI + orchestrator services)
- **runner**: Playwright runner service (HTTP-controlled)
- **postgres**: PostgreSQL 16 database
- **migrator**: One-shot migration runner
- **ollama**: Optional LLM service (profile: llm)
- **mailcatcher**: Optional SMTP capture (profile: dev)

### Packages

- **db**: PostgreSQL client, transaction helper, proc-invocation wrapper, migration runner
- **shared-types**: DTOs, enums, run states, persona schema, logging utilities
- **config**: Env parsing, feature flags
- **auth**: Custom auth + capability RBAC (Phase 1)
- **vault**: Argon2id + AES-256-GCM envelope vault (Phase 1)
- **approvals**: Tiered approval engine (Phase 1)
- **email**: IMAP + provider API abstraction (Phase 1)
- **llm**: Ollama client and bounded prompts (Phase 1)
- **reporting**: Narrative + technical report assembly (Phase 1)
- **personas**: Persona schema + v1 library + oracles (Phase 1)
- **playwright-core**: Shared step library, persona-aware helpers (Phase 1)
- **accessibility**: axe-core wrapper, keyboard nav, contrast, reflow (Phase 1)
- **rules**: Site business-rule loader (Phase 1)
- **ui**: Shared dashboard components (Phase 1)

## Database Access Pattern

All data access must go through stored procedures. No ad-hoc SQL in application code.

Stored procedures are located in `db/procs/` with naming convention `XXXX_sp_entity_action.sql`.

Example:
```typescript
import { invokeProc } from '@qa-platform/db';

const sites = await invokeProc('sp_sites_list', { i_is_active: true });
```

## Troubleshooting

### Port Conflicts

If port 5432 is already in use, PostgreSQL is mapped to 5434 in docker-compose.override.yml.

If you need to change ports, edit the override file.

### Migration Failures

If migrations fail:
```bash
# Check migrator logs
docker compose logs migrator

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up postgres
# Wait for postgres to be healthy, then run migrator
```

### TypeScript Errors

TypeScript errors about missing dependencies are expected before running `pnpm install`. Run:
```bash
pnpm install
```

### Docker Build Failures

If Docker builds fail:
```bash
# Clear Docker cache
docker system prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Service Not Starting

Check service health:
```bash
docker compose ps
docker compose logs <service-name>
```

### Hot Reload Not Working

Ensure docker-compose.override.yml is active (it's loaded automatically by Docker Compose).

## Phase 0 Exit Criteria

- `docker compose up` brings up all default services healthy
- Migrator applies all migrations and procs idempotently
- Dashboard loads at http://localhost:3000, all placeholder routes resolve
- Runner /health returns 200; runner /run accepts a config and echoes a stub response
- Personas, device profiles, and network profiles are visible read-only at /dashboard/personas
- ADRs are committed
- README explains start, stop, reset, and migration commands

## Next Steps

See [master-plan-qa-automation.md](./master-plan-qa-automation.md) for detailed implementation plan.

Phase 1 will add: working operator login, capability RBAC, master-password vault bootstrap, vault unlock/lock, encrypted saved secrets, and CRUD UIs for credentials, payment profiles, and email inboxes.
