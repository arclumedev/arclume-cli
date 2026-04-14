import fs from "fs/promises";
import chalk from "chalk";
import {
  listWorkflows,
  getWorkflow,
  runWorkflow,
  exportWorkflow,
} from "../lib/api-client.js";
import type { WorkflowRunEvent, WorkflowTraceNode } from "../lib/types.js";

// -- Helpers --

function formatDate(iso: string | null): string {
  if (!iso) return chalk.dim("never");
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status: string): string {
  switch (status) {
    case "published":
      return chalk.green(status);
    case "draft":
      return chalk.yellow(status);
    case "disabled":
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

function nodeTypeLabel(type: string): string {
  const agentTypes = new Set(["llm_call", "tool_call", "conditional", "human_in_loop", "start", "end"]);
  if (agentTypes.has(type)) return chalk.magenta(type);
  return chalk.blue(type);
}

function padRight(str: string, len: number): string {
  // Strip ANSI for length calc
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
  return str + " ".repeat(Math.max(0, len - stripped.length));
}

function parseParams(paramArgs: string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const p of paramArgs) {
    const eqIdx = p.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid param format: "${p}". Expected key=value.`);
    }
    const key = p.slice(0, eqIdx);
    const val = p.slice(eqIdx + 1);
    // Try to parse as JSON, fall back to string
    try {
      params[key] = JSON.parse(val);
    } catch {
      params[key] = val;
    }
  }
  return params;
}

// -- Commands --

export async function runWorkflowList(options: {
  published?: boolean;
  json?: boolean;
}): Promise<void> {
  const workflows = await listWorkflows({ published: options.published });

  if (options.json) {
    console.log(JSON.stringify(workflows, null, 2));
    return;
  }

  if (workflows.length === 0) {
    console.log(chalk.dim("\nNo workflows found."));
    if (!options.published) {
      console.log(chalk.dim("Create workflows at https://arclume.ai or via the Arclume web editor.\n"));
    } else {
      console.log(chalk.dim("Publish a workflow to make it available via MCP and CLI.\n"));
    }
    return;
  }

  console.log("");

  // Table header
  const nameW = 28;
  const statusW = 12;
  const tagW = 16;
  const runW = 16;
  const verW = 5;

  console.log(
    chalk.bold(
      padRight("NAME", nameW) +
      padRight("STATUS", statusW) +
      padRight("TAG", tagW) +
      padRight("LAST RUN", runW) +
      padRight("VER", verW)
    )
  );

  for (const wf of workflows) {
    console.log(
      padRight(wf.name, nameW) +
      padRight(statusBadge(wf.status), statusW) +
      padRight(wf.tag || chalk.dim("—"), tagW) +
      padRight(formatDate(wf.lastRunAt), runW) +
      padRight(`v${wf.version}`, verW)
    );
  }

  console.log(chalk.dim(`\n${workflows.length} workflow(s)`));
  console.log("");
}

export async function runWorkflowDescribe(
  name: string,
  options: { json?: boolean }
): Promise<void> {
  const wf = await getWorkflow(name);

  if (options.json) {
    console.log(JSON.stringify(wf, null, 2));
    return;
  }

  console.log("");
  console.log(chalk.bold(wf.name) + "  " + statusBadge(wf.status) + "  " + chalk.dim(`v${wf.version}`));
  if (wf.description) {
    console.log(chalk.dim(wf.description));
  }
  console.log("");

  // Node graph summary
  console.log(chalk.bold("Nodes") + chalk.dim(` (${wf.nodes.length})`));
  for (const node of wf.nodes) {
    const typeLabel = nodeTypeLabel(node.type);
    console.log(`  ${typeLabel}  ${node.name}`);
  }
  console.log("");

  // Edges
  if (wf.edges.length > 0) {
    console.log(chalk.bold("Edges") + chalk.dim(` (${wf.edges.length})`));
    const nodeMap = new Map(wf.nodes.map((n) => [n.id, n.name]));
    for (const edge of wf.edges) {
      const src = nodeMap.get(edge.sourceNodeId) ?? edge.sourceNodeId;
      const tgt = nodeMap.get(edge.targetNodeId) ?? edge.targetNodeId;
      const cond = edge.condition ? chalk.dim(` [${edge.condition}]`) : "";
      console.log(`  ${src} ${chalk.dim("→")} ${tgt}${cond}`);
    }
    console.log("");
  }

  // Input schema
  if (wf.inputSchema.length > 0) {
    console.log(chalk.bold("Input Schema"));
    for (const field of wf.inputSchema) {
      const req = field.required ? chalk.red("*") : " ";
      const def = field.default !== undefined ? chalk.dim(` = ${JSON.stringify(field.default)}`) : "";
      const desc = field.description ? chalk.dim(`  ${field.description}`) : "";
      console.log(`  ${req} ${field.name}: ${chalk.cyan(field.type)}${def}${desc}`);
    }
    console.log("");
  }

  // Output schema
  if (wf.outputSchema.length > 0) {
    console.log(chalk.bold("Output Schema"));
    for (const field of wf.outputSchema) {
      const desc = field.description ? chalk.dim(`  ${field.description}`) : "";
      console.log(`    ${field.name}: ${chalk.cyan(field.type)}${desc}`);
    }
    console.log("");
  }

  console.log(chalk.dim(`Created ${formatDate(wf.createdAt)}  |  Updated ${formatDate(wf.updatedAt)}`));
  console.log("");
}

export async function runWorkflowRun(
  name: string,
  options: {
    param?: string[];
    paramFile?: string;
    json?: boolean;
    trace?: boolean;
  }
): Promise<void> {
  // Build params
  let params: Record<string, unknown> = {};

  if (options.paramFile) {
    const raw = await fs.readFile(options.paramFile, "utf-8");
    params = JSON.parse(raw) as Record<string, unknown>;
  }

  if (options.param && options.param.length > 0) {
    Object.assign(params, parseParams(options.param));
  }

  // Also check stdin for piped input
  if (!process.stdin.isTTY && !options.paramFile) {
    const envInput = process.env.ARCLUME_WORKFLOW_INPUT;
    if (envInput) {
      Object.assign(params, JSON.parse(envInput) as Record<string, unknown>);
    }
  }

  const traceNodes: WorkflowTraceNode[] = [];
  let traceId = "";
  let traceUrl = "";
  let result: unknown = null;
  let hadError = false;

  if (!options.json) {
    process.stderr.write(chalk.cyan(`\nExecuting workflow: ${chalk.bold(name)}\n\n`));
  }

  try {
    for await (const event of runWorkflow(name, params)) {
      switch (event.type) {
        case "node_start":
          if (!options.json) {
            process.stderr.write(
              chalk.dim("  ▸ ") + (event.nodeName ?? event.nodeId ?? "?") +
              chalk.dim(` (${event.nodeType})`) + chalk.dim(" ...") + "\n"
            );
          }
          break;

        case "node_complete":
          if (!options.json) {
            const dur = event.durationMs ? chalk.dim(` ${event.durationMs}ms`) : "";
            const tokens = event.tokenUsage
              ? chalk.dim(` [${event.tokenUsage.input}+${event.tokenUsage.output} tokens]`)
              : "";
            process.stderr.write(
              chalk.green("  ✓ ") + (event.nodeName ?? event.nodeId ?? "?") + dur + tokens + "\n"
            );
          }
          if (event.nodeId) {
            traceNodes.push({
              nodeId: event.nodeId,
              nodeName: event.nodeName ?? "",
              nodeType: event.nodeType ?? "",
              status: "success",
              durationMs: event.durationMs ?? 0,
              tokenUsage: event.tokenUsage,
              dataSize: event.dataSize,
            });
          }
          break;

        case "node_error":
          hadError = true;
          if (!options.json) {
            process.stderr.write(
              chalk.red("  ✗ ") + (event.nodeName ?? event.nodeId ?? "?") +
              chalk.red(` — ${event.error ?? "unknown error"}`) + "\n"
            );
          }
          if (event.nodeId) {
            traceNodes.push({
              nodeId: event.nodeId,
              nodeName: event.nodeName ?? "",
              nodeType: event.nodeType ?? "",
              status: "error",
              durationMs: event.durationMs ?? 0,
              error: event.error,
            });
          }
          break;

        case "run_complete":
          traceId = event.traceId ?? "";
          traceUrl = event.traceUrl ?? "";
          result = event.result;
          break;

        case "run_error":
          hadError = true;
          traceId = event.traceId ?? "";
          traceUrl = event.traceUrl ?? "";
          if (!options.json) {
            process.stderr.write(chalk.red(`\n✗ Workflow failed: ${event.error ?? "unknown error"}\n`));
          }
          break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Invalid input") || message.includes("422")) {
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`\n✗ ${message}`));
      }
      process.exit(2);
    }
    throw err;
  }

  // Output result
  if (options.json) {
    const output: Record<string, unknown> = {
      result,
      traceId: traceId || undefined,
      traceUrl: traceUrl || undefined,
      success: !hadError,
    };
    if (options.trace) {
      output.trace = traceNodes;
    }
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (!hadError) {
      process.stderr.write(chalk.green("\n✓ Workflow complete"));
      if (traceId) {
        process.stderr.write(chalk.dim(`  trace: ${traceId}`));
      }
      process.stderr.write("\n\n");
    }

    // Print result to stdout
    if (result !== null && result !== undefined) {
      if (typeof result === "string") {
        console.log(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    }

    // Print trace if requested
    if (options.trace && traceNodes.length > 0) {
      process.stderr.write(chalk.bold("\nExecution Trace\n"));
      let totalMs = 0;
      let totalTokensIn = 0;
      let totalTokensOut = 0;

      for (const node of traceNodes) {
        totalMs += node.durationMs;
        if (node.tokenUsage) {
          totalTokensIn += node.tokenUsage.input;
          totalTokensOut += node.tokenUsage.output;
        }

        const statusIcon = node.status === "success" ? chalk.green("✓") : chalk.red("✗");
        const dur = chalk.dim(`${node.durationMs}ms`);
        const tokens = node.tokenUsage
          ? chalk.dim(` [${node.tokenUsage.input}+${node.tokenUsage.output} tok]`)
          : "";
        const size = node.dataSize ? chalk.dim(` ${node.dataSize}B`) : "";
        const err = node.error ? chalk.red(` — ${node.error}`) : "";
        process.stderr.write(
          `  ${statusIcon} ${padRight(node.nodeName, 24)} ${dur}${tokens}${size}${err}\n`
        );
      }

      process.stderr.write(chalk.dim(`\n  Total: ${totalMs}ms`));
      if (totalTokensIn || totalTokensOut) {
        process.stderr.write(chalk.dim(` | Tokens: ${totalTokensIn} in, ${totalTokensOut} out`));
      }
      process.stderr.write("\n");

      if (traceUrl) {
        process.stderr.write(chalk.dim(`  Full trace: ${traceUrl}\n`));
      }
      process.stderr.write("\n");
    }
  }

  if (hadError) process.exit(1);
}

export async function runWorkflowExport(
  name: string,
  options: { format?: string; output?: string; json?: boolean }
): Promise<void> {
  const format = options.format ?? "markdown";
  const exported = await exportWorkflow(name, format);

  if (options.json) {
    console.log(JSON.stringify(exported, null, 2));
    return;
  }

  if (options.output) {
    await fs.writeFile(options.output, exported.markdown, "utf-8");
    console.log(chalk.green(`✓ Exported to ${options.output}`));
  } else {
    console.log(exported.markdown);
  }
}
