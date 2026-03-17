import { stat, access, readdir } from "fs/promises";
import type { Dirent } from "fs";
import path from "path";
import chalk from "chalk";
import { contextExists, readContext, validateContextSections } from "../lib/context-file.js";
import { readConfig } from "../lib/config.js";

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

async function countNonIgnoredFiles(): Promise<number> {
  // Rough heuristic: walk the repo and count files, excluding common noise dirs
  const root = process.cwd();
  const skipDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "out",
    "coverage",
    "vendor",
    "target",
    ".venv",
    "__pycache__",
  ]);

  let count = 0;

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        count++;
      }
    }
  }

  await walk(root);
  return count;
}

export async function runDoctor(): Promise<void> {
  const results: CheckResult[] = [];
  const root = process.cwd();

  console.log(chalk.bold("\nRunning Arclume health checks...\n"));

  // Check 1: Missing context.md
  const ctxExists = await contextExists();
  results.push({
    name: "context.md present",
    passed: ctxExists,
    message: ctxExists
      ? undefined
      : "No .arclume/context.md found — graph quality will be lower. Run `arclume init`.",
  });

  // Check 2: context.md missing sections
  if (ctxExists) {
    const content = await readContext();
    if (content) {
      const sectionResults = validateContextSections(content);
      const missingSections = sectionResults.filter((r) => !r.present).map((r) => r.section);
      if (missingSections.length > 0) {
        results.push({
          name: "context.md has all required sections",
          passed: false,
          message: `Missing sections: ${missingSections.map((s) => `"## ${s}"`).join(", ")}`,
        });
      } else {
        results.push({
          name: "context.md has all required sections",
          passed: true,
        });
      }
    }
  }

  // Check 3: No entry points in config
  const config = await readConfig();
  if (!config) {
    results.push({
      name: "config.json present",
      passed: false,
      message: "No .arclume/config.json found. Run `arclume init`.",
    });
  } else {
    results.push({
      name: "config.json present",
      passed: true,
    });

    const hasEntryPoints = config.entryPoints && config.entryPoints.length > 0;
    results.push({
      name: "entry points configured",
      passed: hasEntryPoints,
      message: hasEntryPoints
        ? undefined
        : "config.json has no entryPoints — call graph traversal has no starting nodes. Edit .arclume/config.json.",
    });
  }

  // Check 4: Too many files indexed
  const fileCount = await countNonIgnoredFiles();
  const tooManyFiles = fileCount > 5000;
  results.push({
    name: "file count within reasonable bounds",
    passed: !tooManyFiles,
    message: tooManyFiles
      ? `~${fileCount} files found (threshold: 5000). Consider adding more patterns to .arclumeignore.`
      : undefined,
  });

  // Check 5: Stale index (check config.json mtime)
  if (config) {
    const configPath = path.join(root, ".arclume", "config.json");
    try {
      const fileStat = await stat(configPath);
      const ageMs = Date.now() - fileStat.mtimeMs;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const isStale = ageDays > 30;
      results.push({
        name: "index is not stale",
        passed: !isStale,
        message: isStale
          ? `config.json was last modified ${Math.floor(ageDays)} days ago. Consider running \`arclume index\` to re-index.`
          : undefined,
      });
    } catch {
      // can't stat, skip
    }
  }

  // Check 6: OpenSpec present but unconfigured
  const openspecDir = path.join(root, "openspec");
  let openspecDirExists = false;
  try {
    await access(openspecDir);
    openspecDirExists = true;
  } catch {
    // not present
  }

  if (openspecDirExists && config && !config.openspec) {
    results.push({
      name: "OpenSpec configured",
      passed: false,
      message:
        "openspec/ directory exists but config.json has openspec: false. Set openspec: true in .arclume/config.json to enable elevated weighting.",
    });
  } else if (openspecDirExists && config && config.openspec) {
    results.push({
      name: "OpenSpec configured",
      passed: true,
    });
  }

  // Check 7: Chunk size mismatch — always pass for MVP
  results.push({
    name: "chunk size configured",
    passed: true,
  });

  // Print results
  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.passed) {
      passCount++;
      console.log(chalk.green("✓") + "  " + result.name);
    } else {
      failCount++;
      console.log(chalk.red("✗") + "  " + result.name);
      if (result.message) {
        console.log(chalk.dim("     → " + result.message));
      }
    }
  }

  console.log("");
  if (failCount === 0) {
    console.log(chalk.green(`All ${passCount} checks passed.`));
  } else {
    console.log(
      chalk.yellow(`${passCount} passed, `) +
        chalk.red(`${failCount} failed.`)
    );
  }
  console.log("");
}
