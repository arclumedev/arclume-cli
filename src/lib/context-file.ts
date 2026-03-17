import fs from "fs/promises";
import path from "path";

function contextPath(): string {
  return path.join(process.cwd(), ".arclume", "context.md");
}

export async function contextExists(): Promise<boolean> {
  try {
    await fs.access(contextPath());
    return true;
  } catch {
    return false;
  }
}

export async function readContext(): Promise<string | null> {
  try {
    return await fs.readFile(contextPath(), "utf-8");
  } catch {
    return null;
  }
}

export async function writeContext(content: string): Promise<void> {
  const dir = path.join(process.cwd(), ".arclume");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(contextPath(), content, "utf-8");
}

export interface ValidationResult {
  section: string;
  present: boolean;
}

const REQUIRED_SECTIONS = [
  "What this is",
  "Architecture",
  "Entry Points",
  "Key Design Decisions",
  "What to de-emphasize",
];

export function validateContextSections(content: string): ValidationResult[] {
  return REQUIRED_SECTIONS.map((section) => ({
    section,
    present: content.includes(`## ${section}`),
  }));
}
