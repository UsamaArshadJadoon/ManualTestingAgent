# QA AZM Digital Agent — Design Spec

**Product:** QA AZM Digital Agent (multi-agent QA orchestrator)
**Date:** 2026-07-22
**Developed by:** Usama Arshad Jadoon · QC Lead · AZM Digital (usama.arshed@azm.dev)
**Status:** Approved for planning

## 1. Overview

A Claude Code–native, multi-agent QA system that takes a Jira story key, derives
acceptance-criteria-driven end-to-end tests, executes them against a live app in a
real browser, and — after human approval — logs bugs back to Jira and produces a
sign-off report.

It runs entirely inside **Claude Code in VS Code**. It uses **no Anthropic API** and
**no Slack**. Jira access is through the **Atlassian MCP connector**; browser
execution is through the **Playwright MCP**.

### Goals
- One command: `/qa-run PROJ-123` runs the whole pipeline.
- Specialized, isolated subagents, each with one clear job.
- Human-in-the-loop gates before the two consequential actions: **running the browser
  suite** and **writing bugs to Jira**.
- A durable, auditable run folder with all evidence.

### Non-goals (out of scope for v1)
- Full 12-dimension / 50–75 test matrix (we do AC-driven functional E2E).
- Persisting reusable `.spec.ts` files (execution is live-browser only).
- CI/Jenkins triggering, credential vaults, auto token rotation.

## 2. Architecture

Installed **globally** so it works in any VS Code project:

```
~/.claude/
├── commands/
│   ├── qa-run.md          # Orchestrator (entry point): /qa-run PROJ-123 [--rerun] [--resume]
│   └── qa-setup.md        # Interactive first-run config scaffolder: /qa-setup
└── agents/
    ├── qa-story.md         # fetch + parse Jira story & acceptance criteria
    ├── qa-test-writer.md   # generate AC-driven E2E test cases
    ├── qa-gap-analyzer.md  # verify every AC is covered by >=1 test
    ├── qa-test-executor.md # drive live app via Playwright MCP, capture evidence
    ├── qa-bug-logger.md    # propose bugs, then (on approval) create + link in Jira
    ├── qa-reviewer.md      # validate coverage, emit GO/NO-GO verdict
    ├── qa-validator.md     # independent per-stage verification (nothing missed)
    └── qa-test-sync.md     # OPTIONAL: mirror approved cases into AIO Tests (Cloud)
```

The **orchestrator is a slash command** (a prompt), not a subagent. The main agent
reads it and dispatches the seven core subagents (plus the optional `qa-test-sync`
when `aio.enabled` is true) via the Task tool, so the user watches progress live in
the VS Code terminal.

### 2.1 Data bus — the run folder

Subagents run isolated and cannot share memory, so they communicate through **files**
in a per-run folder under the current project. This gives robustness, debuggability,
and a full audit trail.

```
<project>/qa-runs/PROJ-123_<timestamp>/
├── run-context.json     # orchestrator: key, app URL, resolved config, mode
├── story.json           # qa-story
├── test-cases.json      # qa-test-writer (gap-analyzer may append)
├── gap-report.json      # qa-gap-analyzer
├── results.json         # qa-test-executor
├── screenshots/*.png    # qa-test-executor
├── bugs-proposed.json   # qa-bug-logger (drafts; NO Jira writes)
├── bugs-created.json    # qa-bug-logger (only approved bugs, after Jira writes)
├── review.json          # qa-reviewer
├── validation/          # qa-validator: one file per stage (story, test-writer, ...)
│   └── <stage>.json     #   { stage, pass, gaps: [..], checklist: [{item, pass}], iteration }
├── aio-sync.json        # qa-test-sync (optional): testId -> AIO key/ID, folder, storyJiraId
├── report.md            # orchestrator: final markdown report
└── report.html          # orchestrator: shareable HTML dashboard (Artifact)
```

