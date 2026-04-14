import fs from "fs/promises";
import path from "path";
import os from "os";

export interface StoredCredentials {
  token: string;
  email?: string;
  orgName?: string;
  orgId?: string;
  expiresAt?: string;
}

function credentialsDir(): string {
  return path.join(os.homedir(), ".config", "arclume");
}

function credentialsPath(): string {
  return path.join(credentialsDir(), "credentials.json");
}

export async function getToken(): Promise<string> {
  // 1. Environment variable (CI/CD)
  const envToken = process.env.ARCLUME_TOKEN;
  if (envToken) return envToken;

  // 2. Credentials file
  const creds = await readCredentials();
  if (creds?.token) {
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
      throw new Error("Session expired. Run `arclume auth login` to re-authenticate.");
    }
    return creds.token;
  }

  throw new Error("Not authenticated. Run `arclume auth login` or set ARCLUME_TOKEN.");
}

export async function readCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await fs.readFile(credentialsPath(), "utf-8");
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function writeCredentials(creds: StoredCredentials): Promise<void> {
  const dir = credentialsDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(credentialsPath(), JSON.stringify(creds, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(credentialsPath());
  } catch {
    // already gone
  }
}
