# Harness Scaffolding — Design

## File Layout

```
<repo-root>/
├── arclume.yaml                    # NEW — harness manifest
├── .arclumeignore                  # existing
├── .arclume/
│   ├── config.json                 # existing (indexer)
│   ├── context.md                  # existing
│   ├── lume/
│   │   ├── schema.yaml
│   │   └── entities/README.md
│   ├── meta/
│   │   ├── principles.md
│   │   ├── CHANGELOG.md
│   │   └── feedback/.gitkeep
│   ├── tickets/
│   │   ├── config.yaml
│   │   └── templates/{bug,feature}.md
│   ├── openapi/
│   │   ├── index.yaml
│   │   └── paths/.gitkeep
│   └── workflows/example.yaml
└── openspec/specs/OVERVIEW.md      # existing (unchanged)
```

## Module Boundaries

| Module | Responsibility |
|--------|----------------|
| `src/commands/init.ts` | Orchestrator: resolves flags, prompts, delegates to scaffold helpers, prints summary |
| `src/lib/scaffold.ts` | Pure string/object template builders — one function per file type |
| `src/lib/harness-scaffold.ts` | `planXxx()` returns `PlannedFile[]`; `writePlanned()` handles idempotent writes |
| `src/lib/manifest.ts` | `HarnessManifest` type + I/O (read/write/exists). Validation deferred to a separate story |

## Flag Semantics

| Flag | Default | Values | Effect |
|------|---------|--------|--------|
| `--provider` | `linear` | `linear`, `jira`, `github` | Selects `tickets/config.yaml` shape and records `tickets.provider` in manifest |
| `--template` | `default` | `default`, `minimal`, `api-only` | Chooses which subsystems are scaffolded |
| `--dry-run` | false | — | Prints full planned tree; no writes |

Template matrix:

| Template | lume | meta | tickets | openapi | workflows |
|----------|:----:|:----:|:-------:|:-------:|:---------:|
| default | ✓ | ✓ | ✓ | ✓ | ✓ |
| minimal | ✓ | ✓ | | | |
| api-only | | | | ✓ | |

## Idempotency

`writePlanned()` in `harness-scaffold.ts` is the single chokepoint for harness writes. For each planned file it checks `fs.access`, records `skipped (already exists)` on hit, and writes + records `created` on miss. The indexer files (`config.json`, `context.md`) use the pre-existing writers and are always rewritten — out of scope to harmonize here.

## Error Handling

- Invalid `--provider` or `--template` → throw with list of valid values; `src/cli.ts` catches and prints red error, exits 1.
- File system errors bubble up through the same path.

## Key Design Decisions

- **Plan/write separation.** `planXxx()` returns data; `writePlanned()` performs I/O. Keeps dry-run trivially correct: same plan, no writes.
- **Manifest generation as plain object → `yaml.stringify`.** Avoids string templating risks (escaping, indentation). Comments are prepended as a header string.
- **Name from `path.basename(cwd)`.** Good enough for the manifest's `name` field; users edit later if needed. Avoids an extra interactive prompt.
- **`.gitkeep` files for empty folders.** `meta/feedback/` and `openapi/paths/` are empty at scaffold time; `.gitkeep` ensures git tracks them so subsequent commands can rely on their existence.
