import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { configExists, readConfig } from "../lib/config.js";
import { contextExists, readContext, validateContextSections } from "../lib/context-file.js";

const execAsync = promisify(exec);

export async function runContextGenerate(options: { specDelta: boolean }): Promise<void> {
  const arclumeDir = await configExists();
  if (!arclumeDir) {
    console.error(
      chalk.red("✗ This repository is not initialized. Run `arclume init` first.")
    );
    process.exit(1);
  }

  console.log(chalk.yellow("\n⚠  arclume context generate requires the repo to be indexed via the Arclume API.\n"));
  console.log("  This command uses Arclume's graph understanding to auto-draft context.md.");
  console.log("  To use it, first connect and index your repo at " + chalk.bold("https://arclume.ai") + ".\n");

  if (options.specDelta) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").split("Z")[0];
    const deltaPath = `openspec/changes/auto-${timestamp}/`;
    console.log(chalk.cyan("With --spec-delta, the following would be generated after indexing:"));
    console.log(`  ${chalk.bold(deltaPath)}`);
    console.log(`    proposal.md   — plain-English summary of what changed since last index`);
    console.log(`    spec-delta.md — spec sections marked ADDED / MODIFIED / REMOVED\n`);
  }

  console.log(chalk.dim("Not yet available offline. Index your repo first, then run this command."));
  process.exit(1);
}

export async function runContextValidate(): Promise<void> {
  let allPassed = true;

  console.log(chalk.bold("\nValidating Arclume configuration...\n"));

  // Check config.json exists
  const cfgExists = await configExists();
  if (!cfgExists) {
    console.log(chalk.red("✗") + "  .arclume/config.json — not found");
    allPassed = false;
  } else {
    console.log(chalk.green("✓") + "  .arclume/config.json — found");

    const config = await readConfig();
    if (!config) {
      console.log(chalk.red("✗") + "  config.json is not valid JSON");
      allPassed = false;
    } else {
      // Check required fields
      const requiredFields: Array<keyof typeof config> = ["version", "language", "entryPoints"];
      for (const field of requiredFields) {
        if (
          config[field] === undefined ||
          config[field] === null ||
          (Array.isArray(config[field]) && (config[field] as unknown[]).length === 0 && field === "entryPoints")
        ) {
          if (field === "entryPoints" && (config[field] as string[]).length === 0) {
            console.log(chalk.yellow("⚠") + `  config.json: entryPoints is empty — call graph traversal has no starting nodes`);
          } else if (config[field] === undefined || config[field] === null) {
            console.log(chalk.red("✗") + `  config.json: missing required field "${field}"`);
            allPassed = false;
          } else {
            console.log(chalk.green("✓") + `  config.json: "${field}" — present`);
          }
        } else {
          console.log(chalk.green("✓") + `  config.json: "${field}" — present`);
        }
      }
    }
  }

  // Check context.md exists
  const ctxExists = await contextExists();
  if (!ctxExists) {
    console.log(chalk.red("✗") + "  .arclume/context.md — not found");
    allPassed = false;
  } else {
    console.log(chalk.green("✓") + "  .arclume/context.md — found");

    const content = await readContext();
    if (content) {
      const sectionResults = validateContextSections(content);
      for (const result of sectionResults) {
        if (result.present) {
          console.log(chalk.green("✓") + `  context.md: section "## ${result.section}" — present`);
        } else {
          console.log(chalk.red("✗") + `  context.md: section "## ${result.section}" — missing`);
          allPassed = false;
        }
      }
    }
  }

  console.log("");
  if (allPassed) {
    console.log(chalk.green("All checks passed."));
  } else {
    console.log(chalk.red("Some checks failed. Review the issues above."));
    process.exit(1);
  }
}

export async function runContextDiff(): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(
      "git diff HEAD -- .arclume/context.md .arclume/config.json",
      { cwd: process.cwd() }
    );

    if (stderr) {
      console.error(chalk.red("Git error: " + stderr));
      process.exit(1);
    }

    if (!stdout.trim()) {
      console.log(chalk.dim("No changes in .arclume/context.md or .arclume/config.json since last commit."));
    } else {
      console.log(stdout);
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { code?: number };
    if (error.message?.includes("not a git repository")) {
      console.log(chalk.yellow("This directory is not a git repository."));
    } else {
      console.error(chalk.red("Failed to run git diff: " + error.message));
      process.exit(1);
    }
  }
}
