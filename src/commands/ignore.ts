import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import { detectStack } from "../lib/detect.js";
import {
  ignoreExists,
  readIgnorePatterns,
  appendPattern,
  suggestPatterns,
  writeIgnoreFile,
} from "../lib/ignore-file.js";
import { ignoreTemplate } from "../lib/scaffold.js";
import fs from "fs/promises";
import path from "path";

export async function runIgnoreSuggest(): Promise<void> {
  console.log(chalk.cyan("\nAnalyzing repo stack...\n"));
  const stack = await detectStack();
  const groups = suggestPatterns(stack.languages);

  console.log(chalk.bold("Suggested ignore patterns:\n"));
  for (const group of groups) {
    console.log(chalk.cyan(`  # ${group.label}`));
    for (const pattern of group.patterns) {
      console.log(`    ${pattern}`);
    }
    console.log("");
  }

  const alreadyExists = await ignoreExists();
  if (alreadyExists) {
    console.log(chalk.yellow("⚠  .arclumeignore already exists. Applying will overwrite it.\n"));
  }

  const apply = await confirm({
    message: "Apply these patterns to .arclumeignore?",
    default: true,
  });

  if (apply) {
    const content = ignoreTemplate(groups);
    const ignorePath = path.join(process.cwd(), ".arclumeignore");
    await fs.writeFile(ignorePath, content, "utf-8");
    console.log(chalk.green("\n✓ .arclumeignore written."));
  } else {
    console.log(chalk.dim("\nNo changes made."));
  }
}

export async function runIgnoreAdd(pattern: string): Promise<void> {
  const exists = await ignoreExists();

  await appendPattern(pattern);

  if (exists) {
    console.log(chalk.green(`✓ Pattern "${pattern}" appended to .arclumeignore`));
  } else {
    console.log(chalk.green(`✓ .arclumeignore created with pattern "${pattern}"`));
  }
}

export async function runIgnoreList(): Promise<void> {
  const exists = await ignoreExists();

  if (!exists) {
    console.log(chalk.yellow(".arclumeignore does not exist. Run `arclume ignore suggest` to create it."));
    return;
  }

  const patterns = await readIgnorePatterns();

  if (patterns.length === 0) {
    console.log(chalk.dim("No active patterns found in .arclumeignore (file may only contain comments)."));
    return;
  }

  console.log(chalk.bold("\nActive ignore patterns:\n"));
  for (const pattern of patterns) {
    console.log(`  ${pattern}`);
  }
  console.log("");
}
