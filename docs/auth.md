# Arclume CLI — Authentication

## Overview

The CLI authenticates via a browser-based OAuth flow. Running `arclume login` opens the Arclume web app in the user's default browser, completes authentication there, and redirects the token back to a temporary local listener — no passwords, no manual token copying.

Tokens are stored in the OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux) via the `keytar` package. Tokens are never written to disk in plaintext.

---

## Commands

### `arclume login`

Authenticate the CLI with your Arclume account.

```bash
arclume login
```

**Flow:**

1. CLI generates a random `state` token and starts a temporary local HTTP listener on `localhost:9876`
2. Opens `app.arclume.dev/auth/cli?state={token}&redirect=localhost:9876` in the default browser
3. User authenticates in the browser (instant if already logged in)
4. Webapp redirects to `localhost:9876/callback?token={api_token}&state={token}`
5. CLI verifies the `state` matches, stores the API token in the OS keychain
6. Local listener shuts down

```
$ arclume login
Opening browser to authenticate...
Waiting for authentication...
✓ Logged in as sam@arclume.dev (Centree Tech)
```

If the browser doesn't open automatically, the CLI prints a fallback URL the user can open manually.

---

### `arclume logout`

Revoke the current session and remove the token from the keychain.

```bash
arclume logout
```

```
$ arclume logout
✓ Logged out
```

---

### `arclume whoami`

Print the currently authenticated user and organisation.

```bash
arclume whoami
```

```
$ arclume whoami
User:         sam@arclume.dev
Organisation: Centree Tech (f16bac80-ce84-4d0f-94a8-b926d437c79a)
Token:        ••••••••a3f2 (expires in 89 days)
```

---

## Token Design

**User-scoped, not repo-scoped.** A single token authenticates the user across all repos and orgs they have access to. The CLI reads the `orgId` from `.arclume/config.json` in the current repo to know which org context to operate in when making API calls.

This means:
- One `arclume login` per machine, not per repo
- Users with access to multiple orgs can work across repos without re-authenticating
- The token never lives in the repo — org context comes from `config.json`, credentials come from the keychain

---

## Token Storage

Tokens are stored via [`keytar`](https://github.com/atom/node-keytar) under the service name `arclume-cli`.

| Platform | Storage location |
|----------|-----------------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | libsecret / GNOME Keyring |

In environments where a keychain is unavailable (some CI environments), the CLI falls back to reading `ARCLUME_TOKEN` from the environment:

```bash
ARCLUME_TOKEN=your_token arclume index
```

This is the recommended approach for CI/CD pipelines — generate a long-lived token from the Arclume web app under **Settings → API Tokens** and set it as a secret in your pipeline.

---

## Security

- The `state` parameter is a cryptographically random token verified on callback to prevent CSRF
- The local listener binds to `127.0.0.1` only, not `0.0.0.0`
- The listener shuts down immediately after receiving the callback (or after a 5-minute timeout)
- API tokens are never logged, written to `.arclume/`, or included in any generated files
- `arclume doctor` warns if `ARCLUME_TOKEN` is set as an environment variable in a non-CI context, suggesting keychain storage instead

---

## CI/CD Usage

For automated environments (GitHub Actions, CircleCI, etc.):

```yaml
# GitHub Actions example
- name: Re-index on merge
  run: arclume index
  env:
    ARCLUME_TOKEN: ${{ secrets.ARCLUME_TOKEN }}
```

Generate a CI token from the Arclume web app under **Settings → API Tokens**. CI tokens can be scoped to specific permissions (index-only, read-only, etc.) and rotated independently of user sessions.

---

## Error States

| Scenario | CLI behaviour |
|----------|--------------|
| Not logged in | Prints `Not authenticated. Run arclume login.` and exits with code 1 |
| Token expired | Prints `Session expired. Run arclume login to re-authenticate.` |
| Token revoked remotely | Prints `Token is no longer valid. Run arclume login.` |
| No keychain available | Falls back to `ARCLUME_TOKEN` env var; warns if neither is present |
| Browser fails to open | Prints fallback URL to open manually |
| Callback timeout (5 min) | Shuts down listener, prints `Authentication timed out. Run arclume login to try again.` |

`arclume doctor` checks for a missing or expired token and always points to `arclume login` as the fix — it's the most common cause of a broken setup for new users.