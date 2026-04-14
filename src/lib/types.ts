// Workflow data structures returned by the Arclume API

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published" | "disabled";
  version: number;
  tag: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: "llm_call" | "tool_call" | "conditional" | "human_in_loop" | "start" | "end" | "json_transform" | "filter" | "map_reduce" | "regex_extract" | "schema_validate" | "http_request" | "code_eval";
  name: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: string;
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface WorkflowDetail extends Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  inputSchema: SchemaField[];
  outputSchema: SchemaField[];
}

export interface WorkflowRunEvent {
  type: "node_start" | "node_complete" | "node_error" | "run_complete" | "run_error";
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  durationMs?: number;
  tokenUsage?: { input: number; output: number };
  dataSize?: number;
  output?: unknown;
  error?: string;
  traceId?: string;
  traceUrl?: string;
  result?: unknown;
}

export interface WorkflowTraceNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "success" | "error" | "skipped";
  durationMs: number;
  tokenUsage?: { input: number; output: number };
  dataSize?: number;
  error?: string;
}

export interface WorkflowTrace {
  traceId: string;
  traceUrl: string;
  workflowName: string;
  status: "success" | "error";
  totalDurationMs: number;
  nodes: WorkflowTraceNode[];
}

export interface WorkflowExport {
  markdown: string;
  format: string;
}
