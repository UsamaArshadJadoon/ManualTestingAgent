# QA AZM Digital Agent

> **QA AZM Digital Agent** — an autonomous, multi-agent QA system for Claude Code.
>
> **Developed by:** Usama Arshad Jadoon &nbsp;·&nbsp; **Role:** QC Lead &nbsp;·&nbsp; **Company:** AZM Digital

The **QA AZM Digital Agent** takes a Jira story key, writes and
gap-checks test cases, executes them against a running application with
Playwright, logs approved bugs back to Jira, and produces a GO/NO-GO
verdict with a full traceability report — all coordinated by a `/qa-run`
orchestrator command that dispatches seven core specialist subagents (plus an
optional `qa-test-sync` that mirrors the approved cases into AIO Tests)
through the `Task` tool.

## What it is

- **1 orchestrator command** (`/qa-run`) that never writes test cases,
  drives a browser, or files bugs itself — it sequences subagents, enforces
  validation after every stage, and stops for human approval at the gates
  described below.
- **1 setup command** (`/qa-setup`) that interactively scaffolds
  `.qa-config.json` for your project.
- **7 core subagents (+ 1 optional)**, each single-purpose and dispatched one
  at a time via the `Task` tool:
  - `qa-story` — fetches and normalizes the Jira story (summary, description,
    atomic acceptance criteria, components, status).
  - `qa-test-writer` — writes happy / negative / edge test cases per
    acceptance criterion.
  - `qa-gap-analyzer` — checks acceptance-criteria coverage and reports gaps.
  - `qa-test-executor` — runs the test cases against the live app with the
    Playwright MCP tools and records pass/fail/flaky/blocked results,
    screenshots, and console/JS errors.
  - `qa-bug-logger` — proposes bug drafts for failed cases, then (only after
    approval) creates them in Jira and links them to the story; it also
    handles fix-forward Jira transitions on `--rerun`.
  - `qa-reviewer` — independently recomputes coverage and tallies and issues
    the GO/NO-GO verdict.
  - `qa-validator` — the soft validation gate run after every producing
    stage, checking each stage's output before the pipeline advances.
  - `qa-test-sync` *(optional)* — when `aio.enabled` is `true`, after the
    test-plan gate it creates the approved cases in **AIO Tests for Jira
    (Cloud)** inside the story's folder and links each to the Jira story for
    traceability. It runs once per story and does not gate execution. Because
    the AIO API cannot create folders, **you must first create a folder named
    with the story key** (e.g. `ABYR-2167`) in the AIO *Cases* module; if it
    is missing, `qa-test-sync` stops and tells you the exact name to create.

Every subagent runs isolated with no shared memory: the orchestrator passes
only the run-folder path (plus a `stage`/`iteration` for `qa-validator`, and
phase/approved-refs for `qa-bug-logger`). All actual data flows through JSON
files inside the run folder.

## Prerequisites

1. **Authorize the Atlassian connector** in your claude.ai connector
   settings. `qa-story`, `qa-bug-logger`, and `qa-validator` depend on it to
   read and write Jira issues; if it isn't authorized, `/qa-run` will stop on
   its first Jira contact and tell you to authorize it, then re-run.
2. **Authorize the Playwright MCP server.** `qa-test-executor` drives the
   browser through the `mcp__playwright__*` tools.
3. **Set the credential environment variables** the app under test needs for
   login, using the exact names you gave `/qa-setup` (`usernameEnv` /
   `passwordEnv` — `QA_USER` / `QA_PASS` by default). In PowerShell:

   ```powershell
   $env:QA_USER = "your-username"
   $env:QA_PASS = "your-password"
   ```

   These are only ever read by `qa-test-executor` (via a narrowly scoped
   `Bash` capability used solely to read the two named env vars at login
   time) and are held in memory only for the duration of the login step —
   they are never written to `results.json`, screenshots, logs, or any other
   run artifact, and never persisted anywhere.
4. **(Optional — only for AIO Tests sync)** set `aio.enabled: true` in
   `.qa-config.json`, add the AIO API token to `.qa-secrets` under the name
   in `aio.tokenEnv` (default `AIO_TOKEN`), and **create one folder named with
   the story key** (e.g. `ABYR-2167`) in the AIO **Cases** module. The AIO
   public API cannot create folders, so this one-time UI step is required per
   story; `qa-test-sync` then finds the folder by name and fills it with the
   approved cases.

