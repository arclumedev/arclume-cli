# Workflow Pipeline Builder CLI — Tasks

## Implementation Tasks

- [x] Create shared types for workflow data structures (`src/lib/types.ts`)
- [x] Create API client with auth token handling (`src/lib/api-client.ts`)
- [x] Implement `arclume workflow list` with `--published` and `--json` flags
- [x] Implement `arclume workflow describe <name>` with `--json` flag
- [x] Implement `arclume workflow run <name>` with `--param`, `--json`, `--trace` flags
- [x] Implement `arclume workflow export <name>` with `--format` and `--output` flags
- [x] Wire workflow subcommands into `src/cli.ts`
- [ ] Add integration tests against mock API
- [ ] Update OVERVIEW.md spec with new commands
