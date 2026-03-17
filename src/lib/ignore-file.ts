import fs from "fs/promises";
import path from "path";

function ignorePath(): string {
  return path.join(process.cwd(), ".arclumeignore");
}

export async function ignoreExists(): Promise<boolean> {
  try {
    await fs.access(ignorePath());
    return true;
  } catch {
    return false;
  }
}

export async function readIgnorePatterns(): Promise<string[]> {
  try {
    const raw = await fs.readFile(ignorePath(), "utf-8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

export async function writeIgnoreFile(patterns: string[]): Promise<void> {
  const content = patterns.join("\n") + "\n";
  await fs.writeFile(ignorePath(), content, "utf-8");
}

export async function appendPattern(pattern: string): Promise<void> {
  const exists = await ignoreExists();
  if (exists) {
    const current = await fs.readFile(ignorePath(), "utf-8");
    const newContent = current.endsWith("\n")
      ? current + pattern + "\n"
      : current + "\n" + pattern + "\n";
    await fs.writeFile(ignorePath(), newContent, "utf-8");
  } else {
    await fs.writeFile(ignorePath(), pattern + "\n", "utf-8");
  }
}

export interface PatternGroup {
  label: string;
  patterns: string[];
}

export function suggestPatterns(languages: string[]): PatternGroup[] {
  const groups: PatternGroup[] = [];

  // Always included
  const always: string[] = [
    "node_modules/",
    "dist/",
    "build/",
    ".env*",
    "coverage/",
    ".DS_Store",
  ];
  groups.push({ label: "Always", patterns: always });

  for (const lang of languages) {
    switch (lang) {
      case "typescript":
        groups.push({
          label: "TypeScript",
          patterns: ["*.tsbuildinfo", "*.generated.ts", ".next/", "out/"],
        });
        break;
      case "python":
        groups.push({
          label: "Python",
          patterns: ["__pycache__/", "*.pyc", ".venv/", "*.egg-info/"],
        });
        break;
      case "go":
        groups.push({ label: "Go", patterns: ["vendor/"] });
        break;
      case "rust":
        groups.push({ label: "Rust", patterns: ["target/"] });
        break;
    }
  }

  // Always add general noise patterns
  groups.push({
    label: "General",
    patterns: [
      "**/__fixtures__/",
      "**/testdata/",
      "db/migrations/",
      "logs/",
      "*.log",
    ],
  });

  return groups;
}