## Install

From the project root (Windows PowerShell 5.1 — `pwsh` is not available on
this host, use `powershell`):

```powershell
powershell -File qa-agent\install.ps1
```

This copies every file in `qa-agent\agents\*.md` and `qa-agent\commands\*.md`
into `~\.claude\agents\` and `~\.claude\commands\` (creating those
directories if needed) and prints each agent/command it installed. Re-run it
any time you update the files under `qa-agent\` to redeploy the latest
versions.

## First run

In the target project, run:

```
/qa-setup
```

This interactively scaffolds `.qa-config.json` (Jira project key, app base
URL, login requirement + URL, the credential env-var *names*, and whether
production runs are allowed). It never asks for the actual username/password
values — only the names of the environment variables that hold them. Set
those environment variables (see Prerequisites) before running `/qa-run`.

## Usage

> **Where to type these:** `/qa-run` and `/qa-setup` are **Claude Code commands** — type them in the **Claude Code chat prompt** (Ctrl+Esc to focus it), **not** in the terminal/PowerShell. Only `install.ps1` runs in PowerShell. If PowerShell says *"qa-run is not recognized"*, you typed it in the wrong place. Type `/` in the chat to see the commands; reload VS Code if they don't appear right after installing.

```
/qa-run PROJ-123
```

Runs the full pipeline for story `PROJ-123`: normalize the story, write test
cases, check AC coverage, get your approval on the test plan, execute the
cases, propose bugs for failures, get your approval on which bugs to file,
create the approved bugs in Jira, compute the verdict, and publish a report.

```
/qa-run PROJ-123 --resume
```

Resumes the latest run folder for `PROJ-123` from the first missing/failed
pipeline stage, instead of starting over.

```
/qa-run PROJ-123 --rerun
```

Re-executes only the `failed`/`flaky` cases from the latest run for
`PROJ-123`, proposes fix-forward Jira transitions for bugs whose tests now
pass (never auto-applied — always presented for your approval first), and
recomputes the verdict.

### The three approval gates

`/qa-run` stops and waits for you at these points — it never proceeds past
them on its own:

1. **Test-plan approval gate** — before any browser execution, it shows you
   the planned test cases and AC coverage status and waits for you to say
   `go` (or request changes) before dispatching `qa-test-executor`.
2. **Bug approval gate** — after `qa-bug-logger` Phase A drafts bug reports
   for failed cases, it shows you the drafts (title, severity, failing test,
   possible duplicates) and waits for you to approve all, none, a subset, or
   request edits, before anything is created in Jira.
3. **Validation escalation gate** — if a stage's output still fails the
   `qa-validator` check after 2 automatic fix-retries, it stops and asks you
   to choose: proceed anyway, stop the run, or give guidance and retry.

### Where results land

Each run writes to its own timestamped folder under `outputDir` (default
`qa-runs/`) in the project root:

```
qa-runs/PROJ-123_20260722-143001/
  run-context.json
  story.json
  test-cases.json
  gap-report.json
  results.json
  screenshots/
  bugs-proposed.json
  bugs-created.json
  review.json
  validation/
  aio-sync.json          # only when AIO sync is enabled (testId → AIO key/ID)
  report.md
  report.html
  bug-report.html
```

`report.html` and the detailed `bug-report.html` are also published as Artifacts, and `report.md` /
`report.html` contain the GO/NO-GO verdict, the AC-to-test-to-result-to-bug
traceability matrix, tallies, coverage %, bug counts, screenshot links, and a
per-stage validation summary. Both reports are redacted against
`safety.maskPatterns` before being written.

## Known limitation: Jira screenshot attachments

`qa-bug-logger` has no Jira attachment-upload tool available to it, so bugs
it creates in Jira reference screenshots by their **local run-folder path**
in the description/repro steps — the image files themselves are not
uploaded or attached to the Jira issue. To view a failure's screenshot,
open the corresponding `screenshots/` file inside the run folder locally
(or from the published `report.html` Artifact, which links to the same
paths); it will not appear as a Jira attachment. The detailed
`bug-report.html` embeds those screenshots inline for convenient sharing.

---

## Credits

**QA AZM Digital Agent** — Developed by **Usama Arshad Jadoon**, QC Lead, **AZM Digital**.
