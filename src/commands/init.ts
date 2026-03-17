import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { input, confirm } from "@inquirer/prompts";
import { detectStack } from "../lib/detect.js";
import { writeConfig } from "../lib/config.js";
import { writeContext } from "../lib/context-file.js";
import { ignoreExists, suggestPatterns, writeIgnoreFile } from "../lib/ignore-file.js";
import {
  configTemplate,
  contextTemplate,
  ignoreTemplate,
  openspecOverviewTemplate,
} from "../lib/scaffold.js";

export async function runInit(options: { dryRun: boolean }): Promise<void> {
  const root = process.cwd();
  const arclumeDir = path.join(root, ".arclume");

  // Check if already initialized
  try {
    await fs.access(arclumeDir);
    console.log(
      chalk.yellow("⚠  .arclume/ already exists. Re-initializing will overwrite existing config.")
    );
  } catch {
    // not yet initialized, that's fine
  }

  // Detect stack
  console.log(chalk.cyan("\nDetecting stack..."));
  const stack = await detectStack();

  if (stack.languages.length > 0) {
    console.log(chalk.green(`  Languages:   ${stack.languages.join(", ")}`));
  } else {
    console.log(chalk.yellow("  Languages:   (none detected)"));
  }

  if (stack.frameworks.length > 0) {
    console.log(chalk.green(`  Frameworks:  ${stack.frameworks.join(", ")}`));
  } else {
    console.log(chalk.dim("  Frameworks:  (none detected)"));
  }

  if (stack.entryPoints.length > 0) {
    console.log(chalk.green(`  Entry points: ${stack.entryPoints.join(", ")}`));
  } else {
    console.log(chalk.dim("  Entry points: (none inferred)"));
  }

  // Prepare ignore patterns
  const patternGroups = suggestPatterns(stack.languages);

  // Prompt user
  console.log(chalk.cyan("\nAnswer a few questions to configure your repo:\n"));

  const description = await input({
    message: "Repo description (what does this codebase do?):",
    default: "",
  });

  const decisions = await input({
    message: "Key architectural decisions (optional):",
    default: "",
  });

  const teamContext = await input({
    message: "Team context (optional, e.g. team size, workflow notes):",
    default: "",
  });

  // Confirm entry points
  const entryPointsDefault = stack.entryPoints.join(", ");
  const confirmEntryPoints = await confirm({
    message: `Use detected entry points (${entryPointsDefault || "none"})?`,
    default: true,
  });

  let finalEntryPoints = stack.entryPoints;
  if (!confirmEntryPoints) {
    const overrideInput = await input({
      message: "Enter entry points (comma-separated):",
      default: entryPointsDefault,
    });
    finalEntryPoints = overrideInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Build config and content
  const config = configTemplate({
    languages: stack.languages,
    frameworks: stack.frameworks,
    entryPoints: finalEntryPoints,
  });

  const contextContent = contextTemplate({
    description,
    architecture: teamContext ? `[${teamContext}]` : "",
    entryPoints: finalEntryPoints,
    decisions,
    deemphasize: "",
  });

  const ignoreContent = ignoreTemplate(patternGroups);
  const overviewContent = openspecOverviewTemplate();

  if (options.dryRun) {
    console.log(chalk.cyan("\n--- DRY RUN: Files that would be generated ---\n"));
    console.log(chalk.bold(".arclume/config.json:"));
    console.log(JSON.stringify(config, null, 2));
    console.log(chalk.bold("\n.arclume/context.md:"));
    console.log(contextContent);
    console.log(chalk.bold("\n.arclumeignore:"));
    console.log(ignoreContent);
    console.log(chalk.bold("\nopenspec/specs/OVERVIEW.md:"));
    console.log(overviewContent);
    console.log(chalk.yellow("\nDry run complete. No files were written."));
    return;
  }

  // Write files
  const generated: Array<{ file: string; status: string }> = [];

  // .arclume/config.json
  await writeConfig(config);
  generated.push({ file: ".arclume/config.json", status: "created" });

  // .arclume/context.md
  await writeContext(contextContent);
  generated.push({ file: ".arclume/context.md", status: "created" });

  // .arclumeignore (skip if exists)
  const ignoreAlreadyExists = await ignoreExists();
  if (ignoreAlreadyExists) {
    generated.push({ file: ".arclumeignore", status: "skipped (already exists)" });
  } else {
    await writeIgnoreFile(ignoreContent.split("\n").slice(0, -1)); // remove trailing empty
    // Actually write the full formatted content
    const ignorePath = path.join(root, ".arclumeignore");
    await fs.writeFile(ignorePath, ignoreContent, "utf-8");
    generated.push({ file: ".arclumeignore", status: "created" });
  }

  // openspec/specs/OVERVIEW.md (if openspec not present)
  const openspecDir = path.join(root, "openspec", "specs");
  let openspecExists = false;
  try {
    await fs.access(openspecDir);
    openspecExists = true;
  } catch {
    // not present
  }

  if (openspecExists) {
    generated.push({ file: "openspec/specs/OVERVIEW.md", status: "skipped (openspec already present)" });
  } else {
    await fs.mkdir(openspecDir, { recursive: true });
    await fs.writeFile(path.join(openspecDir, "OVERVIEW.md"), overviewContent, "utf-8");
    generated.push({ file: "openspec/specs/OVERVIEW.md", status: "created" });
  }

  // Summary
  console.log(chalk.green("\n✓ Initialization complete!\n"));
  console.log(chalk.bold("Generated files:"));
  for (const { file, status } of generated) {
    const icon = status.startsWith("created") ? chalk.green("  ✓") : chalk.yellow("  –");
    console.log(`${icon}  ${file}  ${chalk.dim(status)}`);
  }

  console.log(chalk.cyan("\nNext steps:"));
  console.log("  1. Review and edit " + chalk.bold(".arclume/context.md"));
  console.log("  2. Run " + chalk.bold("arclume index") + " to trigger indexing");
  console.log("  3. Run " + chalk.bold("arclume doctor") + " to check indexing health");
  console.log("  4. Commit .arclume/ and .arclumeignore to version control\n");
}
