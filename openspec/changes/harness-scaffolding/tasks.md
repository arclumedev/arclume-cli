# Harness Scaffolding — Tasks

## Implementation Tasks

- [x] Pin Node version: add `.nvmrc` (24) and `package.json` `engines: { node: ">=22" }`
- [x] Add `yaml` dependency
- [x] Create `src/lib/manifest.ts` — `HarnessManifest` interface + read/write/exists helpers
- [x] Extend `src/lib/scaffold.ts` with harness template functions (manifest, lume schema, entities README, principles, changelog, tickets config per provider, ticket templates, OpenAPI index, example workflow)
- [x] Create `src/lib/harness-scaffold.ts` — `planXxx()` helpers and shared `writePlanned()` with idempotency
- [x] Extend `src/commands/init.ts` to accept `provider` and `template` options, orchestrate harness writes, extend dry-run branch and summary
- [x] Wire `--provider` and `--template` flags in `src/cli.ts`
- [x] Verify: default/minimal/api-only templates, provider flag variants, idempotency on re-run, dry-run, typecheck

## Follow-up (not in this change)

- [ ] Typed manifest loader with validation and path resolution (sibling story: `arclume.yaml — manifest schema and loader`)
- [ ] `arclume lume validate` reads the scaffolded `schema.yaml` and entity files
