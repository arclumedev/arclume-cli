import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  ManifestError,
  findManifestPath,
  loadManifest,
} from "./manifest.js";

// Lightweight assertion helpers — keeps this file zero-dep.
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, label: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`✗ ${label}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  const ok = actual === expected;
  assert(ok, ok ? label : `${label}\n    expected: ${String(expected)}\n    actual:   ${String(actual)}`);
}

async function mktempRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-test-"));
  await fs.mkdir(path.join(dir, ".git"), { recursive: true });
  return dir;
}

const DEFAULT_MANIFEST = `version: "1"
name: test-project
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
`;

const MINIMAL_MANIFEST = `version: "1"
name: minimal-project
lume:
  schema: .arclume/lume/schema.yaml
  entities_dir: .arclume/lume/entities
meta:
  dir: .arclume/meta
`;

async function caseHappyPath(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(path.join(root, "arclume.yaml"), DEFAULT_MANIFEST);
  const r = await loadManifest(root);
  assertEq(r.name, "test-project", "happy: name");
  assertEq(r.version, "1", "happy: version");
  assertEq(r.context_budget, 8000, "happy: context_budget");
  assertEq(r.rootDir, root, "happy: rootDir matches");
  assertEq(
    r.lume?.schema,
    path.join(root, ".arclume/lume/schema.yaml"),
    "happy: lume.schema resolved absolute"
  );
  assertEq(
    r.tickets?.config,
    path.join(root, ".arclume/tickets/config.yaml"),
    "happy: tickets.config resolved absolute"
  );
  assertEq(r.tickets?.provider, "linear", "happy: tickets.provider preserved");
}

async function caseMinimalTemplate(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(path.join(root, "arclume.yaml"), MINIMAL_MANIFEST);
  const r = await loadManifest(root);
  assertEq(r.tickets, undefined, "minimal: tickets omitted");
  assertEq(r.openapi, undefined, "minimal: openapi omitted");
  assertEq(r.workflows, undefined, "minimal: workflows omitted");
  assert(r.lume !== undefined, "minimal: lume present");
}

async function caseNotFound(): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "no-manifest-"));
  await fs.mkdir(path.join(dir, ".git"), { recursive: true }); // git boundary so walk stops
  try {
    await loadManifest(dir);
    assert(false, "not-found: expected throw");
  } catch (err) {
    assert(err instanceof ManifestError, "not-found: throws ManifestError");
    const e = err as ManifestError;
    assertEq(e.issues.length, 1, "not-found: one issue");
    assertEq(e.issues[0]!.code, "NOT_FOUND", "not-found: correct code");
  }
}

async function caseParseError(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(path.join(root, "arclume.yaml"), "name: ok\n  bad: indent:\n");
  try {
    await loadManifest(root);
    assert(false, "parse-error: expected throw");
  } catch (err) {
    assert(err instanceof ManifestError, "parse-error: throws ManifestError");
    assertEq((err as ManifestError).issues[0]!.code, "PARSE_ERROR", "parse-error: correct code");
  }
}

async function caseMissingRequired(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(path.join(root, "arclume.yaml"), 'version: "1"\n');
  try {
    await loadManifest(root);
    assert(false, "missing-required: expected throw");
  } catch (err) {
    const e = err as ManifestError;
    const nameIssue = e.issues.find((i) => i.path === "name");
    assert(nameIssue !== undefined, "missing-required: name issue reported");
    assertEq(nameIssue!.code, "MISSING_REQUIRED", "missing-required: correct code");
  }
}

async function caseInvalidEnum(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(
    path.join(root, "arclume.yaml"),
    `version: "1"\nname: test\ntickets:\n  provider: gitlab\n  config: .arclume/tickets/config.yaml\n`
  );
  try {
    await loadManifest(root);
    assert(false, "invalid-enum: expected throw");
  } catch (err) {
    const e = err as ManifestError;
    const providerIssue = e.issues.find((i) => i.path === "tickets.provider");
    assert(providerIssue !== undefined, "invalid-enum: provider issue reported");
    assertEq(providerIssue!.code, "INVALID_ENUM", "invalid-enum: correct code");
  }
}

async function caseWalkUp(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(path.join(root, "arclume.yaml"), DEFAULT_MANIFEST);
  const nested = path.join(root, "src", "components");
  await fs.mkdir(nested, { recursive: true });
  const r = await loadManifest(nested);
  assertEq(r.rootDir, root, "walk-up: finds manifest at repo root from nested dir");
}

async function caseGitBoundary(): Promise<void> {
  const outer = await mktempRepo();
  await fs.writeFile(path.join(outer, "arclume.yaml"), DEFAULT_MANIFEST);
  // Nested repo with its own .git but no manifest — walk should stop at inner boundary
  const inner = path.join(outer, "packages", "inner");
  await fs.mkdir(path.join(inner, ".git"), { recursive: true });
  const found = await findManifestPath(inner);
  assertEq(found, null, "git-boundary: walk stops at nested .git");
}

async function caseAutoIndexTypeMismatch(): Promise<void> {
  const root = await mktempRepo();
  await fs.writeFile(
    path.join(root, "arclume.yaml"),
    `version: "1"\nname: test\nauto_index: "yes"\n`
  );
  try {
    await loadManifest(root);
    assert(false, "auto_index: expected throw");
  } catch (err) {
    const e = err as ManifestError;
    const issue = e.issues.find((i) => i.path === "auto_index");
    assertEq(issue?.code, "TYPE_MISMATCH", "auto_index: type mismatch reported");
  }
}

export async function runTests(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ["happy path (default manifest)", caseHappyPath],
    ["minimal template", caseMinimalTemplate],
    ["not found", caseNotFound],
    ["parse error", caseParseError],
    ["missing required", caseMissingRequired],
    ["invalid enum", caseInvalidEnum],
    ["walk up from nested", caseWalkUp],
    ["git boundary", caseGitBoundary],
    ["auto_index type mismatch", caseAutoIndexTypeMismatch],
  ];

  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      failed++;
      failures.push(`${name} (uncaught: ${err instanceof Error ? err.message : String(err)})`);
      console.error(`✗ ${name} — uncaught: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = passed + failed;
  console.log(`\n${failed === 0 ? "✓" : "✗"} ${passed}/${total} assertions passed`);
  if (failed > 0) {
    console.error(`\n${failed} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

// Allow `tsx src/lib/manifest.test.ts` to run standalone
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runTests();
}
