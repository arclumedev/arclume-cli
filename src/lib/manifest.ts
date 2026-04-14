import fs from "fs/promises";
import path from "path";
import YAML from "yaml";

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

function manifestPath(): string {
  return path.join(process.cwd(), "arclume.yaml");
}

export async function manifestExists(): Promise<boolean> {
  try {
    await fs.access(manifestPath());
    return true;
  } catch {
    return false;
  }
}

export async function readManifest(): Promise<HarnessManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath(), "utf-8");
    return YAML.parse(raw) as HarnessManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: HarnessManifest): Promise<void> {
  await fs.writeFile(manifestPath(), YAML.stringify(manifest), "utf-8");
}
