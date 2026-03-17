import fs from "fs/promises";
import path from "path";

export interface ArclumeConfig {
  version: string;
  language: string[];
  framework: string[];
  entryPoints: string[];
  graphDepth: number;
  chunkSize: number;
  openspec: boolean;
  contextFile: string;
  highWeightPaths: string[];
  lowWeightPaths: string[];
}

function arclumeDir(): string {
  return path.join(process.cwd(), ".arclume");
}

function configPath(): string {
  return path.join(arclumeDir(), "config.json");
}

export async function readConfig(): Promise<ArclumeConfig | null> {
  try {
    const raw = await fs.readFile(configPath(), "utf-8");
    return JSON.parse(raw) as ArclumeConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: ArclumeConfig): Promise<void> {
  await fs.mkdir(arclumeDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function configExists(): Promise<boolean> {
  try {
    await fs.access(configPath());
    return true;
  } catch {
    return false;
  }
}
