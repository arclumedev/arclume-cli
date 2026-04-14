import fs from "fs/promises";
import path from "path";
import YAML, { YAMLParseError } from "yaml";

export type TicketsProvider = "linear" | "jira" | "github";

export interface HarnessManifest {
  version: string;
  name: string;
  context_budget?: number;
  auto_index?: boolean;
  lume?: {
    schema: string;
    entities_dir: string;
  };
  meta?: {
    dir: string;
  };
  tickets?: {
    provider: TicketsProvider;
    config: string;
  };
  openapi?: {
    index: string;
  };
  workflows?: {
    dir: string;
  };
}

export interface ResolvedManifest extends HarnessManifest {
  rootDir: string;
}

export type ManifestIssueCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "MISSING_REQUIRED"
  | "TYPE_MISMATCH"
  | "INVALID_ENUM";

export interface ManifestIssue {
  path: string;
  message: string;
  code: ManifestIssueCode;
}

export class ManifestError extends Error {
  issues: ManifestIssue[];
  manifestPath: string | null;

  constructor(issues: ManifestIssue[], manifestPath: string | null) {
    super(
      issues.length === 1
        ? `arclume.yaml: ${issues[0]!.message}`
        : `arclume.yaml: ${issues.length} issues`
    );
    this.name = "ManifestError";
    this.issues = issues;
    this.manifestPath = manifestPath;
  }
}

const VALID_PROVIDERS: ReadonlySet<TicketsProvider> = new Set(["linear", "jira", "github"]);
const SUPPORTED_VERSION = "1";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findManifestPath(startDir: string = process.cwd()): Promise<string | null> {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, "arclume.yaml");
    if (await exists(candidate)) return candidate;

    // Stop at git repo boundary to avoid picking up a parent repo's manifest
    if (await exists(path.join(dir, ".git"))) return null;

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function manifestExists(): Promise<boolean> {
  return exists(path.join(process.cwd(), "arclume.yaml"));
}

export async function writeManifest(manifest: HarnessManifest): Promise<void> {
  const target = path.join(process.cwd(), "arclume.yaml");
  await fs.writeFile(target, YAML.stringify(manifest), "utf-8");
}

function isStringField(val: unknown): val is string {
  return typeof val === "string" && val.length > 0;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function validate(raw: unknown): { manifest: HarnessManifest; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];

  if (!isPlainObject(raw)) {
    issues.push({
      path: "",
      message: "manifest must be a YAML object at the top level",
      code: "TYPE_MISMATCH",
    });
    return { manifest: {} as HarnessManifest, issues };
  }

  if (!isStringField(raw.version)) {
    issues.push({
      path: "version",
      message: "field required (string)",
      code: "MISSING_REQUIRED",
    });
  } else if (raw.version !== SUPPORTED_VERSION) {
    // Forward-compat: warn, don't fail. Printed by the caller if desired.
    console.warn(
      `warn: arclume.yaml version "${raw.version}" is newer than supported ("${SUPPORTED_VERSION}"); attempting best-effort load.`
    );
  }

  if (!isStringField(raw.name)) {
    issues.push({
      path: "name",
      message: "field required (non-empty string)",
      code: "MISSING_REQUIRED",
    });
  }

  if (raw.context_budget !== undefined) {
    if (typeof raw.context_budget !== "number" || !Number.isInteger(raw.context_budget) || raw.context_budget <= 0) {
      issues.push({
        path: "context_budget",
        message: "must be a positive integer",
        code: "TYPE_MISMATCH",
      });
    }
  }

  if (raw.auto_index !== undefined && typeof raw.auto_index !== "boolean") {
    issues.push({
      path: "auto_index",
      message: "must be a boolean",
      code: "TYPE_MISMATCH",
    });
  }

  if (raw.lume !== undefined) {
    if (!isPlainObject(raw.lume)) {
      issues.push({ path: "lume", message: "must be an object", code: "TYPE_MISMATCH" });
    } else {
      if (!isStringField(raw.lume.schema)) {
        issues.push({
          path: "lume.schema",
          message: "field required when lume section is present",
          code: "MISSING_REQUIRED",
        });
      }
      if (!isStringField(raw.lume.entities_dir)) {
        issues.push({
          path: "lume.entities_dir",
          message: "field required when lume section is present",
          code: "MISSING_REQUIRED",
        });
      }
    }
  }

  if (raw.meta !== undefined) {
    if (!isPlainObject(raw.meta)) {
      issues.push({ path: "meta", message: "must be an object", code: "TYPE_MISMATCH" });
    } else if (!isStringField(raw.meta.dir)) {
      issues.push({
        path: "meta.dir",
        message: "field required when meta section is present",
        code: "MISSING_REQUIRED",
      });
    }
  }

  if (raw.tickets !== undefined) {
    if (!isPlainObject(raw.tickets)) {
      issues.push({ path: "tickets", message: "must be an object", code: "TYPE_MISMATCH" });
    } else {
      if (!isStringField(raw.tickets.provider)) {
        issues.push({
          path: "tickets.provider",
          message: "field required when tickets section is present",
          code: "MISSING_REQUIRED",
        });
      } else if (!VALID_PROVIDERS.has(raw.tickets.provider as TicketsProvider)) {
        issues.push({
          path: "tickets.provider",
          message: `"${raw.tickets.provider}" not one of linear|jira|github`,
          code: "INVALID_ENUM",
        });
      }
      if (!isStringField(raw.tickets.config)) {
        issues.push({
          path: "tickets.config",
          message: "field required when tickets section is present",
          code: "MISSING_REQUIRED",
        });
      }
    }
  }

  if (raw.openapi !== undefined) {
    if (!isPlainObject(raw.openapi)) {
      issues.push({ path: "openapi", message: "must be an object", code: "TYPE_MISMATCH" });
    } else if (!isStringField(raw.openapi.index)) {
      issues.push({
        path: "openapi.index",
        message: "field required when openapi section is present",
        code: "MISSING_REQUIRED",
      });
    }
  }

  if (raw.workflows !== undefined) {
    if (!isPlainObject(raw.workflows)) {
      issues.push({ path: "workflows", message: "must be an object", code: "TYPE_MISMATCH" });
    } else if (!isStringField(raw.workflows.dir)) {
      issues.push({
        path: "workflows.dir",
        message: "field required when workflows section is present",
        code: "MISSING_REQUIRED",
      });
    }
  }

  return { manifest: raw as unknown as HarnessManifest, issues };
}

