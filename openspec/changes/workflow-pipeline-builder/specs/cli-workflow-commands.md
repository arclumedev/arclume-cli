# CLI Workflow Commands — Spec

## Purpose

Provide CLI commands for listing, inspecting, running, and exporting Arclume workflow pipelines from the terminal.

## Requirements

### R1: Workflow Listing

The CLI SHALL provide `arclume workflow list` that displays all workflows with name, status, task tag, and last run timestamp.

The CLI SHALL support `--published` to filter to MCP-published workflows only.

The CLI SHALL support `--json` to output raw JSON.

### R2: Workflow Description

The CLI SHALL provide `arclume workflow describe <name>` that displays the full workflow configuration including node graph summary, input schema, output schema, and version.

### R3: Workflow Execution

The CLI SHALL provide `arclume workflow run <name>` that executes a workflow.

The CLI SHALL support `--param key=value` (repeatable) to pass input parameters.

The CLI SHALL stream per-node progress indicators to stderr during execution.

The CLI SHALL support `--json` to output structured JSON result to stdout.

The CLI SHALL support `--trace` to print execution trace with per-node timing and token usage.

The CLI SHALL exit with code 0 on success, 1 on workflow error, 2 on invalid input.

### R4: Workflow Export

The CLI SHALL provide `arclume workflow export <name>` that exports the workflow definition.

The CLI SHALL support `--format markdown` (default) for human-readable markdown export.

The CLI SHALL support `--output <path>` to write to a file instead of stdout.

### R5: Authentication

All workflow commands SHALL use the existing `arclume login` token for API authentication.

All workflow commands SHALL read `ARCLUME_TOKEN` from the environment as a fallback.

## Scenarios

### List workflows
Given the user is authenticated
When they run `arclume workflow list`
Then they see a table of workflows with name, status, tag, and last run

### Run a workflow with parameters
Given the user is authenticated and a workflow "code-review" exists
When they run `arclume workflow run code-review --param repo=myapp --param pr=42`
Then the CLI streams node progress to stderr and outputs the result to stdout

### Export as markdown
Given a workflow "code-review" exists
When they run `arclume workflow export code-review --output review.md`
Then the workflow definition is written to review.md in markdown format
