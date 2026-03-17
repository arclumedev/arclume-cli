#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "./commands/init.js";
import { runContextGenerate, runContextValidate, runContextDiff } from "./commands/context.js";
import { runIgnoreSuggest, runIgnoreAdd, runIgnoreList } from "./commands/ignore.js";
import { runIndex, runIndexStatus } from "./commands/index.js";
import { runDoctor } from "./commands/doctor.js";

const program = new Command();

program
  .name("arclume")
  .version("0.1.0")
  .description("Configure any repository for optimal Arclume indexing");

// arclume init
program
  .command("init")
  .description("Initialize a repository for Arclume indexing")
  .option("--dry-run", "Print what would be generated without writing any files")
  .action(async (options: { dryRun?: boolean }) => {
    try {
      await runInit({ dryRun: options.dryRun ?? false });
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

// arclume context
const contextCmd = new Command("context").description("Manage .arclume/context.md");

contextCmd
  .command("generate")
  .description("Auto-draft context.md using the Arclume index (requires indexed repo)")
  .option("--spec-delta", "Also generate a candidate OpenSpec delta spec")
  .action(async (options: { specDelta?: boolean }) => {
    try {
      await runContextGenerate({ specDelta: options.specDelta ?? false });
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

contextCmd
  .command("validate")
  .description("Check that context.md and config.json are well-formed and complete")
  .action(async () => {
    try {
      await runContextValidate();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

contextCmd
  .command("diff")
  .description("Show changes in context files since the last commit")
  .action(async () => {
    try {
      await runContextDiff();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.addCommand(contextCmd);

// arclume ignore
const ignoreCmd = new Command("ignore").description("Manage .arclumeignore");

ignoreCmd
  .command("suggest")
  .description("Analyze the repo and recommend ignore patterns")
  .action(async () => {
    try {
      await runIgnoreSuggest();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

ignoreCmd
  .command("add <pattern>")
  .description("Add a pattern to .arclumeignore")
  .action(async (pattern: string) => {
    try {
      await runIgnoreAdd(pattern);
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

ignoreCmd
  .command("list")
  .description("Print all active ignore patterns")
  .action(async () => {
    try {
      await runIgnoreList();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.addCommand(ignoreCmd);

// arclume index
const indexCmd = new Command("index").description("Trigger indexing via the Arclume API");

indexCmd
  .option("--watch", "Watch for file changes and trigger incremental re-index on save")
  .action(async (options: { watch?: boolean }) => {
    try {
      await runIndex({ watch: options.watch ?? false });
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

indexCmd
  .command("status")
  .description("Show the current index status for the repo")
  .action(async () => {
    try {
      await runIndexStatus();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.addCommand(indexCmd);

// arclume doctor
program
  .command("doctor")
  .description("Diagnose common indexing health issues")
  .action(async () => {
    try {
      await runDoctor();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.parse(process.argv);
