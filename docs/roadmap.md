# Arclume CLI — Roadmap

> Draft for review. Priorities and sequencing subject to change.

---

## Now — v0.1 (Current)

Core scaffolding and configuration experience.

- `arclume init` — stack detection, context scaffolding, ignore patterns
- `arclume doctor` — indexing health checks
- `arclume context validate / diff`
- `arclume ignore suggest / add / list`
- `arclume index` — API trigger (stub)
- GitHub + Linear integration (via Arclume platform)

---

## Next — v0.2

**Stabilize the core loop and ship auth.**

- `arclume login / logout / whoami` — OAuth flow, OS keychain storage
- `arclume index` — live API integration (full re-index, status polling)
- `arclume index --watch` — incremental re-index on file change
- `arclume context generate` — AI-drafted context.md from index
- `arclume context generate --spec-delta` — OpenSpec delta after re-index
- CI/CD support via `ARCLUME_TOKEN` env var

---

## Near-term — v0.3–0.4

**Integrations: expand where teams work.**

The current GitHub + Linear surface covers a subset of engineering orgs. Priority integrations:

| Integration | Notes |
|-------------|-------|
| **GitLab** | Self-hosted and cloud; common in enterprise and European orgs |
| **Jira** | Highest-volume issue tracker; story push parity with Linear |
| **Azure DevOps / Azure Git** | Required for Microsoft-stack and enterprise accounts |
| **Bitbucket** | Atlassian orgs already using Jira |
| **GitHub Enterprise Server** | On-prem GitHub for regulated industries |

Each integration adds:
- Repo connection + indexing trigger
- Story/issue push from planning surface
- Auth handled via the same `arclume login` flow (provider selection)

---

## Medium-term — v0.5–0.6

**Customer expansion and activation.**

As paying customers come on, the CLI becomes the primary onboarding surface. Focus shifts to reducing time-to-value:

- **Guided onboarding flow** — `arclume init` detects a new repo with no prior index and walks through connection, context authoring, and first index in one session
- **Team setup** — `arclume init --team` scaffolds shared `.arclume/` config suitable for committing across a multi-developer org
- **Org-level defaults** — admins set default `graphDepth`, `chunkSize`, high/low weight paths at the org level; `arclume init` inherits them
- **Usage telemetry (opt-in)** — surface which commands are used, where `doctor` finds issues, what ignore patterns are common — feeds product decisions

---

## Feedback Loops

Getting signal from active users back into the product.

### CLI-side
- `arclume feedback` command — one-liner to open a feedback form pre-filled with CLI version, OS, and current `doctor` output (opt-in)
- `arclume doctor` output optionally sent to Arclume platform for aggregate health reporting across an org's repos
- `--verbose` flag on all commands for detailed logs users can share when filing issues

### Platform-side (informs CLI roadmap)
- Track which integrations are blocked on — use as signal for integration prioritization
- Monitor `doctor` failure patterns across customer repos — common failures become new `init` defaults or prompts
- Surface context.md quality scores over time — prompt users via CLI when quality degrades after significant code changes

---

## Later / Under Consideration

- **Monorepo support** — `arclume init --workspace` for npm/yarn/pnpm/Turborepo workspaces; per-package config with shared root
- **Custom index profiles** — named configs for different indexing modes (e.g. fast/shallow for CI, deep for planning)
- **Context.md quality scoring** — local heuristic in `arclume doctor` that rates context completeness and flags stale sections
- **IDE extensions** — thin wrappers around the MCP server for VS Code and JetBrains that surface `doctor` and `index status` in the editor UI
- **SSO / SAML** — enterprise auth for orgs that can't use browser OAuth

---

## Open Questions

- Should Jira or GitLab be prioritized first? (depends on customer mix in Q2)
- Is `arclume feedback` the right surface for qualitative input, or should it live in the platform?
- How much of the onboarding flow belongs in the CLI vs. the web app?
