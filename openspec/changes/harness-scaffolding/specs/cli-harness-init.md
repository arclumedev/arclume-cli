# CLI Harness Init — Spec

## Purpose

Define the `arclume init` command's behavior when scaffolding the Lume harness into a repository.

## Requirements

### R1: Root Manifest

The CLI SHALL write `arclume.yaml` at the repo root containing the harness manifest.

The manifest SHALL include `version`, `name` (defaulting to the cwd basename), `context_budget`, and `auto_index` fields.

The manifest SHALL include subsystem sections (`lume`, `meta`, `tickets`, `openapi`, `workflows`) only for subsystems scaffolded by the selected template.

### R2: Subsystem Scaffolding

The CLI SHALL scaffold subsystem folders inside `.arclume/` based on the `--template` flag:

- `default` → `lume/`, `meta/`, `tickets/`, `openapi/`, `workflows/`
- `minimal` → `lume/`, `meta/`
- `api-only` → `openapi/`

Each subsystem SHALL include starter files sufficient for a user to understand its format without reading external docs.

### R3: Provider Config

The CLI SHALL accept `--provider <linear|jira|github>` (default `linear`).

The CLI SHALL write a provider-appropriate `.arclume/tickets/config.yaml` when the `tickets` subsystem is scaffolded, containing provider-specific keys and an `api_token_env` reference (never a literal token).

### R4: Idempotency

The CLI SHALL skip any harness file that already exists and report it as `skipped (already exists)` in the summary.

The CLI SHALL NOT overwrite files the user has edited.

### R5: Dry Run

The CLI SHALL support `--dry-run` that prints every planned file (existing indexer files + harness files) without writing.

### R6: No Authentication

The CLI SHALL scaffold the harness without requiring login, API tokens, or network access.

### R7: Node Version

The package SHALL pin a recommended Node version via `.nvmrc`.

The package SHALL declare an `engines.node` floor that admits the recommended version and the one prior LTS.

## Scenarios

### Clean-repo default scaffold
Given an empty repo
When the user runs `arclume init`
Then `arclume.yaml`, `.arclumeignore`, `.arclume/config.json`, `.arclume/context.md`, `openspec/specs/OVERVIEW.md`, and all five subsystem folders are created

### Provider selection
Given an empty repo
When the user runs `arclume init --provider jira`
Then `.arclume/tickets/config.yaml` contains jira-specific keys (`domain`, `project_key`, `email`, `api_token_env: JIRA_API_TOKEN`)
And `arclume.yaml` records `tickets.provider: jira`

### Minimal template
Given an empty repo
When the user runs `arclume init --template minimal`
Then only `lume/` and `meta/` are scaffolded under `.arclume/`
And `arclume.yaml` omits the `tickets`, `openapi`, and `workflows` sections

### Idempotent re-run
Given a repo already initialized with `arclume init`
When the user runs `arclume init` again
Then every harness file is reported `skipped (already exists)`
And no harness file's mtime changes

### Dry run
Given any repo
When the user runs `arclume init --dry-run`
Then every planned file is printed to stdout
And no files are written to disk

### Invalid flag
Given any repo
When the user runs `arclume init --provider gitlab`
Then the CLI prints a red error listing valid providers
And exits with code 1