function resolvePaths(manifest: HarnessManifest, rootDir: string): ResolvedManifest {
  const r = (rel: string): string => path.resolve(rootDir, rel);
  const out: ResolvedManifest = { ...manifest, rootDir };
  if (manifest.lume) {
    out.lume = { schema: r(manifest.lume.schema), entities_dir: r(manifest.lume.entities_dir) };
  }
  if (manifest.meta) {
    out.meta = { dir: r(manifest.meta.dir) };
  }
  if (manifest.tickets) {
    out.tickets = { provider: manifest.tickets.provider, config: r(manifest.tickets.config) };
  }
  if (manifest.openapi) {
    out.openapi = { index: r(manifest.openapi.index) };
  }
  if (manifest.workflows) {
    out.workflows = { dir: r(manifest.workflows.dir) };
  }
  return out;
}

export async function loadManifest(startDir: string = process.cwd()): Promise<ResolvedManifest> {
  const manifestPath = await findManifestPath(startDir);
  if (!manifestPath) {
    throw new ManifestError(
      [
        {
          path: "",
          message:
            "no arclume.yaml found in the current directory or any parent. Run `arclume init` to create one.",
          code: "NOT_FOUND",
        },
      ],
      null
    );
  }

  const raw = await fs.readFile(manifestPath, "utf-8");

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw, { prettyErrors: true });
  } catch (err) {
    const message =
      err instanceof YAMLParseError
        ? `${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    throw new ManifestError(
      [{ path: "", message, code: "PARSE_ERROR" }],
      manifestPath
    );
  }

  const { manifest, issues } = validate(parsed);
  if (issues.length > 0) {
    throw new ManifestError(issues, manifestPath);
  }

  return resolvePaths(manifest, path.dirname(manifestPath));
}

export function formatManifestError(err: ManifestError): string {
  const header =
    err.issues.length === 1
      ? `✗ ${err.manifestPath ?? "arclume.yaml"}`
      : `✗ ${err.manifestPath ?? "arclume.yaml"}: ${err.issues.length} issues`;

  const lines = [header, ""];
  const pathWidth = Math.max(...err.issues.map((i) => i.path.length || 1));
  const codeWidth = Math.max(...err.issues.map((i) => i.code.length));

  for (const issue of err.issues) {
    const pathCol = (issue.path || "(root)").padEnd(pathWidth);
    const codeCol = issue.code.padEnd(codeWidth);
    lines.push(`  ${pathCol}  ${codeCol}  ${issue.message}`);
  }

  if (err.manifestPath) {
    lines.push("");
    lines.push(`Fix ${err.manifestPath} and re-run.`);
  }

  return lines.join("\n");
}
