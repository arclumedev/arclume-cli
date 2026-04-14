import { readConfig } from "./config.js";
import { getToken, readCredentials } from "./credentials.js";
import type {
  Workflow,
  WorkflowDetail,
  WorkflowExport,
  WorkflowRunEvent,
} from "./types.js";

const API_BASE = "https://arclume.dev/api/v1";

async function getOrgId(): Promise<string | undefined> {
  // Prefer org from .arclume/config.json (repo-scoped), fall back to credentials
  const config = await readConfig();
  const configOrgId = (config as Record<string, unknown> | null)?.orgId as string | undefined;
  if (configOrgId) return configOrgId;

  const creds = await readCredentials();
  return creds?.orgId;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  stream?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getToken();
  const orgId = await getOrgId();

  const url = new URL(path, API_BASE);
  if (orgId) url.searchParams.set("orgId", orgId);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "arclume-cli/0.1.0",
  };

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error("Session expired. Run `arclume login` to re-authenticate.");
    }
    if (response.status === 404) {
      throw new Error(`Not found: ${path}`);
    }
    throw new Error(`API error (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function listWorkflows(options?: { published?: boolean }): Promise<Workflow[]> {
  const path = options?.published ? "/workflows?status=published" : "/workflows";
  return request<Workflow[]>(path);
}

export async function getWorkflow(nameOrId: string): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`/workflows/${encodeURIComponent(nameOrId)}`);
}

export async function* runWorkflow(
  nameOrId: string,
  params: Record<string, unknown>
): AsyncGenerator<WorkflowRunEvent> {
  const token = await getToken();
  const orgId = await getOrgId();

  const url = new URL(`/workflows/${encodeURIComponent(nameOrId)}/execute`, API_BASE);
  if (orgId) url.searchParams.set("orgId", orgId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "User-Agent": "arclume-cli/0.1.0",
    },
    body: JSON.stringify({ input: params }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error("Session expired. Run `arclume login` to re-authenticate.");
    }
    if (response.status === 404) {
      throw new Error(`Workflow not found: ${nameOrId}`);
    }
    if (response.status === 422) {
      throw new Error(`Invalid input: ${text}`);
    }
    throw new Error(`API error (${response.status}): ${text || response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body received from execution endpoint.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data && data !== "[DONE]") {
          yield JSON.parse(data) as WorkflowRunEvent;
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.startsWith("data: ")) {
    const data = buffer.slice(6).trim();
    if (data && data !== "[DONE]") {
      yield JSON.parse(data) as WorkflowRunEvent;
    }
  }
}

export async function exportWorkflow(
  nameOrId: string,
  format: string = "markdown"
): Promise<WorkflowExport> {
  return request<WorkflowExport>(
    `/workflows/${encodeURIComponent(nameOrId)}/export?format=${format}`
  );
}
