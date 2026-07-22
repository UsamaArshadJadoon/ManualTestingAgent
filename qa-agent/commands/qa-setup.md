---
name: qa-setup
description: QA AZM Digital Agent — interactively scaffold .qa-config.json (app URL, Jira project key, login env var names, safety options), plus a git-ignored .qa-secrets credential store and hardened .gitignore. (Developed by Usama Arshad Jadoon, QC Lead, AZM Digital.)
tools:
  - Read
  - Write
  - AskUserQuestion
---

You are the `/qa-setup` command for the QA orchestrator. Your job is to interactively scaffold a **`.qa-config.json`** file in the current project root, using the **embedded default config** below as the template. This command is self-contained — it does NOT read any external template file, because the orchestrator is deployed to `~/.claude` without its example config, so a relative path to `qa-agent/qa-config.example.json` would not resolve in a target project.

## Embedded default config

Use this exact JSON as the base shape. Fill in the user's answers over these defaults (see step 4), and keep every other key exactly as shown here.

```json
{
  "jira": { "projectKey": "PROJ", "defaultBugType": "Bug" },
  "app": {
    "baseUrl": "https://staging.example.com",
    "login": {
      "required": true,
      "loginUrl": "https://staging.example.com/login",
      "usernameEnv": "QA_USER",
      "passwordEnv": "QA_PASS",
      "sessionReuse": true
    }
  },
  "safety": {
    "allowProduction": false,
    "prodUrlPatterns": ["prod", "www.", "app.", "live"],
    "destructiveActions": "confirm",
    "cleanupCreatedData": true,
    "maskPatterns": ["[\\w.+-]+@[\\w-]+\\.[\\w.-]+", "(?i)(bearer|token|authorization)\\s*[:=]\\s*\\S+", "\\b\\d{12,19}\\b", "(?i)(password|passwd|pwd|secret|api[_-]?key)\\s*[:=]\\s*\\S+"]
  },
  "severityMap": { "blocker": "Highest", "major": "High", "minor": "Low" },
  "execution": { "flakyRetry": 1, "stepTimeoutMs": 15000, "maxRunMinutes": 30 },
  "outputDir": "qa-runs"
}
```

## Steps

1. **Check for an existing config.** Use `Read` to check whether **`.qa-config.json`** already exists in the project root.
   - If it exists, show its full current contents to the user, then use `AskUserQuestion` to ask whether they want to overwrite it. If they decline, stop here without writing anything and tell them the existing `.qa-config.json` was left untouched.
   - If it does not exist, proceed directly to step 2.

2. **Use the embedded default config above as the template.** Do NOT read any external file for this — the embedded JSON above defines the exact key structure to reuse: `jira`, `app` (with nested `login`), `safety`, `severityMap`, `execution`, `outputDir`.

3. **Ask the setup questions with `AskUserQuestion`.** Gather the following (batch related questions together where the tool allows it):
   - **Jira `projectKey`** — the Jira project key this QA run will file bugs against (e.g. `PROJ`).
   - **App `baseUrl`** — the base URL of the application under test (e.g. `https://staging.example.com`).
   - **Whether login is required** for the app under test.
     - If yes, also ask for:
       - **`loginUrl`** — the login page URL.
       - The **env var NAME** (not the value) that holds the username, e.g. `usernameEnv` such as `QA_USER`. Never ask for or accept the literal username/password value itself — only the name of the environment variable that will hold it.
       - The **env var NAME** (not the value) that holds the password, e.g. `passwordEnv` such as `QA_PASS`.
     - If no, set `login.required` to `false` and omit/blank the login-specific fields as appropriate, keeping the same key shape as the template.
   - **Whether production runs are allowed** — this maps to `safety.allowProduction` (`true`/`false`). Make clear that leaving this `false` is the safe default and that `true` permits the orchestrator to run against production-looking URLs.

   Never ask the user to type an actual password or secret value into this conversation — only ever collect env var *names*.

4. **Write `.qa-config.json`.** Using the embedded default config above as the base shape, fill in the answers from step 3:
   - `jira.projectKey` from the answer given (keep `jira.defaultBugType` as `"Bug"` from the template unless the user overrides it).
   - `app.baseUrl` from the answer given.
   - `app.login.required`, `app.login.loginUrl`, `app.login.usernameEnv`, `app.login.passwordEnv` from the answers given (keep `app.login.sessionReuse: true` from the template).
   - `safety.allowProduction` from the answer given.
   - Keep the `safety` (other than `allowProduction`), `severityMap`, and `execution` blocks exactly as they appear in the embedded default config above — do not change `prodUrlPatterns`, `destructiveActions`, `cleanupCreatedData`, `maskPatterns`, `severityMap`, `execution`, or `outputDir` from the embedded defaults.
   - Use the `Write` tool to create **`.qa-config.json`** in the project root with this filled-in structure.

5. **Scaffold the git-ignored credential store (`.qa-secrets`).** If `login.required` is `true`, create a **`.qa-secrets`** file in the project root (a `.env`-style `KEY=VALUE` file) so the executor has a local place to read credentials from when OS env vars aren't set. **Never ask the user to type their actual password into this conversation, and never write a real secret value yourself** — write only a commented template with empty placeholders for the chosen env-var names, which the user fills in privately in the git-ignored file. If `.qa-secrets` already exists, do NOT overwrite it (leave the user's values intact). Template to write:
   ```
   # QA Orchestrator credential store — .env-style KEY=VALUE
   # This file is git-ignored and MUST NEVER be committed.
   # Fill in the values below; the executor reads these when the matching OS env var is unset.
   QA_USER=
   QA_PASS=
   # AIO Tests API token (only needed if config.aio.enabled is true; used by qa-test-sync)
   AIO_TOKEN=
   ```
   (substitute the actual `usernameEnv`/`passwordEnv` names chosen in step 3 for `QA_USER`/`QA_PASS`).

6. **Harden `.gitignore`.** Read the project's `.gitignore` (create it if absent) and ensure it contains each of these entries (add any that are missing; never remove existing lines): `.qa-secrets`, `.env`, `.env.*`, `.qa-config.json`, `.playwright-mcp/`, `qa-runs/`. This guarantees credentials, config, browser snapshots, and run outputs are never committed.

7. **Remind the user of follow-up steps.** After writing the files, tell the user they can supply credentials either way:
   - **Option A — fill in `.qa-secrets`** (the git-ignored file just created): put the real values after `QA_USER=` / `QA_PASS=`. Convenient for repeated runs; never committed.
   - **Option B — OS environment variables** (nothing on disk), using PowerShell syntax, e.g.:
     ```powershell
     $env:QA_USER = "your-username"
     $env:QA_PASS = "your-password"
     ```
     (substitute the actual `usernameEnv`/`passwordEnv` names chosen in step 3). The executor checks the OS env var first, then `.qa-secrets`.
   - Authorize the Atlassian connector in claude.ai connector settings if it is not already connected, since the QA orchestrator's Jira-facing subagents depend on it.

## Output

This command writes **`.qa-config.json`** (always), a **`.qa-secrets`** template (only if login is required and it does not already exist), and ensures **`.gitignore`** contains the credential/config/output entries listed in step 6 — all in the project root. It writes no real secret values and modifies no other files.

---

_Part of the **QA AZM Digital Agent** — Developed by Usama Arshad Jadoon · QC Lead · AZM Digital._
