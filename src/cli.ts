#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "./commands/init.js";
import { runContextGenerate, runContextValidate, runContextDiff } from "./commands/context.js";
import { runIgnoreSuggest, runIgnoreAdd, runIgnoreList } from "./commands/ignore.js";
import { runIndex, runIndexStatus } from "./commands/index.js";
import { runDoctor } from "./commands/doctor.js";
import { runAuthLogin, runAuthLogout, runAuthStatus } from "./commands/auth.js";
import {
  runWorkflowList,
  runWorkflowDescribe,
  runWorkflowRun,
  runWorkflowExport,
} from "./commands/workflow.js";

const program = new Command();

program
  .name("arclume")
  .version("0.1.0")
  .description("Configure any repository for optimal Arclume indexing");

// arclume init
program
  .command("init")
  .description("Initialize a repository for Arclume indexing and the Lume harness")
  .option("--dry-run", "Print what would be generated without writing any files")
  .option(
    "--provider <provider>",
    "Tickets provider for the harness (linear|jira|github)",
    "linear"
  )
  .option(
    "--template <template>",
    "Scaffold template (default|minimal|api-only)",
    "default"
  )
  .action(async (options: { dryRun?: boolean; provider?: string; template?: string }) => {
    try {
      await runInit({
        dryRun: options.dryRun ?? false,
        provider: options.provider as ("linear" | "jira" | "github") | undefined,
        template: options.template as ("default" | "minimal" | "api-only") | undefined,
      });
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

// arclume auth
const authCmd = new Command("auth").description("Manage authentication");

authCmd
  .command("login")
  .description("Authenticate via browser")
  .action(async () => {
    try {
      await runAuthLogin();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

authCmd
  .command("logout")
  .description("Revoke session and clear stored credentials")
  .action(async () => {
    try {
      await runAuthLogout();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

authCmd
  .command("status")
  .description("Check current authentication status")
  .action(async () => {
    try {
      await runAuthStatus();
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.addCommand(authCmd);

// arclume workflow
const workflowCmd = new Command("workflow").description(
  "List, inspect, run, and export workflows"
);

workflowCmd
  .command("list")
  .description("List all workflows")
  .option("--published", "Show only MCP-published workflows")
  .option("--json", "Output raw JSON")
  .action(async (options: { published?: boolean; json?: boolean }) => {
    try {
      await runWorkflowList({ published: options.published, json: options.json });
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

workflowCmd
  .command("describe <name>")
  .description("Show full workflow configuration and schema")
  .option("--json", "Output raw JSON")
  .action(async (name: string, options: { json?: boolean }) => {
    try {
      await runWorkflowDescribe(name, { json: options.json });
    } catch (err) {
      console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

workflowCmd
  .command("run <name>")
  .description("Execute a workflow with parameters")
  .option("--param <key=value...>", "Input parameters (repeatable)", (val: string, prev: string[]) => {
    prev.push(val);
    return prev;
  }, [] as string[])
  .option("--param-file <path>", "Read input parameters from a JSON file")
  .option("--json", "Output structured JSON result")
  .option("--trace", "Print execution trace with per-node timing")
  .action(
    async (
      name: string,
      options: { param?: string[]; paramFile?: string; json?: boolean; trace?: boolean }
    ) => {
      try {
        await runWorkflowRun(name, options);
      } catch (err) {
        console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
        process.exit(1);
      }
    }
  );

workflowCmd
  .command("export <name>")
  .description("Export a workflow definition")
  .option("--format <format>", "Output format (markdown)", "markdown")
  .option("--output <path>", "Write to file instead of stdout")
  .option("--json", "Output raw JSON")
  .action(
    async (name: string, options: { format?: string; output?: string; json?: boolean }) => {
      try {
        await runWorkflowExport(name, options);
      } catch (err) {
        console.error(chalk.red("Error: " + (err instanceof Error ? err.message : String(err))));
        process.exit(1);
      }
    }
  );

program.addCommand(workflowCmd);

program.parse(process.argv);
