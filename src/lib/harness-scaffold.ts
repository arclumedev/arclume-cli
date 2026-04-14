import fs from "fs/promises";
import path from "path";
import {
  lumeSchemaTemplate,
  lumeEntitiesReadmeTemplate,
  principlesTemplate,
  metaChangelogTemplate,
  ticketsConfigTemplate,
  ticketBugTemplate,
  ticketFeatureTemplate,
  openapiIndexTemplate,
  workflowExampleTemplate,
} from "./scaffold.js";
import type { TicketsProvider } from "./manifest.js";

export interface FileResult {
  file: string;
  status: string;
}

export interface PlannedFile {
  relPath: string;
  content: string;
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

export async function writePlanned(
  root: string,
  planned: PlannedFile[],
  opts: { dryRun: boolean }
): Promise<FileResult[]> {
  const results: FileResult[] = [];
  for (const { relPath, content } of planned) {
    const abs = path.join(root, relPath);
    if (await exists(abs)) {
      results.push({ file: relPath, status: "skipped (already exists)" });
      continue;
    }
    if (!opts.dryRun) {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf-8");
    }
    results.push({ file: relPath, status: "created" });
  }
  return results;
}

export function planLume(): PlannedFile[] {
  return [
    { relPath: ".arclume/lume/schema.yaml", content: lumeSchemaTemplate() },
    { relPath: ".arclume/lume/entities/README.md", content: lumeEntitiesReadmeTemplate() },
  ];
}

export function planMeta(): PlannedFile[] {
  return [
    { relPath: ".arclume/meta/principles.md", content: principlesTemplate() },
    { relPath: ".arclume/meta/CHANGELOG.md", content: metaChangelogTemplate() },
    { relPath: ".arclume/meta/feedback/.gitkeep", content: "" },
  ];
}

export function planTickets(provider: TicketsProvider): PlannedFile[] {
  return [
    { relPath: ".arclume/tickets/config.yaml", content: ticketsConfigTemplate(provider) },
    { relPath: ".arclume/tickets/templates/bug.md", content: ticketBugTemplate() },
    { relPath: ".arclume/tickets/templates/feature.md", content: ticketFeatureTemplate() },
  ];
}

export function planOpenapi(name: string): PlannedFile[] {
  return [
    { relPath: ".arclume/openapi/index.yaml", content: openapiIndexTemplate(name) },
    { relPath: ".arclume/openapi/paths/.gitkeep", content: "" },
  ];
}

export function planWorkflows(): PlannedFile[] {
  return [
    { relPath: ".arclume/workflows/example.yaml", content: workflowExampleTemplate() },
  ];
}
