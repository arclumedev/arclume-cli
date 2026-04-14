# Harness Scaffolding — `arclume init` extension

## Summary

Extend `arclume init` to scaffold the full Lume harness alongside the existing indexer config. A single command now lays down `arclume.yaml` (root manifest) plus five subsystem folders inside `.arclume/` — `lume/`, `meta/`, `tickets/`, `openapi/`, `workflows/` — gated by `--template` and `--provider` flags. This is the open-source on-ramp: teams get a repo-native, machine-readable domain layer without any Arclume account.

## Motivation

Teams using AI coding assistants have no structured way to give those tools domain knowledge about their repo. Conventions, data models, API contracts, and ticketing rules live in silos or in developers' heads. The harness turns all of that into committable markdown/YAML that the CLI, the local MCP server, and any LLM client can read.

For Arclume specifically, the scaffolding is the bottom of the funnel: free, no login required, immediate value. The hosted product (story maps, cloud indexing, team sharing) becomes the natural upgrade — not a gate.

## Scope

This change covers the scaffolding command only:

- `arclume init` writes `arclume.yaml` at the repo root and seeds subsystem folders under `.arclume/`.
- `--provider linear|jira|github` selects the `tickets/config.yaml` starter and records `tickets.provider` in the manifest.
- `--template default|minimal|api-only` controls which subsystems are scaffolded.
- Idempotent: existing files are preserved, not overwritten; per-file summary reports `created` vs `skipped (already exists)`.
- `--dry-run` extended to print the full planned tree.
- `.nvmrc` pinned to Node 24; `package.json` gains `engines: { node: ">=22" }`.

Out of scope (sibling stories): `arclume lume validate/index/diff`, `arclume meta reflect`, `arclume tickets *`, `arclume spec *`, `arclume run`, `arclume serve`, and the typed manifest loader/validator consumed by those commands.

## Dependencies

- `yaml` npm package (new dependency) for manifest and subsystem YAML emission.
- Existing `commander`, `chalk`, `@inquirer/prompts` — unchanged.

## Key Design Decisions

- **`arclume.yaml` at repo root, not inside `.arclume/`.** The manifest is discoverable and file-watched separately from indexer artifacts.
- **Indexer config stays in `.arclume/config.json`.** Different concern from the harness manifest; merging would overload one file with two audiences (machine indexer config vs. human-edited harness wiring).
- **Harness OpenAPI subsystem named `openapi/`, not `openspec/`.** Avoids collision with the existing OpenSpec convention at `openspec/` (repo root).
- **Idempotency is per-file, not per-directory.** Re-running after hand-edits preserves user content and fills in anything missing. The "skipped" summary makes it clear what was touched.
- **No login required.** Scaffolding is purely local filesystem work. No API calls, no token check.
