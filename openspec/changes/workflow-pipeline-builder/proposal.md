# Workflow Pipeline Builder — CLI Commands

## Summary

Add `arclume workflow` CLI commands that let developers list, inspect, run, and export LangGraph-based workflow pipelines directly from the terminal. This is the power-user and CI/CD interface — developers can trigger pipelines from GitHub Actions, shell scripts, or their local terminal without needing the web UI or an MCP client.

## Motivation

Arclume's workflow pipeline builder enables users to visually design LangGraph agent graphs and publish them as MCP tools. However, not all invocations happen through MCP clients — CI/CD pipelines, local scripting, and power users need a CLI-native interface. The CLI commands bridge this gap.

## Scope

This change covers the CLI surface only:

- `arclume workflow list` — list workflows with status, tags, and last run
- `arclume workflow describe <name>` — inspect a workflow's node graph, schemas, and version
- `arclume workflow run <name>` — execute a workflow with typed parameters and streaming output
- `arclume workflow export <name>` — export workflow definition as markdown

Out of scope: the visual graph editor, transpiler, execution engine, and MCP tool registration (covered by separate stories).

## Dependencies

- Arclume API endpoints for workflow CRUD and execution (server-side)
- Existing `arclume login` authentication flow for API access
