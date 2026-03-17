# Arclume CLI

A command-line tool for configuring any repository for optimal Arclume indexing. Run it once to give Arclume the context it can't infer from code structure alone — architecture, intent, entry points, and what to ignore.

## Installation

```bash
# npm
npm install -g arclume

# Homebrew
brew install arclume

# pip
pip install arclume
```

---

## Commands

### `arclume init`

Initialize a repository for Arclume indexing. Run once at the repo root.

```bash
arclume init [--dry-run]
```

**What it does:**

1. Auto-detects language(s) and framework(s) by inspecting `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.
2. Infers likely entry points (`src/index.ts`, `main.py`, `cmd/`, `app/`, etc.)
3. Reads existing `.gitignore` and extends it with indexing-specific ignore patterns
4. Prompts for anything that can't be inferred: repo description, key architectural decisions, team context
5. Scaffolds all output files with smart defaults
6. Prints a summary of what was generated and suggested next steps

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print what would be generated without writing any files |

**Generated files:**

```
.arclume/
  config.json       ← machine-readable indexer configuration
  context.md        ← human + AI-authored architectural description
.arclumeignore      ← indexing-specific ignore patterns
openspec/
  specs/
    OVERVIEW.md     ← high-level spec stub (if OpenSpec not already present)
```

---

### `arclume context`

Manage the `.arclume/context.md` file.

#### `arclume context generate`

Use the existing Arclume index to auto-draft `context.md` and OpenSpec spec stubs. Requires the repo to already be indexed.

```bash
arclume context generate [--spec-delta]
```

This is the key command — Arclume uses its own graph understanding to describe the repo to itself, producing a draft for human review and editing.

**Flags:**

| Flag | Description |
|------|-------------|
| `--spec-delta` | Also generate a candidate OpenSpec delta spec reflecting changes since the last index |

**With `--spec-delta`:**

Diffs the current codebase graph against the previous index snapshot. Identifies symbols added, removed, or significantly changed, checks whether corresponding `openspec/specs/*.md` sections are still accurate, and generates a draft delta spec at `openspec/changes/auto-{timestamp}/`:

```
openspec/changes/auto-{timestamp}/
  proposal.md     ← plain-English summary of what changed since last index
  spec-delta.md   ← spec sections marked ADDED / MODIFIED / REMOVED
```

Nothing is auto-committed. The output is always a draft for human review.

#### `arclume context validate`

Check that `context.md` and `config.json` are well-formed and complete.

```bash
arclume context validate
```

#### `arclume context diff`

Show what has changed in context files since the last index run.

```bash
arclume context diff
```

---

### `arclume ignore`

Manage `.arclumeignore`.

#### `arclume ignore suggest`

Analyze the repo and recommend ignore patterns for noise files before writing anything. User confirms before applying.

```bash
arclume ignore suggest
```

Suggests patterns for: DB migrations, test fixtures, generated code, vendored dependencies, build artifacts, lock files. Pre-populated based on detected stack.

#### `arclume ignore add`

Add a pattern directly to `.arclumeignore`.

```bash
arclume ignore add <pattern>

# Examples
arclume ignore add "src/generated/**"
arclume ignore add "*.migration.ts"
```

#### `arclume ignore list`

Print all active ignore patterns.

```bash
arclume ignore list
```

---

### `arclume index`

Trigger indexing via the Arclume API.

```bash
arclume index [--watch]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--watch` | Watch for file changes and trigger incremental re-index on save |

**Examples:**

```bash
# Trigger a full re-index
arclume index

# Watch mode during active development
arclume index --watch
```

#### `arclume index status`

Show the current index status for the repo.

```bash
arclume index status
```

---

### `arclume doctor`

Diagnose common indexing health issues and print actionable suggestions.

```bash
arclume doctor
```

**Checks performed:**

| Check | Description |
|-------|-------------|
| Missing `context.md` | No `.arclume/context.md` found — graph quality will be lower |
| No entry points | `config.json` has no `entryPoints` — call graph traversal has no starting nodes |
| Too many files indexed | Likely missing ignore rules; large noise-to-signal ratio |
| Stale index | Last indexed more than N days ago |
| OpenSpec present but unconfigured | `openspec/specs/` exists but not referenced in `config.json` |
| Chunk size mismatch | Chunk size doesn't match repo's average function length |

---

## Configuration

### `.arclume/config.json`

Machine-readable configuration consumed directly by the indexer.

```json
{
  "version": "1",
  "language": ["typescript"],
  "framework": ["next.js"],
  "entryPoints": ["src/index.ts", "src/server.ts"],
  "graphDepth": 5,
  "chunkSize": 512,
  "openspec": true,
  "contextFile": ".arclume/context.md",
  "highWeightPaths": ["src/core/", "src/lib/"],
  "lowWeightPaths": ["src/__tests__/", "scripts/"]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Config schema version |
| `language` | string[] | Languages present in the repo |
| `framework` | string[] | Frameworks detected or declared |
| `entryPoints` | string[] | Where call graph traversal starts |
| `graphDepth` | number | How many hops deep to trace from each entry point |
| `chunkSize` | number | Token budget per chunk; tune for repos with very long or very short functions |
| `openspec` | boolean | Whether to elevate `openspec/specs/*.md` as high-weight anchor nodes |
| `contextFile` | string | Path to the context markdown file |
| `highWeightPaths` | string[] | Directories to boost in search ranking |
| `lowWeightPaths` | string[] | Directories to suppress in search ranking |

---

### `.arclume/context.md`

Human and AI-authored description of the repo. Ingested as a top-level anchor node with elevated embedding weight — shapes how all other nodes in the graph relate.

```markdown
# Repo Context

## What this is
[One paragraph description of what this codebase does and why it exists]

## Architecture
[Key modules, layers, and how they relate to each other]

## Entry Points
[Where to start reading — main files, top-level controllers, root handlers]

## Key Design Decisions
[Why certain approaches were taken — tradeoffs, constraints, historical context]

## What to de-emphasize
[Generated files, legacy modules, vendored code, areas undergoing rewrite]
```

This file is safe to commit. It improves over time as the team keeps it updated — treat it like an architectural README that Arclume actually reads.

---

### `.arclumeignore`

Gitignore-syntax file for excluding paths and patterns from indexing. Pre-populated by `arclume init` based on detected stack.

```gitignore
# Dependencies
node_modules/
vendor/

# Build output
dist/
.next/
build/
out/

# Generated files
*.generated.ts
src/graphql/__generated__/

# Test fixtures
**/__fixtures__/
**/testdata/

