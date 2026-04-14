# Harness Manifest — `arclume.yaml`

The harness manifest is the root configuration file for the Lume harness. It lives at the repo root and ties together the five harness subsystems: `lume`, `meta`, `tickets`, `openapi`, `workflows`.

`arclume init` generates this file. Every downstream command (`arclume lume validate`, `arclume meta reflect`, `arclume spec validate`, `arclume run`, `arclume serve`) reads it via the shared loader in `src/lib/manifest.ts`.

## Example

```yaml
# Arclume harness manifest — edit to wire up subsystems.
version: "1"
name: my-project
context_budget: 8000
auto_index: false
lume:
  schema: .arclume/lume/schema.yaml
  entities_dir: .arclume/lume/entities
meta:
  dir: .arclume/meta
tickets:
  provider: linear
  config: .arclume/tickets/config.yaml
openapi:
  index: .arclume/openapi/index.yaml
workflows:
  dir: .arclume/workflows
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | ✓ | Manifest schema version. Currently `"1"`. Newer values are loaded best-effort with a warning. |
| `name` | string | ✓ | Human-readable project name. Used in generated files (e.g. OpenAPI `info.title`). |
| `context_budget` | positive integer | | Token budget hint for LLM consumers. Default when generated: `8000`. |
| `auto_index` | boolean | | When true, `arclume lume index` runs on file save (watch mode). Default: `false`. |
| `lume` | object | | Lume subsystem config. Omit to skip. |
| `lume.schema` | string (path) | ✓ (when `lume` present) | Path to `schema.yaml` — the entity type definitions. |
| `lume.entities_dir` | string (path) | ✓ (when `lume` present) | Directory containing `.lume.md` entity files. |
| `meta` | object | | Meta subsystem config. Omit to skip. |
| `meta.dir` | string (path) | ✓ (when `meta` present) | Directory containing `principles.md`, `CHANGELOG.md`, and `feedback/`. |
| `tickets` | object | | Tickets subsystem config. Omit to skip. |
| `tickets.provider` | enum | ✓ (when `tickets` present) | One of `linear`, `jira`, `github`. |
| `tickets.config` | string (path) | ✓ (when `tickets` present) | Path to provider-specific `config.yaml`. |
| `openapi` | object | | OpenAPI subsystem config. Omit to skip. |
| `openapi.index` | string (path) | ✓ (when `openapi` present) | Path to `index.yaml` — the OpenAPI 3.1 entry point. |
| `workflows` | object | | Workflows subsystem config. Omit to skip. |
| `workflows.dir` | string (path) | ✓ (when `workflows` present) | Directory containing workflow YAML files. |

Unknown top-level or sub-section fields are ignored for forward compatibility.

### Path resolution

All subsystem paths are relative to the directory containing `arclume.yaml`. The loader resolves them to absolute paths before returning. Absolute paths are also accepted but discouraged — they break portability.

The loader does **not** check whether the referenced files exist. That's each subsystem command's job (e.g. `arclume lume validate` verifies `schema.yaml`).

## Discovery

Commands walk up from the current working directory looking for `arclume.yaml`, the same way `git` finds `.git`. The walk stops at:

- The first directory containing `arclume.yaml` (found — use this)
- The first directory containing `.git` but no `arclume.yaml` (repo boundary — don't climb into a parent repo)
- The filesystem root (not found — error with `NOT_FOUND`)

This means you can run any harness command from a nested subdirectory and it will find the correct manifest.

## Errors

The loader throws `ManifestError` (see `src/lib/manifest.ts`) with a list of `ManifestIssue` objects. Each issue carries a code:

| Code | Meaning |
|------|---------|
| `NOT_FOUND` | No `arclume.yaml` found walking up from the start directory. |
| `PARSE_ERROR` | YAML is syntactically invalid. Message includes parser line/column. |
| `MISSING_REQUIRED` | A required field is missing or empty. |
| `TYPE_MISMATCH` | A field has the wrong type (e.g. `auto_index: "yes"` instead of a boolean). |
| `INVALID_ENUM` | An enum field has a value outside the allowed set (e.g. `tickets.provider: gitlab`). |

The CLI prints these via `formatManifestError()` — one line per issue, sorted as given.

## Templates

`arclume init` supports three templates that affect which subsystem sections are emitted:

| Template | lume | meta | tickets | openapi | workflows |
|----------|:----:|:----:|:-------:|:-------:|:---------:|
| `default` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `minimal` | ✓ | ✓ | | | |
| `api-only` | | | | ✓ | |

You can hand-edit the manifest afterwards to add or remove sections. The loader accepts any combination as long as each present section has its required fields.

## Version policy

The manifest `version` field is a contract, not a marketing version. Breaking changes to the field shape bump the version number (e.g. renaming `entities_dir` to `entities`). The CLI's `version` in `package.json` is orthogonal.

When a CLI encounters a newer manifest version than it supports, it prints a warning and attempts best-effort load. This keeps old CLIs usable against forward-compatible manifests.
