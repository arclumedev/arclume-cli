import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import chalk from "chalk";
import {
  readCredentials,
  writeCredentials,
  clearCredentials,
  getToken,
} from "../lib/credentials.js";

const AUTH_HOST = "app.arclume.dev";
const CALLBACK_PORT = 9876;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${url}"`, (err) => {
    if (err) {
      console.log(chalk.yellow("\nCould not open browser automatically."));
      console.log("Open this URL manually:\n");
      console.log(chalk.bold(`  ${url}\n`));
    }
  });
}

export async function runAuthLogin(): Promise<void> {
  const state = crypto.randomBytes(32).toString("hex");

  console.log(chalk.cyan("\nOpening browser to authenticate...\n"));

  const result = await new Promise<{
    token: string;
    email?: string;
    orgName?: string;
    orgId?: string;
    expiresAt?: string;
  }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const returnedState = url.searchParams.get("state");
      const token = url.searchParams.get("token");
      const email = url.searchParams.get("email") ?? undefined;
      const orgName = url.searchParams.get("org_name") ?? undefined;
      const orgId = url.searchParams.get("org_id") ?? undefined;
      const expiresAt = url.searchParams.get("expires_at") ?? undefined;

      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Authentication failed</h1><p>State mismatch — possible CSRF. Try again.</p>");
        reject(new Error("State mismatch on callback — possible CSRF. Try again."));
        server.close();
        return;
      }

      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Authentication failed</h1><p>No token received.</p>");
        reject(new Error("No token received in callback."));
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<h1>Authenticated!</h1><p>You can close this tab and return to the terminal.</p>" +
          "<script>setTimeout(() => window.close(), 1500)</script>"
      );

      resolve({ token, email, orgName, orgId, expiresAt });
      server.close();
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      const authUrl =
        `https://${AUTH_HOST}/auth/cli?state=${state}&redirect=http://localhost:${CALLBACK_PORT}/callback`;
      openBrowser(authUrl);
      console.log(chalk.dim("Waiting for authentication...\n"));
      console.log(chalk.dim("If the browser didn't open, visit:"));
      console.log(chalk.dim(`  ${authUrl}\n`));
    });

    server.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${CALLBACK_PORT} is in use. Close the other process and try again.`
          )
        );
      } else {
        reject(err);
      }
    });

    // Timeout
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 5 minutes. Run `arclume auth login` to try again."));
    }, TIMEOUT_MS);
  });

  await writeCredentials({
    token: result.token,
    email: result.email,
    orgName: result.orgName,
    orgId: result.orgId,
    expiresAt: result.expiresAt,
  });

  const identity = result.email ?? "authenticated";
  const org = result.orgName ? ` (${result.orgName})` : "";
  console.log(chalk.green(`✓ Logged in as ${identity}${org}`));
  console.log("");
}

export async function runAuthLogout(): Promise<void> {
  const creds = await readCredentials();
  if (!creds?.token) {
    console.log(chalk.dim("Not currently logged in."));
    return;
  }

  // Attempt server-side revocation (best effort)
  try {
    await fetch(`https://arclume.dev/api/v1/auth/revoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    // Server unreachable — still clear local creds
  }

  await clearCredentials();
  console.log(chalk.green("✓ Logged out"));
}

export async function runAuthStatus(): Promise<void> {
  // Check env var
  const envToken = process.env.ARCLUME_TOKEN;
  if (envToken) {
    console.log("");
    console.log(chalk.green("✓ Authenticated") + chalk.dim(" (via ARCLUME_TOKEN env var)"));
    console.log(chalk.dim(`  Token: ••••••••${envToken.slice(-4)}`));
    console.log("");
    return;
  }

  const creds = await readCredentials();
  if (!creds?.token) {
    console.log("");
    console.log(chalk.red("✗ Not authenticated"));
    console.log(chalk.dim("  Run `arclume auth login` to authenticate."));
    console.log("");
    process.exit(1);
  }

  // Check expiry
  const expired = creds.expiresAt && new Date(creds.expiresAt) < new Date();

  console.log("");
  if (expired) {
    console.log(chalk.yellow("⚠ Session expired"));
    console.log(chalk.dim("  Run `arclume auth login` to re-authenticate."));
  } else {
    console.log(chalk.green("✓ Authenticated"));
  }

  if (creds.email) {
    console.log(`  User:         ${creds.email}`);
  }
  if (creds.orgName && creds.orgId) {
    console.log(`  Organisation: ${creds.orgName} (${creds.orgId})`);
  }
  console.log(`  Token:        ••••••••${creds.token.slice(-4)}`);

  if (creds.expiresAt && !expired) {
    const days = Math.ceil(
      (new Date(creds.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    console.log(`  Expires:      in ${days} day${days === 1 ? "" : "s"}`);
  }

  // Verify token is still valid with a lightweight API call
  try {
    const res = await fetch("https://arclume.dev/api/v1/auth/profile", {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (res.status === 401) {
      console.log(chalk.yellow("\n  ⚠ Token is no longer valid. Run `arclume auth login`."));
    }
  } catch {
    console.log(chalk.dim("\n  Could not reach API to verify token."));
  }

  console.log("");
  if (expired) process.exit(1);
}
