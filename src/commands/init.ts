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
  manifestTemplate,
} from "../lib/scaffold.js";
import {
  writePlanned,
  planLume,
  planMeta,
  planTickets,
  planOpenapi,
  planWorkflows,
  type FileResult,
  type PlannedFile,
} from "../lib/harness-scaffold.js";
import type { TicketsProvider } from "../lib/manifest.js";

export type Template = "default" | "minimal" | "api-only";

export interface InitOptions {
  dryRun: boolean;
  provider?: TicketsProvider;
  template?: Template;
}

const VALID_PROVIDERS: TicketsProvider[] = ["linear", "jira", "github"];
const VALID_TEMPLATES: Template[] = ["default", "minimal", "api-only"];

function resolveProvider(input: string | undefined): TicketsProvider {
  if (!input) return "linear";
  if (!VALID_PROVIDERS.includes(input as TicketsProvider)) {
    throw new Error(
      `Invalid --provider "${input}". Expected one of: ${VALID_PROVIDERS.join(", ")}.`
    );
  }
  return input as TicketsProvider;
}

function resolveTemplate(input: string | undefined): Template {
  if (!input) return "default";
  if (!VALID_TEMPLATES.includes(input as Template)) {
    throw new Error(
      `Invalid --template "${input}". Expected one of: ${VALID_TEMPLATES.join(", ")}.`
    );
  }
  return input as Template;
}

function planHarness(
  template: Template,
  provider: TicketsProvider,
  name: string
): { planned: PlannedFile[]; includes: HarnessIncludes } {
  const includes: HarnessIncludes = {
    lume: false,
    meta: false,
    tickets: false,
    openapi: false,
    workflows: false,
  };
  const planned: PlannedFile[] = [];

  if (template === "default") {
    includes.lume = true;
    includes.meta = true;
    includes.tickets = true;
    includes.openapi = true;
    includes.workflows = true;
  } else if (template === "minimal") {
    includes.lume = true;
    includes.meta = true;
  } else if (template === "api-only") {
    includes.openapi = true;
  }

  if (includes.lume) planned.push(...planLume());
  if (includes.meta) planned.push(...planMeta());
  if (includes.tickets) planned.push(...planTickets(provider));
  if (includes.openapi) planned.push(...planOpenapi(name));
  if (includes.workflows) planned.push(...planWorkflows());

  return { planned, includes };
}

interface HarnessIncludes {
  lume: boolean;
  meta: boolean;
  tickets: boolean;
  openapi: boolean;
  workflows: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
  const root = process.cwd();
  const arclumeDir = path.join(root, ".arclume");
  const provider = resolveProvider(options.provider);
  const template = resolveTemplate(options.template);

  // Check if already initialized
  try {
    await fs.access(arclumeDir);
    console.log(
      chalk.yellow("⚠  .arclume/ already exists. Existing files will be preserved; only missing files will be created.")
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

  // Harness manifest + subsystems
  const manifestName = path.basename(root);
  const { planned: harnessPlanned, includes } = planHarness(template, provider, manifestName);

  const manifestContent = manifestTemplate({
    name: manifestName,
    provider,
    includeLume: includes.lume,
    includeMeta: includes.meta,
    includeTickets: includes.tickets,
    includeOpenapi: includes.openapi,
    includeWorkflows: includes.workflows,
  });

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
    console.log(chalk.bold("\narclume.yaml:"));
    console.log(manifestContent);
    for (const pf of harnessPlanned) {
      console.log(chalk.bold(`\n${pf.relPath}:`));
      console.log(pf.content || chalk.dim("(empty file)"));
    }
    console.log(chalk.yellow("\nDry run complete. No files were written."));
    return;
  }

  // Write files
  const generated: FileResult[] = [];

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
    await writeIgnoreFile(ignoreContent.split("\n").slice(0, -1));
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

  // arclume.yaml (idempotent)
  const manifestResults = await writePlanned(
    root,
    [{ relPath: "arclume.yaml", content: manifestContent }],
    { dryRun: false }
  );
  generated.push(...manifestResults);

  // Harness subsystems
  const harnessResults = await writePlanned(root, harnessPlanned, { dryRun: false });
  generated.push(...harnessResults);

  // Summary
  console.log(chalk.green("\n✓ Initialization complete!\n"));
  console.log(chalk.dim(`  Template: ${template}   Provider: ${provider}\n`));
  console.log(chalk.bold("Generated files:"));
  for (const { file, status } of generated) {
    const icon = status.startsWith("created") ? chalk.green("  ✓") : chalk.yellow("  –");
    console.log(`${icon}  ${file}  ${chalk.dim(status)}`);
  }

  console.log(chalk.cyan("\nNext steps:"));
  console.log("  1. Review and edit " + chalk.bold(".arclume/context.md"));
  console.log("  2. Tune the harness manifest in " + chalk.bold("arclume.yaml"));
  if (includes.lume) {
    console.log("  3. Define entities in " + chalk.bold(".arclume/lume/schema.yaml"));
  }
  console.log("  • Run " + chalk.bold("arclume index") + " to trigger indexing");
  console.log("  • Run " + chalk.bold("arclume doctor") + " to check indexing health");
  console.log("  • Commit .arclume/, arclume.yaml, and .arclumeignore to version control\n");
}
