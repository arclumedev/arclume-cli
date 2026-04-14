# Workflow Pipeline Builder CLI — Design

## Architecture

The workflow CLI commands follow the same pattern as existing commands (`index`, `context`, `doctor`):

1. **Command definitions** in `src/commands/workflow.ts` — parses args, calls API client, formats output
2. **API client** in `src/lib/api-client.ts` — authenticated HTTP calls to the Arclume API
3. **Type definitions** in `src/lib/types.ts` — shared interfaces for workflow data structures

## API Contract

All workflow commands call the Arclume REST API at `https://api.arclume.dev/v1/`:

| Endpoint | Method | CLI Command |
|----------|--------|-------------|
| `/workflows` | GET | `workflow list` |
| `/workflows/:nameOrId` | GET | `workflow describe` |
| `/workflows/:nameOrId/execute` | POST | `workflow run` |
| `/workflows/:nameOrId/export` | GET | `workflow export` |

Authentication uses the existing token from `arclume login` (OS keychain or `ARCLUME_TOKEN` env var).

## Streaming Execution

`workflow run` uses Server-Sent Events (SSE) for streaming execution progress:

- Each node completion emits an event with node name, status, duration, and output
- The CLI renders per-node progress indicators to stderr (so stdout stays clean for `--json`)
- On completion, the final result is written to stdout

## Output Modes

All commands support `--json` for machine-parseable output. Default is human-readable formatted output with chalk styling.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Workflow execution error (node failure, timeout) |
| 2 | Invalid input (bad params, unknown workflow) |

## Key Decisions

- **Streaming to stderr, result to stdout**: Enables `arclume workflow run review | jq .score` without progress noise
- **Name-based addressing**: Workflows are addressed by name (not ID) in CLI for ergonomics; API resolves name-to-ID
- **Param parsing**: `--param key=value` is parsed into a JSON object; `--param-file input.json` reads from file
