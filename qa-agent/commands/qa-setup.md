---
name: qa-setup
description: Interactively scaffold .qa-config.json for the QA orchestrator (app URL, Jira project key, login env var names, safety options).
tools:
  - Read
  - Write
  - AskUserQuestion
---

You are the `/qa-setup` command for the QA orchestrator. Your job is to interactively scaffold a **`.qa-config.json`** file in the current project root, using `qa-agent/qa-config.example.json` as the template.

## Steps

1. **Check for an existing config.** Use `Read` to check whether **`.qa-config.json`** already exists in the project root.
   - If it exists, show its full current contents to the user, then use `AskUserQuestion` to ask whether they want to overwrite it. If they decline, stop here without writing anything and tell them the existing `.qa-config.json` was left untouched.
   - If it does not exist, proceed directly to step 2.

2. **Read the template.** Use `Read` to load `qa-agent/qa-config.example.json`. This defines the exact key structure to reuse: `jira`, `app` (with nested `login`), `safety`, `severityMap`, `execution`, `outputDir`.

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

4. **Write `.qa-config.json`.** Using the template loaded in step 2 as the base shape, fill in the answers from step 3:
   - `jira.projectKey` from the answer given (keep `jira.defaultBugType` as `"Bug"` from the template unless the user overrides it).
   - `app.baseUrl` from the answer given.
   - `app.login.required`, `app.login.loginUrl`, `app.login.usernameEnv`, `app.login.passwordEnv` from the answers given (keep `app.login.sessionReuse: true` from the template).
   - `safety.allowProduction` from the answer given.
   - Keep the `safety` (other than `allowProduction`), `severityMap`, and `execution` blocks exactly as they appear in `qa-agent/qa-config.example.json` — do not change `prodUrlPatterns`, `destructiveActions`, `cleanupCreatedData`, `maskPatterns`, `severityMap`, `execution`, or `outputDir` from the template defaults.
   - Use the `Write` tool to create **`.qa-config.json`** in the project root with this filled-in structure.

5. **Remind the user of follow-up steps.** After writing the file, tell the user to:
   - Set the referenced env vars before running the orchestrator, using PowerShell syntax, e.g.:
     ```powershell
     $env:QA_USER = "your-username"
     $env:QA_PASS = "your-password"
     ```
     (substitute the actual `usernameEnv`/`passwordEnv` names chosen in step 3 if they differ from `QA_USER`/`QA_PASS`).
   - Authorize the Atlassian connector in claude.ai connector settings if it is not already connected, since the QA orchestrator's Jira-facing subagents depend on it.

## Output

The only file this command writes is **`.qa-config.json`** in the project root. Do not create or modify any other files.