Each subagent reads its inputs from and writes its outputs to this folder. The
orchestrator passes the run-folder path to every subagent it dispatches.

## 3. Configuration — `.qa-config.json`

Lives in the **project root**. Created by `/qa-setup`. Credentials are referenced by
**env var name only** — never stored in the file.

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
    "maskPatterns": ["password", "token", "authorization", "email", "\\b\\d{12,19}\\b"]
  },
  "severityMap": {
    "blocker": "Highest",
    "major": "High",
    "minor": "Low"
  },
  "execution": { "flakyRetry": 1, "stepTimeoutMs": 15000, "maxRunMinutes": 30 },
  "outputDir": "qa-runs"
}
```

If `.qa-config.json` is missing when `/qa-run` starts, the orchestrator tells the user
to run `/qa-setup` first and stops.

## 4. Subagents

Each subagent definition is a `~/.claude/agents/*.md` file with frontmatter
(`name`, `description`, `tools`, `model`) and a prompt body describing its single job,
its input files, and its exact output file + schema.

### 4.1 qa-story
- **Job:** Fetch the story from Jira and normalize it.
- **Tools:** Atlassian MCP (`getJiraIssue`, `searchJiraIssuesUsingJql`).
- **Input:** `run-context.json` (story key).
- **Output:** `story.json` — `{ key, summary, description, acceptanceCriteria: [{ id, text }], components, status }`.
- **Notes:** If no AC is present, extract candidate criteria from the description and
  mark `acSource: "inferred"` with low confidence for the orchestrator to surface.

### 4.2 qa-test-writer
- **Job:** Generate AC-driven functional E2E test cases (happy path, negative, edge).
- **Tools:** Read/Write (no external calls).
- **Input:** `story.json` (+ `gap-report.json` on later iterations).
- **Output:** `test-cases.json` — array of
  `{ id, title, linkedAC: [acId], type: "happy|negative|edge", steps: [..], testData: {..}, expectedResult }`.

### 4.3 qa-gap-analyzer
- **Job:** Verify every AC maps to >=1 test case; identify missing coverage.
- **Tools:** Read/Write.
- **Input:** `story.json`, `test-cases.json`.
- **Output:** `gap-report.json` — `{ covered: [acId], uncovered: [acId], suggestions: [..], complete: bool }`.
- **Loop:** If `complete=false`, orchestrator sends suggestions back to qa-test-writer.
  **Capped at 2 iterations**, then remaining gaps are flagged in the report rather
  than looping forever.

### 4.4 qa-test-executor
- **Job:** Execute each test case against the live app in a real browser.
- **Tools:** Playwright MCP (navigate, click, type, snapshot, screenshot, console,
  network), Read/Write.
- **Input:** `test-cases.json`, `run-context.json`.
- **Behavior:**
  - **Environment guard:** before navigating, check `baseUrl` against
    `safety.prodUrlPatterns`. If it looks like production and `allowProduction=false`,
    stop and require explicit user confirmation.
  - **Non-destructive posture:** prefer read/create over update/delete on shared data.
    Any step flagged destructive requires confirmation when
    `safety.destructiveActions="confirm"`. Data the tests create is tracked and, if
    `cleanupCreatedData=true`, cleaned up (or flagged) at the end.
  - **Login session reuse:** authenticate once at the start (using `usernameEnv` /
    `passwordEnv`), reuse the session for all cases.
  - **Timeouts:** each step is bounded by `stepTimeoutMs`; the whole run by
    `maxRunMinutes`. A step timeout marks that case `blocked` and moves on.
  - Run each case's steps; capture a screenshot per case (and on any failure).
  - **Flaky-retry:** on failure, retry once with fresh state. Only a *consistent*
    failure is recorded as `failed`; a pass-on-retry is recorded as `flaky`.
  - **Console/JS error findings:** collect uncaught JS + console errors during each
    case and record them as findings even when the functional assertion passes.
  - One failing/blocked test never stops the rest.
  - If the app URL is unreachable or login fails, mark affected tests `blocked` (not
    `failed`) and record the reason.
- **Output:** `results.json` — per case
  `{ id, status: "passed|failed|flaky|blocked", steps: [{ step, ok, note }], screenshots: [path], consoleErrors: [..], jsErrorFindings: [..], createdData: [..], reason }`.

### 4.5 qa-bug-logger (two-phase, human-approved)
- **Job:** Turn consistent failures into Jira bugs — but only after user approval.
- **Tools:** Atlassian MCP (`searchJiraIssuesUsingJql`, `createJiraIssue`,
  `createIssueLink`), Read/Write.
- **Phase A — propose (no Jira writes):**
  - For each `failed` test, draft a bug: `{ title, description, reproSteps, severity,
    linkedAC, testId, screenshots }` using `severityMap`.
  - **Duplicate detection:** run a JQL search for existing open bugs with a similar
    summary on the project; annotate each draft with `possibleDuplicate: [key]`.
  - Write `bugs-proposed.json`. **Return control to the orchestrator.**
- **Phase B — create (only after approval):**
  - The orchestrator passes the approved subset. For each, `createJiraIssue` +
    `createIssueLink` (link to the story). Write `bugs-created.json`
    (`{ testId, key, url }`).

### 4.6 qa-reviewer
- **Job:** Objective sign-off.
- **Tools:** Read/Write.
- **Input:** all prior JSON files.
- **Output:** `review.json` — `{ acCoveragePct, totalTests, passed, failed, flaky,
  blocked, bugsLogged, blockers, verdict: "GO|NO-GO", rationale }`.
- **Rule:** verdict is `NO-GO` if any AC is uncovered, any blocker-severity test
  failed, or coverage < 100% of testable AC.

### 4.7 qa-validator (independent per-stage verification)
- **Job:** After each stage, independently confirm that stage missed nothing. It does
  NOT redo the work — it *checks* the output against the stage's inputs and checklist.
- **Tools:** Read/Write only (Atlassian MCP read allowed when it must confirm against
  Jira, e.g. that no AC was dropped from the source issue).
- **Input:** the stage name + that stage's input and output files.
- **Output:** `validation/<stage>.json` —
  `{ stage, pass: bool, gaps: [{ item, detail }], checklist: [{ item, pass }], iteration }`.
- **Independence:** it re-derives expectations from the *source* (e.g. re-reads the
  Jira issue's AC rather than trusting `story.json`) so it can catch omissions the
  producing agent made. This is why it is a separate agent, not self-review.

### 4.8 qa-test-sync (optional — AIO Tests mirror)
- **Job:** When `aio.enabled` is true, after the test-plan gate, create the approved
  test cases in **AIO Tests for Jira (Cloud)** inside the story's folder and link each
  to the Jira story for traceability. Runs once per story; does not gate execution.
- **Tools:** Read/Write, Bash (for the AIO REST calls via `fetch`/`curl` and to read
  the token from `.qa-secrets`), and Atlassian MCP read (to resolve the story's numeric
  Jira ID for the requirement link).
- **Input:** `run-context.json` (`config.aio`, project key, story key), `story.json`
  (AC text for rich case descriptions), `test-cases.json` (the cases to sync).
- **Output:** `aio-sync.json` — `{ project, folderID, folderName, storyJiraId,
  createdCount, total, cases: [{ testId, aioKey, aioID, title }], _validation }`.
- **Folder prerequisite (hard constraint):** the AIO public API returns HTTP 500 on
  folder/set creation and 404 on case deletion, so folders are **pre-created once in
  the AIO Cases UI, named with the story key** (e.g. `ABYR-2167`). `qa-test-sync`
  resolves the folder by name; if it is missing it stops and returns the exact name to
  create, then the user re-runs it. It creates each case with `scriptType {ID:5}`
  (Classic), `TEXT` steps, and `folder {ID}`; run once per story to avoid duplicates.

## 5. Orchestrator flow (`/qa-run PROJ-123 [--rerun] [--resume]`)

> **Validation rule (applies to every producing stage below).** Immediately after a
> stage writes its output, the orchestrator dispatches **qa-validator** for that stage.
> If `pass=false`, the orchestrator sends the reported `gaps` back to that stage's
> agent to fix, then re-validates — **max 2 fix-retries**. If it still fails, the
> orchestrator surfaces the remaining gaps to the user and asks whether to proceed,
> stop, or fix manually. Every stage also self-validates (Layer 1) before returning.

1. **Load config.** Read `.qa-config.json`; if missing, instruct `/qa-setup` and stop.
2. **Preflight.** Confirm the Atlassian connector is authorized; if not, tell the user
   to authorize it in claude.ai connector settings and stop cleanly. **Environment
   guard:** if `baseUrl` matches a production pattern and `allowProduction=false`,
   require explicit confirmation before proceeding.
3. **Create run folder** `qa-runs/<KEY>_<timestamp>/`, write `run-context.json`.
4. **qa-story** → `story.json` → **validate**. If AC was inferred, surface a note.
5. **qa-test-writer** → `test-cases.json` → **validate**.
6. **qa-gap-analyzer** → `gap-report.json` → **validate**; loop to test-writer if
   incomplete (max 2).
7. **Test-plan approval gate.** Present the final test list (id, title, linked AC,
   type). Wait for the user's `go` before the slow browser phase. User may drop/edit
   cases first.
7b. **qa-test-sync (optional).** If `aio.enabled` is true, dispatch `qa-test-sync`
    once to create the approved cases in the story's **AIO Tests** folder (found by
    the story-key folder name, pre-created in the AIO Cases UI) and link each to the
    Jira story → `aio-sync.json`. Non-gating: on any failure (e.g. missing folder) it
    reports the exact folder name to create and the pipeline continues.
8. **qa-test-executor** → `results.json` + screenshots → **validate**.
9. **qa-bug-logger Phase A** → `bugs-proposed.json` (drafts + duplicate flags) →
   **validate**.
10. **Bug approval gate.** Present a numbered list (title, severity, failed test,
    possible-duplicate). User replies `all` / `none` / `1,3,4` / or edits a field.
11. **qa-bug-logger Phase B** → `bugs-created.json` (only approved) → **validate**.
12. **qa-reviewer** → `review.json` → **validate**.
13. **Report.** Write `report.md` and publish `report.html` as an Artifact:
    summary, GO/NO-GO verdict, **traceability matrix** (AC ↔ test(s) ↔ result ↔ bug),
    pass/fail/flaky/blocked counts, coverage %, proposed vs. created bugs, screenshot
    links, and the **validation summary** (per-stage pass-clean / retries / escalated
    gaps).

### 5.1 Resume mode (`--resume`)

- Locate the most recent run folder for the key.
- Inspect which output files already exist and restart from the first missing stage
  (e.g. if `results.json` exists but `bugs-proposed.json` does not, resume at the bug
  gate). Avoids redoing the Jira fetch, test-writing, or an expensive browser run.

### 5.2 Re-run / verify mode (`--rerun`)
- Locate the most recent run folder for the key.
- Re-execute only tests with status `failed` or `flaky`.
- Write a new run folder; report shows before/after.
- For each previously-logged bug whose test now passes, **propose** transitioning the
  Jira bug (e.g., to "Done"/"Resolved") — applied only after user approval (same gate
  discipline).

### 5.3 Two-layer validation ("didn't miss anything at each level")

Every stage is verified twice:

- **Layer 1 — self-validation.** Before returning, each producing agent runs its own
  stage checklist and embeds a `_validation` block in its output file
  (`{ checklist: [{item, pass}], selfConfident, notes }`). Cheap, catches obvious slips.
- **Layer 2 — independent validation.** `qa-validator` re-derives expectations from the
  *source* and checks the output, writing `validation/<stage>.json`. Because it is a
  separate agent working from the source (not the producing agent's summary), it
  catches omissions self-review would miss.

On a Layer-2 fail the orchestrator loops the gaps back to the stage agent (**max 2
retries**), then escalates to the user if unresolved.

**Per-stage validation checklists:**

| Stage | Checks |
|---|---|
| qa-story | Every AC captured & atomic/testable · nothing dropped from description · components/status present |
| qa-test-writer | Every AC → ≥1 case · happy + negative + edge covered · steps executable & unambiguous · test data present |
| qa-gap-analyzer | Coverage verdict actually matches `test-cases.json` (validate the validator) |
| qa-test-executor | Every planned case has a result · evidence per case · no case silently skipped · status justified by steps |
| qa-bug-logger (propose) | Every `failed` test → a draft · severity mapped · dup-check ran · masking applied |
| qa-bug-logger (create) | Every *approved* bug created + linked · keys/URLs returned |
| qa-reviewer | Verdict logically consistent with underlying numbers |

The final `report.md` / `report.html` include a **validation summary**: per stage,
pass-clean vs. number of fix-retries vs. gaps escalated to the user.

## 6. Error handling summary

| Condition | Behavior |
|---|---|
| `.qa-config.json` missing | Instruct `/qa-setup`, stop |
| Atlassian connector not authorized | Tell user to authorize in claude.ai settings, stop |
| Story has no AC | Infer from description, flag low-confidence, ask user to confirm |
| Gap loop not converging | Cap at 2 iterations, flag remaining gaps in report |
| App URL unreachable / login fails | Mark tests `blocked` (not `failed`), record reason |
| Single test fails | Retry once (flaky check); continue remaining tests |
| Duplicate bug likely | Flag `possibleDuplicate` in proposal; user decides |
| `baseUrl` looks like production | Stop and require explicit confirmation (env guard) |
| Destructive step | Confirm before running; track + clean up created data |
| Step/run timeout exceeded | Mark case `blocked`, continue; run cap ends the run gracefully |
| Interrupted run | `--resume` restarts from first missing stage |
| Stage validation fails | Loop gaps back to the stage agent (max 2 retries), then escalate to user |

## 7. Human-in-the-loop gates (summary)

Two hard gates, nothing consequential happens without approval:
1. **Test-plan gate** — before executing the browser suite.
2. **Bug gate** — before writing anything to Jira (and before transitioning bugs in
   `--rerun`).

Plus a **soft gate**: if any stage's validation can't be resolved within its retry
budget, the orchestrator pauses and asks the user whether to proceed, stop, or fix
manually.

## 8. Safety & data handling (cross-cutting)

Applies across all stages:

- **Environment guard.** Never run against production unless `allowProduction=true` or
  the user explicitly confirms. The URL is checked at preflight and again in the
  executor.
- **Non-destructive by default.** Prefer read/create; confirm before destructive
  steps; track and clean up test-created data.
- **Secrets & PII masking.** Before anything is written to `report.md`, `report.html`,
  screenshots metadata, or a Jira bug, redact values matching `safety.maskPatterns`
  (passwords, tokens, auth headers, emails, long digit sequences). Jira bugs are
  team-visible — this prevents leaking credentials or customer data into a ticket.
- **Timeouts.** Per-step (`stepTimeoutMs`) and whole-run (`maxRunMinutes`) caps keep a
  stuck app from freezing the pipeline.

### Known limitation
Screenshot **attachments** to Jira are not supported by the Atlassian MCP
`createJiraIssue` tool. v1 stores screenshots in the run folder, references them in the
report, and includes their paths in the bug description rather than attaching binaries.

## 9. Component isolation

Every subagent: single purpose, file-based I/O contract, independently testable. You
can run any stage alone by placing its input files in a run folder and dispatching
just that agent.