# Migrations
db/migrations/

# Environment
.env*
```

---

## OpenSpec Integration

If `openspec/` is present in the repo, Arclume treats it as first-class context.

| Path | How Arclume uses it |
|------|---------------------|
| `openspec/specs/*.md` | Elevated as high-weight anchor nodes; shapes map generation vocabulary and module boundaries |
| `openspec/changes/*/proposal.md` | Used as primary epic context when generating maps |
| `openspec/changes/*/design.md` | Provides architectural constraints for story scoping |
| `openspec/changes/*/tasks.md` | Seeds the initial story list, enriched with codebase graph data |

`arclume init` scaffolds `openspec/specs/OVERVIEW.md` if OpenSpec is not already present.

`arclume context generate --spec-delta` writes candidate updates back to `openspec/changes/auto-{timestamp}/` after a re-index, keeping specs from drifting as code evolves.

---

## Suggested Workflow

**First-time setup:**

```bash
cd your-repo
arclume init
# review and edit .arclume/context.md
arclume index
```

**During active development:**

```bash
arclume index --watch
```

**After merging a significant change:**

```bash
arclume index
arclume context generate --spec-delta
# review openspec/changes/auto-{timestamp}/ and commit if accurate
```

**Periodic health check:**

```bash
arclume doctor
```

---

## All generated files are safe to commit

The `.arclume/` folder, `.arclumeignore`, and any `openspec/` files generated by the CLI contain no secrets and no machine-specific paths. Committing them means every team member and every CI run benefits from the same indexing configuration — and the context file improves as the team maintains it over time.