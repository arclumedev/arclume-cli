# Arclume CLI — Overview Spec

## What this is

A TypeScript/Node.js command-line tool for configuring any repository for optimal Arclume indexing. Run once at the repo root to give Arclume the context it cannot infer from code structure alone: architecture, intent, entry points, and what to ignore.

Distributed via npm (`npm install -g arclume`), Homebrew, and pip.

## Commands

| Command | Purpose |
|---------|---------|
| `arclume init` | One-time repo setup: detects stack, infers entry points, prompts for context, scaffolds config files |
| `arclume context generate` | Uses existing Arclume index to auto-draft `context.md` and OpenSpec stubs |
| `arclume context validate` | Validates `context.md` and `config.json` are well-formed |
| `arclume context diff` | Shows what changed in context files since last index |
| `arclume ignore suggest` | Recommends ignore patterns based on detected stack |
| `arclume ignore add <pattern>` | Adds a pattern to `.arclumeignore` |
| `arclume ignore list` | Prints all active ignore patterns |
| `arclume index` | Triggers a full re-index via the Arclume API |
| `arclume index --watch` | Watches for file changes and triggers incremental re-index |
| `arclume index status` | Shows current index status |
| `arclume doctor` | Diagnoses indexing health issues with actionable suggestions |
| `arclume workflow list` | Lists all workflows with name, status, tag, and last run |
| `arclume workflow describe <name>` | Shows full workflow config, node graph, and schemas |
| `arclume workflow run <name>` | Executes a workflow with typed parameters and streaming output |
| `arclume workflow export <name>` | Exports a workflow definition as markdown |

## Generated Artifacts

All output files are safe to commit and contain no secrets or machine-specific paths.

| File | Description |
|------|-------------|
| `.arclume/config.json` | Machine-readable indexer configuration (languages, frameworks, entry points, graph depth, chunk size, path weights) |
| `.arclume/context.md` | Human and AI-authored architectural description; ingested as a top-level anchor node |
| `.arclumeignore` | Gitignore-syntax exclusion file; pre-populated from detected stack |
| `openspec/specs/OVERVIEW.md` | High-level spec stub scaffolded by `arclume init` if OpenSpec is not already present |

## OpenSpec Integration

If `openspec/` is present, Arclume treats it as first-class context:

- `openspec/specs/*.md` — elevated as high-weight anchor nodes
- `openspec/changes/*/proposal.md` — primary epic context for map generation
- `openspec/changes/*/design.md` — architectural constraints for story scoping
- `openspec/changes/*/tasks.md` — seeds initial story list, enriched with graph data

`arclume context generate --spec-delta` writes candidate spec updates to `openspec/changes/auto-{timestamp}/` after re-index, keeping specs from drifting as code evolves.

## Key Design Decisions

- The CLI is a configuration and scaffolding tool only — it does not perform indexing itself, but triggers it via the Arclume API.
- `context.md` is the primary lever for improving index quality; it acts as a weighted anchor node that shapes how all other graph nodes relate.
- All prompts during `init` are for information that cannot be auto-detected (repo purpose, architectural intent, team context).
- Nothing is auto-committed; all generated outputs are drafts for human review.

## Entry Points

_To be defined as the codebase is built out._
