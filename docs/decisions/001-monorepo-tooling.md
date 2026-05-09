# ADR 001: Monorepo Tooling

## Status

Accepted

## Context

The QA Automation Platform requires multiple services (dashboard-web, runner) and shared packages (db, shared-types, auth, vault, etc.). We need a monorepo structure that enables:

- Shared code reuse across services
- Consistent tooling and dependencies
- Efficient build processes with Turborepo
- TypeScript type safety across package boundaries

## Decision

We use **pnpm workspaces + Turborepo** for monorepo management.

### Tooling Choices

- **pnpm**: Fast, disk-efficient package manager with workspace support
- **Turborepo**: Build system for monorepos with intelligent caching and task orchestration
- **TypeScript**: Shared tsconfig.json with workspace references
- **ESLint**: Shared lint configuration

### Workspace Structure

```
qa-platform/
  apps/
    dashboard-web/
    runner/
  packages/
    db/
    shared-types/
    config/
    auth/
    vault/
    approvals/
    email/
    llm/
    reporting/
    personas/
    playwright-core/
    accessibility/
    rules/
    ui/
  pnpm-workspace.yaml
  turbo.json
  package.json
```

### Key Configuration

**pnpm-workspace.yaml**:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**turbo.json**:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false
    }
  }
}
```

### Internal Dependencies

Packages reference each other using workspace protocol:
```json
{
  "dependencies": {
    "@qa-platform/shared-types": "workspace:*"
  }
}
```

## Consequences

### Positive

- Single repository for all code reduces context switching
- Shared types and utilities enforced at compile time
- Turborepo caching speeds up builds
- pnpm's efficient disk usage for node_modules

### Negative

- Learning curve for pnpm and Turborepo
- Build complexity increases with more packages
- Need to manage dependency hoisting carefully

### Alternatives Considered

- **npm workspaces**: Slower than pnpm, less efficient disk usage
- **yarn workspaces**: Similar to pnpm, but pnpm chosen for performance
- **Nx**: More feature-rich but heavier than Turborepo; Turborepo sufficient for our needs
- **Separate repos**: Would require manual coordination and duplicate dependencies

## References

- Master Plan §4.2: Monorepo Layout
- Master Plan §4.2: Stack Lock-in
