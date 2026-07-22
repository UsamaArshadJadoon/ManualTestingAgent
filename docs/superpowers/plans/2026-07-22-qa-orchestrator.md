# QA AZM Digital Agent — Implementation Plan

> Developed by Usama Arshad Jadoon · QC Lead · AZM Digital

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code–native, multi-agent QA system (`/qa-run PROJ-123`) that turns a Jira story into AC-driven E2E tests, executes them in a live browser, and — after human approval — logs bugs to Jira, with independent per-stage validation.

**Architecture:** One orchestrator slash command dispatches seven specialized subagents (`.claude/agents/*.md`) that communicate through JSON files in a per-run folder. Jira access is via the Atlassian MCP connector; browser execution via the Playwright MCP. Files are authored in a git-tracked `qa-agent/` source folder and deployed globally to `~/.claude` by an install script.

**Tech Stack:** Claude Code (subagents + slash commands), Atlassian MCP, Playwright MCP, PowerShell (install + structural checker), Markdown+YAML frontmatter (the artifacts themselves).

## Global Constraints

- **No Anthropic API, no Slack** — Claude Code native only.
- **Install target:** `~/.claude/agents/` and `~/.claude/commands/` (global).
- **Source of truth:** `c:\QCAgent\qa-agent/` (git-tracked), deployed via `install.ps1`.
- **Subagent frontmatter keys (required):** `name`, `description`, `tools`, `model: claude-opus-4-8`.
- **Data bus:** every subagent reads/writes only files inside the run folder path passed to it. No shared memory.
- **Run folder layout** (canonical — see `qa-agent/references/run-folder-contract.md`):
  `run-context.json`, `story.json`, `test-cases.json`, `gap-report.json`, `results.json`, `screenshots/`, `bugs-proposed.json`, `bugs-created.json`, `review.json`, `validation/<stage>.json`, `report.md`, `report.html`.
- **Atlassian MCP tool names (exact):** `mcp__claude_ai_Atlassian__getJiraIssue`, `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`, `mcp__claude_ai_Atlassian__createJiraIssue`, `mcp__claude_ai_Atlassian__createIssueLink`, `mcp__claude_ai_Atlassian__getTransitionsForJiraIssue`, `mcp__claude_ai_Atlassian__transitionJiraIssue`.
- **Playwright MCP tool names (exact):** `mcp__playwright__browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`, `browser_wait_for`, `browser_evaluate`.
- **Bounded loops:** gap-analysis max 2 iterations; validation fix-retry max 2.
- **Three gates:** test-plan approval (before execution), bug approval (before Jira writes), validation-escalation (soft, on unresolved gaps).
- **Safety:** environment guard (refuse prod), non-destructive posture, secrets/PII masking, per-step + whole-run timeouts.
- **Spec reference:** `docs/superpowers/specs/2026-07-22-qa-orchestrator-design.md`.

---

## File Structure

```
c:\QCAgent\qa-agent\
├── install.ps1                      # copies agents/ + commands/ into ~/.claude
├── README.md                        # install + usage
├── qa-config.example.json           # config template
├── references/
│   └── run-folder-contract.md       # canonical run-folder + JSON schemas (maintainer ref)
├── tools/
│   └── check-artifacts.ps1          # structural verifier (the "test" harness)
├── commands/
│   ├── qa-run.md                    # orchestrator entry point
│   └── qa-setup.md                  # interactive config scaffolder
└── agents/
    ├── qa-story.md
    ├── qa-test-writer.md
    ├── qa-gap-analyzer.md
    ├── qa-test-executor.md
    ├── qa-bug-logger.md
    ├── qa-reviewer.md
    └── qa-validator.md
```

Each `.md` artifact is self-contained (subagents only receive their own file). The `references/run-folder-contract.md` is a maintainer document; the exact schemas are ALSO restated inside each agent that produces them.

---

## Task 1: Scaffold, config template, contract reference, and structural checker

**Files:**
- Create: `qa-agent/qa-config.example.json`
- Create: `qa-agent/references/run-folder-contract.md`
- Create: `qa-agent/tools/check-artifacts.ps1`

**Interfaces:**
- Produces: `check-artifacts.ps1` — verifier invoked as
  `pwsh qa-agent/tools/check-artifacts.ps1 -File <path> -Requires <substr1>,<substr2>,...`
  Exit 0 if the file exists, has valid `---` frontmatter with `name:`/`description:`/`tools:` (for agent/command files, toggled by `-Frontmatter`), and contains every `-Requires` substring; exit 1 otherwise, printing each missing item. Every later task calls this as its test.

- [ ] **Step 1: Create the config template**

Create `qa-agent/qa-config.example.json`:

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
  "severityMap": { "blocker": "Highest", "major": "High", "minor": "Low" },
  "execution": { "flakyRetry": 1, "stepTimeoutMs": 15000, "maxRunMinutes": 30 },
  "outputDir": "qa-runs"
}
```

- [ ] **Step 2: Create the run-folder contract reference**

Create `qa-agent/references/run-folder-contract.md` containing: the run-folder tree (from Global Constraints), and the exact JSON schema for each file:
- `run-context.json`: `{ key, appBaseUrl, config, mode: "run|rerun|resume", runFolder, timestamp }`
- `story.json`: `{ key, summary, description, acceptanceCriteria: [{ id, text }], components: [..], status, acSource: "explicit|inferred", _validation: {...} }`
- `test-cases.json`: `{ cases: [{ id, title, linkedAC: [acId], type: "happy|negative|edge", steps: [str], testData: {}, expectedResult }], _validation: {...} }`
- `gap-report.json`: `{ covered: [acId], uncovered: [acId], suggestions: [str], complete: bool, _validation: {...} }`
- `results.json`: `{ cases: [{ id, status: "passed|failed|flaky|blocked", steps: [{ step, ok, note }], screenshots: [path], consoleErrors: [str], jsErrorFindings: [str], createdData: [str], reason }], _validation: {...} }`
- `bugs-proposed.json`: `{ drafts: [{ ref, title, description, reproSteps: [str], severity, linkedAC: [acId], testId, screenshots: [path], possibleDuplicate: [key] }], _validation: {...} }`
- `bugs-created.json`: `{ created: [{ ref, testId, key, url }], _validation: {...} }`
- `review.json`: `{ acCoveragePct, totalTests, passed, failed, flaky, blocked, bugsLogged, blockers: [str], verdict: "GO|NO-GO", rationale, _validation: {...} }`
- `validation/<stage>.json`: `{ stage, pass: bool, gaps: [{ item, detail }], checklist: [{ item, pass }], iteration }`

- [ ] **Step 3: Write the structural checker**

Create `qa-agent/tools/check-artifacts.ps1`:

```powershell
param(
  [Parameter(Mandatory=$true)][string]$File,
  [string[]]$Requires = @(),
  [switch]$Frontmatter
)
$ErrorActionPreference = "Stop"
$fail = @()
if (-not (Test-Path $File)) { Write-Host "MISSING FILE: $File"; exit 1 }
$content = Get-Content -Raw -Path $File

if ($Frontmatter) {
  if ($content -notmatch "(?s)^---\s*\r?\n.*?\r?\n---") { $fail += "no valid --- frontmatter block" }
  foreach ($k in @("name:", "description:", "tools:")) {
    if ($content -notmatch [regex]::Escape($k)) { $fail += "frontmatter missing key '$k'" }
  }
}
foreach ($r in $Requires) {
  if ($content -notmatch [regex]::Escape($r)) { $fail += "missing required content: '$r'" }
}
if ($fail.Count -gt 0) {
  Write-Host "CHECK FAILED for $File"
  $fail | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "CHECK PASSED for $File"
exit 0
```

- [ ] **Step 4: Verify the checker works (negative + positive)**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/nonexistent.md; echo "exit=$?"
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/qa-config.example.json -Requires '"projectKey"','"maskPatterns"','"stepTimeoutMs"'; echo "exit=$?"
```
Expected: first prints `MISSING FILE` and `exit=1`; second prints `CHECK PASSED` and `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add qa-agent/qa-config.example.json qa-agent/references/run-folder-contract.md qa-agent/tools/check-artifacts.ps1
git commit -m "feat(qa): scaffold config, run-folder contract, structural checker"
```

---

## Task 2: qa-story subagent

**Files:**
- Create: `qa-agent/agents/qa-story.md`

**Interfaces:**
- Consumes: `run-context.json` (`key`, `runFolder`).
- Produces: `story.json` per the contract (Task 1 Step 2). Later consumed by qa-test-writer, qa-gap-analyzer, qa-validator, qa-reviewer.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-story.md` with frontmatter:

```markdown
---
name: qa-story
description: Fetch a Jira story via the Atlassian MCP and normalize it into story.json (summary, description, atomic acceptance criteria, components, status).
tools:
  - Read
  - Write
  - mcp__claude_ai_Atlassian__getJiraIssue
  - mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql
model: claude-opus-4-8
---
```

Body MUST specify (exact strings required by the checker in bold):
- **Input:** read `run-context.json` from the run folder to get **`key`** and the run folder path.
- Fetch the issue with `mcp__claude_ai_Atlassian__getJiraIssue`.
- Normalize acceptance criteria into an array of atomic, testable items, each `{ id, text }` with ids `AC1, AC2, ...`. Split compound criteria into separate items.
- If the issue has no explicit AC field/section, derive candidate criteria from the description and set **`acSource: "inferred"`** (otherwise `"explicit"`).
- **Output:** write **`story.json`** with fields `key, summary, description, acceptanceCriteria, components, status, acSource`, plus a self-validation block **`_validation`** = `{ checklist: [{item,pass}], selfConfident, notes }`. Checklist items: every AC captured; each AC atomic & testable; components/status present.
- Return a one-line summary to the orchestrator (count of AC, acSource).

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-story.md -Frontmatter -Requires 'run-context.json','mcp__claude_ai_Atlassian__getJiraIssue','story.json','acSource','_validation','acceptanceCriteria'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-story.md
git commit -m "feat(qa): add qa-story subagent"
```

---

## Task 3: qa-test-writer subagent

**Files:**
- Create: `qa-agent/agents/qa-test-writer.md`

**Interfaces:**
- Consumes: `story.json`; on later iterations also `gap-report.json`.
- Produces: `test-cases.json` per contract. Consumed by qa-gap-analyzer, qa-test-executor, qa-validator.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-test-writer.md` with frontmatter:

```markdown
---
name: qa-test-writer
description: Generate AC-driven functional E2E test cases (happy path, negative, edge) from story.json into test-cases.json. No external calls.
tools:
  - Read
  - Write
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- **Input:** read **`story.json`**; if **`gap-report.json`** exists, read its `suggestions` and ADD cases to cover them without discarding existing valid cases.
- For every AC, produce at least one **happy**, one **negative**, and (where meaningful) one **edge** case.
- Each case: `{ id (TC1..), title, linkedAC: [acId], type, steps: [imperative UI steps], testData, expectedResult }`. Steps must be concrete and executable by a browser agent (semantic actions like "click the 'Submit' button", not CSS selectors).
- **Output:** write **`test-cases.json`** = `{ cases: [...], _validation: {...} }`. `_validation` checklist: every AC → ≥1 case; happy+negative+edge considered; steps executable & unambiguous; test data present.
- Return a one-line summary (case count, cases per type).

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-test-writer.md -Frontmatter -Requires 'story.json','gap-report.json','test-cases.json','linkedAC','happy','negative','edge','_validation'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-test-writer.md
git commit -m "feat(qa): add qa-test-writer subagent"
```

---

## Task 4: qa-gap-analyzer subagent

**Files:**
- Create: `qa-agent/agents/qa-gap-analyzer.md`

**Interfaces:**
- Consumes: `story.json`, `test-cases.json`.
- Produces: `gap-report.json` per contract. Consumed by orchestrator (loop decision) and qa-validator.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-gap-analyzer.md` with frontmatter:

```markdown
---
name: qa-gap-analyzer
description: Verify every acceptance criterion in story.json is covered by at least one case in test-cases.json; report coverage and concrete suggestions into gap-report.json.
tools:
  - Read
  - Write
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- **Input:** read **`story.json`** and **`test-cases.json`**.
- Build the AC→case coverage map. An AC is covered only if a case's `linkedAC` includes it AND the case's steps actually exercise it.
- **Output:** write **`gap-report.json`** = `{ covered, uncovered, suggestions, complete, _validation }`. `complete` is true iff `uncovered` is empty. `suggestions` are concrete missing-case descriptions the test-writer can act on. `_validation` checklist: coverage verdict matches test-cases; suggestions are specific.
- Return a one-line summary (covered/total, complete).

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-gap-analyzer.md -Frontmatter -Requires 'story.json','test-cases.json','gap-report.json','uncovered','suggestions','complete','_validation'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-gap-analyzer.md
git commit -m "feat(qa): add qa-gap-analyzer subagent"
```

---

## Task 5: qa-test-executor subagent

**Files:**
- Create: `qa-agent/agents/qa-test-executor.md`

**Interfaces:**
- Consumes: `test-cases.json`, `run-context.json` (for `appBaseUrl`, `config.safety`, `config.execution`, `config.app.login`).
- Produces: `results.json` + `screenshots/*.png` per contract. Consumed by qa-bug-logger, qa-reviewer, qa-validator.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-test-executor.md` with frontmatter:

```markdown
---
name: qa-test-executor
description: Execute each test case against the live app in a real browser via the Playwright MCP, capturing screenshots, console/network evidence, and per-case pass/fail/flaky/blocked status into results.json.
tools:
  - Read
  - Write
  - mcp__playwright__browser_navigate
  - mcp__playwright__browser_snapshot
  - mcp__playwright__browser_click
  - mcp__playwright__browser_type
  - mcp__playwright__browser_fill_form
  - mcp__playwright__browser_take_screenshot
  - mcp__playwright__browser_console_messages
  - mcp__playwright__browser_network_requests
  - mcp__playwright__browser_wait_for
  - mcp__playwright__browser_evaluate
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- **Input:** read **`run-context.json`** and **`test-cases.json`**.
- **Environment guard:** compare `appBaseUrl` against `config.safety.prodUrlPatterns`; if it matches and `allowProduction` is false, STOP and report that the run needs explicit production confirmation. (`prodUrlPatterns`)
- **Login session reuse:** if `config.app.login.required`, authenticate once at the start using the env vars named by `usernameEnv`/`passwordEnv` (read via a shell `echo $env:VAR`; NEVER print the value), then reuse the session. (`sessionReuse`)
- **Timeouts:** bound each step by `stepTimeoutMs` and the whole run by `maxRunMinutes`; a step timeout marks the case **`blocked`** and moves on. (`stepTimeoutMs`, `maxRunMinutes`)
- **Non-destructive posture:** prefer read/create; if a step is destructive and `destructiveActions="confirm"`, record it needs confirmation; track created data in `createdData` and clean up if `cleanupCreatedData`. (`destructiveActions`, `createdData`)
- Execute each case's steps via the Playwright MCP tools. Capture a screenshot per case (and on any failure) into `screenshots/`.
- **Flaky-retry:** on failure, retry once with fresh state; consistent failure → **`failed`**, pass-on-retry → **`flaky`**. (`flaky`)
- **Console/JS error findings:** collect uncaught JS + console errors per case via `browser_console_messages` and record in `jsErrorFindings` even when the assertion passes. (`jsErrorFindings`)
- One failing/blocked case never stops the rest. Unreachable URL / login failure → mark affected cases **`blocked`** with a reason.
- **Output:** write **`results.json`** = `{ cases: [{ id, status, steps, screenshots, consoleErrors, jsErrorFindings, createdData, reason }], _validation }`. `_validation` checklist: every planned case has a result; evidence per case; no case silently skipped; status justified by steps.
- Return a one-line summary (passed/failed/flaky/blocked counts).

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-test-executor.md -Frontmatter -Requires 'run-context.json','test-cases.json','mcp__playwright__browser_navigate','prodUrlPatterns','stepTimeoutMs','maxRunMinutes','flaky','jsErrorFindings','createdData','results.json','_validation'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-test-executor.md
git commit -m "feat(qa): add qa-test-executor subagent"
```

---

## Task 6: qa-bug-logger subagent (two-phase)

**Files:**
- Create: `qa-agent/agents/qa-bug-logger.md`

**Interfaces:**
- Consumes (Phase A): `results.json`, `story.json`, `run-context.json` (`config.severityMap`, `config.safety.maskPatterns`, `config.jira`). Consumes (Phase B): `bugs-proposed.json` + an approved-refs list from the orchestrator.
- Produces: `bugs-proposed.json` (Phase A), `bugs-created.json` (Phase B), per contract.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-bug-logger.md` with frontmatter:

```markdown
---
name: qa-bug-logger
description: Two-phase Jira bug logger. Phase A drafts bugs from failed tests (no Jira writes) with duplicate detection and PII masking. Phase B creates and links ONLY the user-approved bugs.
tools:
  - Read
  - Write
  - mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql
  - mcp__claude_ai_Atlassian__createJiraIssue
  - mcp__claude_ai_Atlassian__createIssueLink
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- The agent runs in one of two modes, chosen by the orchestrator's instruction: **`Phase A`** (propose) or **`Phase B`** (create).
- **`Phase A` — propose (NO Jira writes):**
  - Read **`results.json`**; for each case with status **`failed`**, draft a bug `{ ref (B1..), title, description, reproSteps, severity, linkedAC, testId, screenshots, possibleDuplicate }`.
  - Map severity via `config.severityMap`.
  - **Duplicate detection:** for each draft run `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql` (e.g. `project = <key> AND statusCategory != Done AND summary ~ "<keywords>"`) and set **`possibleDuplicate`** to matching keys. (`possibleDuplicate`)
  - **Masking:** before writing, redact any substring matching `config.safety.maskPatterns` from title/description/reproSteps. (`maskPatterns`)
  - Write **`bugs-proposed.json`** = `{ drafts: [...], _validation }`. `_validation` checklist: every failed test → a draft; severity mapped; dup-check ran; masking applied. Return control to the orchestrator; do NOT create anything.
- **`Phase B` — create (only after approval):**
  - Read **`bugs-proposed.json`** and the orchestrator-supplied list of approved `ref`s.
  - For each approved draft: `mcp__claude_ai_Atlassian__createJiraIssue` (type `config.jira.defaultBugType`), then `mcp__claude_ai_Atlassian__createIssueLink` to link the new bug to the story `key` (link type "Relates" or "Blocks").
  - Write **`bugs-created.json`** = `{ created: [{ ref, testId, key, url }], _validation }`. `_validation` checklist: every approved bug created + linked; keys/URLs returned.
- Return a one-line summary (drafted N / created M).

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-bug-logger.md -Frontmatter -Requires 'Phase A','Phase B','results.json','possibleDuplicate','maskPatterns','bugs-proposed.json','bugs-created.json','mcp__claude_ai_Atlassian__createJiraIssue','mcp__claude_ai_Atlassian__createIssueLink','_validation'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-bug-logger.md
git commit -m "feat(qa): add qa-bug-logger subagent (two-phase, approved)"
```

---

## Task 7: qa-reviewer subagent

**Files:**
- Create: `qa-agent/agents/qa-reviewer.md`

**Interfaces:**
- Consumes: `story.json`, `test-cases.json`, `gap-report.json`, `results.json`, `bugs-created.json`.
- Produces: `review.json` per contract. Consumed by orchestrator (report) and qa-validator.

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-reviewer.md` with frontmatter:

```markdown
---
name: qa-reviewer
description: Produce an objective QA sign-off — AC coverage %, pass/fail/flaky/blocked tallies, bugs logged, and a GO/NO-GO verdict — into review.json.
tools:
  - Read
  - Write
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- **Input:** read `story.json`, `test-cases.json`, `gap-report.json`, **`results.json`**, `bugs-created.json`.
- Compute `acCoveragePct`, `totalTests`, `passed`, `failed`, `flaky`, `blocked`, `bugsLogged`, and `blockers` (list of blocker-severity failures).
- **Verdict rule:** **`NO-GO`** if any AC is uncovered, any blocker-severity test failed, or coverage < 100% of testable AC; otherwise **`GO`**. (`GO`, `NO-GO`)
- **Output:** write **`review.json`** = `{ acCoveragePct, totalTests, passed, failed, flaky, blocked, bugsLogged, blockers, verdict, rationale, _validation }`. `_validation` checklist: verdict logically consistent with the numbers.
- Return the verdict + coverage as a one-line summary.

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-reviewer.md -Frontmatter -Requires 'results.json','review.json','acCoveragePct','GO','NO-GO','verdict','_validation'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-reviewer.md
git commit -m "feat(qa): add qa-reviewer subagent"
```

---

## Task 8: qa-validator subagent (independent per-stage verification)

**Files:**
- Create: `qa-agent/agents/qa-validator.md`

**Interfaces:**
- Consumes: a `stage` name (from the orchestrator) + that stage's input and output files in the run folder; may re-read Jira for the story stage.
- Produces: `validation/<stage>.json` per contract. Consumed by the orchestrator (pass/fail + gaps → fix-retry decision).

- [ ] **Step 1: Write the agent file**

Create `qa-agent/agents/qa-validator.md` with frontmatter:

```markdown
---
name: qa-validator
description: Independently verify that a completed pipeline stage missed nothing. Re-derives expectations from the source (not the producing agent's output) and writes validation/<stage>.json with pass/fail and concrete gaps.
tools:
  - Read
  - Write
  - mcp__claude_ai_Atlassian__getJiraIssue
model: claude-opus-4-8
---
```

Body MUST specify (bold = required substrings):
- The orchestrator passes the **`stage`** name and the run folder. Do NOT redo the work — CHECK the stage's output against its inputs and the stage checklist.
- **Independence:** for the `story` stage, re-read the Jira issue with `mcp__claude_ai_Atlassian__getJiraIssue` and confirm no AC was dropped, rather than trusting `story.json`.
- Apply the **per-stage checklist**:
  - **`story`**: every AC captured & atomic/testable; nothing dropped from description; components/status present.
  - **`test-writer`**: every AC → ≥1 case; happy+negative+edge covered; steps executable; test data present.
  - **`gap-analyzer`**: coverage verdict matches `test-cases.json`.
  - **`test-executor`**: every planned case has a result; evidence per case; no case skipped; status justified.
  - **`bug-logger-propose`**: every failed test → a draft; severity mapped; dup-check ran; masking applied.
  - **`bug-logger-create`**: every approved bug created + linked; keys/URLs returned.
  - **`reviewer`**: verdict consistent with numbers.
- **Output:** write **`validation/<stage>.json`** = `{ stage, pass, gaps: [{item, detail}], checklist: [{item, pass}], iteration }`. `pass` is false if any checklist item fails; `gaps` are concrete and actionable by the producing agent.
- Return `pass` + gap count as a one-line summary.

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/agents/qa-validator.md -Frontmatter -Requires 'stage','validation/','gaps','checklist','mcp__claude_ai_Atlassian__getJiraIssue','bug-logger-propose','bug-logger-create','iteration'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/agents/qa-validator.md
git commit -m "feat(qa): add qa-validator subagent (independent per-stage checks)"
```

---

## Task 9: qa-setup command

**Files:**
- Create: `qa-agent/commands/qa-setup.md`

**Interfaces:**
- Produces: a `.qa-config.json` in the current project root (interactively), matching `qa-config.example.json`.

- [ ] **Step 1: Write the command file**

Create `qa-agent/commands/qa-setup.md` with frontmatter:

```markdown
---
name: qa-setup
description: Interactively scaffold .qa-config.json for the QA orchestrator (app URL, Jira project key, login env var names, safety options).
tools:
  - Read
  - Write
  - AskUserQuestion
---
```

Body MUST specify (bold = required substrings):
- If **`.qa-config.json`** already exists, show it and ask whether to overwrite before proceeding.
- Ask for: Jira `projectKey`; app `baseUrl`; whether login is required and, if so, `loginUrl` + the env var NAMES for username/password (never the values); whether prod runs are allowed.
- Write **`.qa-config.json`** to the project root using `qa-config.example.json` as the template, filling answers and keeping the `safety`, `severityMap`, and `execution` defaults.
- Remind the user to set the referenced env vars (e.g. `$env:QA_USER`, `$env:QA_PASS`) and to authorize the Atlassian connector in claude.ai settings.

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/commands/qa-setup.md -Frontmatter -Requires '.qa-config.json','baseUrl','projectKey','usernameEnv','AskUserQuestion'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/commands/qa-setup.md
git commit -m "feat(qa): add /qa-setup config scaffolder command"
```

---

## Task 10: qa-run orchestrator command

**Files:**
- Create: `qa-agent/commands/qa-run.md`

**Interfaces:**
- Consumes: `$ARGUMENTS` (story key + optional `--rerun`/`--resume`), `.qa-config.json`, and every subagent from Tasks 2–8 via the Task tool.
- Produces: the run folder, `report.md`, and `report.html` (Artifact).

- [ ] **Step 1: Write the command file**

Create `qa-agent/commands/qa-run.md` with frontmatter:

```markdown
---
name: qa-run
description: Orchestrate the full QA pipeline for a Jira story — story → tests → gap-check → execute → bugs → review — with independent per-stage validation and human approval gates.
tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
  - Artifact
---
```

Body MUST specify (bold = required substrings) — a numbered orchestration procedure:
- Parse **`$ARGUMENTS`**: the story key and optional flags **`--rerun`** / **`--resume`**.
- **Load config:** read **`.qa-config.json`**; if missing, tell the user to run **`/qa-setup`** and stop.
- **Preflight:** confirm the Atlassian connector is authorized (attempt a lightweight read; on auth error, instruct the user to authorize it in claude.ai connector settings and stop). **Environment guard:** if `baseUrl` matches `safety.prodUrlPatterns` and `allowProduction` is false, require explicit confirmation. (`Environment guard`)
- **Create run folder** `<outputDir>/<KEY>_<timestamp>/` (get the timestamp via a Bash `date +%Y%m%d-%H%M%S` call) and write **`run-context.json`**.
- **Validation rule (apply after every producing stage):** dispatch **`qa-validator`** for that stage; if `pass=false`, send `gaps` back to the stage's agent and re-run it, **max 2 fix-retries**; if still failing, ask the user to proceed/stop/fix. (`max 2`)
- Pipeline (each dispatched with the Task tool, passing the run folder path):
  1. **`qa-story`** → validate.
  2. **`qa-test-writer`** → validate.
  3. **`qa-gap-analyzer`** → validate; if `complete=false`, loop to `qa-test-writer` (**max 2 iterations**), then flag remaining gaps.
  4. **Test-plan approval gate:** present the case list; wait for the user's `go` before execution. (`Test-plan approval gate`)
  5. **`qa-test-executor`** → validate.
  6. **`qa-bug-logger`** in **`Phase A`** → validate.
  7. **Bug approval gate:** present numbered drafts (title, severity, failed test, possibleDuplicate); accept `all`/`none`/`1,3,4`/edits. (`Bug approval gate`)
  8. **`qa-bug-logger`** in **`Phase B`** with the approved refs → validate.
  9. **`qa-reviewer`** → validate.
- **`--resume`:** locate the latest run folder for the key and restart from the first missing output file.
- **`--rerun`:** re-execute only `failed`/`flaky` cases from the latest run; for previously-logged bugs whose test now passes, PROPOSE a Jira transition (via `getTransitionsForJiraIssue`/`transitionJiraIssue`) and apply only after approval.
- **Report:** write **`report.md`** and publish **`report.html`** as an Artifact — summary, GO/NO-GO, **traceability matrix** (AC ↔ test ↔ result ↔ bug), tallies, coverage %, proposed vs. created bugs, screenshot links, and the **validation summary** (per-stage clean/retries/escalated). Before writing either report, redact any substring matching `safety.maskPatterns` (**mask** secrets/PII — reports may be shared). (`traceability matrix`, `validation summary`, `maskPatterns`)

- [ ] **Step 2: Verify structure**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File qa-agent/commands/qa-run.md -Frontmatter -Requires '$ARGUMENTS','--rerun','--resume','.qa-config.json','/qa-setup','Environment guard','qa-story','qa-test-writer','qa-gap-analyzer','qa-test-executor','qa-bug-logger','qa-reviewer','qa-validator','Phase A','Phase B','Test-plan approval gate','Bug approval gate','max 2','traceability matrix','validation summary','report.html'
```
Expected: `CHECK PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa-agent/commands/qa-run.md
git commit -m "feat(qa): add /qa-run orchestrator command"
```

---

## Task 11: Install script, README, and global deployment

**Files:**
- Create: `qa-agent/install.ps1`
- Create: `qa-agent/README.md`

**Interfaces:**
- Consumes: everything in `qa-agent/agents/` and `qa-agent/commands/`.
- Produces: deployed copies in `~/.claude/agents/` and `~/.claude/commands/`.

- [ ] **Step 1: Write the install script**

Create `qa-agent/install.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $HOME ".claude"
New-Item -ItemType Directory -Force -Path (Join-Path $dest "agents") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest "commands") | Out-Null
Copy-Item -Force (Join-Path $src "agents\*.md") (Join-Path $dest "agents")
Copy-Item -Force (Join-Path $src "commands\*.md") (Join-Path $dest "commands")
Write-Host "Installed QA orchestrator to $dest"
Get-ChildItem (Join-Path $dest "agents") -Filter "qa-*.md" | ForEach-Object { Write-Host "  agent:   $($_.Name)" }
Get-ChildItem (Join-Path $dest "commands") -Filter "qa-*.md" | ForEach-Object { Write-Host "  command: $($_.Name)" }
```

- [ ] **Step 2: Write the README**

Create `qa-agent/README.md` covering: what it is; prerequisites (authorize Atlassian + Playwright MCP; set `QA_USER`/`QA_PASS` env vars); install (`pwsh qa-agent/install.ps1`); first-run (`/qa-setup`); usage (`/qa-run PROJ-123`, `--rerun`, `--resume`); the three approval gates; where results land (`qa-runs/`); and the known Jira screenshot-attachment limitation.

- [ ] **Step 3: Run the install and verify deployment**

Run:
```bash
pwsh qa-agent/install.ps1
pwsh qa-agent/tools/check-artifacts.ps1 -File "$HOME/.claude/agents/qa-story.md" -Frontmatter -Requires 'story.json'
pwsh qa-agent/tools/check-artifacts.ps1 -File "$HOME/.claude/commands/qa-run.md" -Frontmatter -Requires 'qa-validator'
ls "$HOME/.claude/agents/qa-"*.md "$HOME/.claude/commands/qa-"*.md
```
Expected: install prints all 7 agents + 2 commands; both checks print `CHECK PASSED`; `ls` lists 7 `qa-*` agents and 2 `qa-*` commands.

- [ ] **Step 4: Remove the stale monolithic agent**

The old single-file `~/.claude/agents/qa-orchestrator.md` (Slack/Anthropic-API era) is superseded. Confirm with the user, then:
```bash
rm "$HOME/.claude/agents/qa-orchestrator.md"
```
(If the user wants to keep it, skip — the new files use distinct `qa-*` names and won't collide.)

- [ ] **Step 5: Commit**

```bash
git add qa-agent/install.ps1 qa-agent/README.md
git commit -m "feat(qa): add install script and README; deploy globally"
```

---

## Task 12: End-to-end smoke verification (guided)

**Files:**
- None (verification only). Uses a temporary fixture run folder.

**Interfaces:**
- Consumes: the deployed agents/commands and a hand-written fixture `story.json`.

- [ ] **Step 1: Create a fixture to test file-handoff logic without Jira/browser**

Create a temp run folder and a minimal `story.json`, then dispatch ONLY `qa-test-writer` and `qa-gap-analyzer` (they make no external calls) to confirm the file contract works end to end:

```bash
mkdir -p /c/tmp/qa-smoke/qa-runs/SMOKE-1_fixture
cat > /c/tmp/qa-smoke/qa-runs/SMOKE-1_fixture/story.json <<'JSON'
{ "key": "SMOKE-1", "summary": "Login", "description": "User can log in",
  "acceptanceCriteria": [ { "id": "AC1", "text": "Valid credentials log the user in" },
                          { "id": "AC2", "text": "Invalid credentials show an error" } ],
  "components": [], "status": "To Do", "acSource": "explicit" }
JSON
```

- [ ] **Step 2: Dispatch qa-test-writer against the fixture**

In Claude Code, run the `qa-test-writer` subagent pointed at `/c/tmp/qa-smoke/qa-runs/SMOKE-1_fixture`. Expected: it creates `test-cases.json` with ≥1 case per AC and a `_validation` block.

- [ ] **Step 3: Dispatch qa-gap-analyzer against the fixture**

Run `qa-gap-analyzer` on the same folder. Expected: `gap-report.json` with `complete: true` and both AC1/AC2 in `covered`.

- [ ] **Step 4: Verify fixture outputs**

Run:
```bash
pwsh qa-agent/tools/check-artifacts.ps1 -File /c/tmp/qa-smoke/qa-runs/SMOKE-1_fixture/test-cases.json -Requires 'AC1','AC2','_validation'
pwsh qa-agent/tools/check-artifacts.ps1 -File /c/tmp/qa-smoke/qa-runs/SMOKE-1_fixture/gap-report.json -Requires '"complete"','AC1','AC2'
```
Expected: both `CHECK PASSED`.

- [ ] **Step 5: Full live run (manual, requires connectors + config)**

With the Atlassian + Playwright MCP authorized, env vars set, and `/qa-setup` completed in a real project, run `/qa-run <REAL-KEY>` and confirm: run folder created, both approval gates prompt, `report.md` + `report.html` produced, and no bug is created without approval. Record any issues as follow-ups.

- [ ] **Step 6: Commit any fixes surfaced by the smoke test**

```bash
git add -A
git commit -m "fix(qa): address issues found in smoke verification"
```

---

## Notes for the implementer

- Subagents receive ONLY their own `.md` file at runtime — never rely on cross-file prose. Each agent's I/O contract must be fully restated in its own body (the plan enforces this via the required substrings).
- Never print secret values. Read env vars for existence/use, but keep them out of logs, `report.md`, screenshots, and Jira.
- The checker is a structural gate, not a semantic one; the real semantic verification is the guided smoke test (Task 12).
- Keep agent bodies focused and imperative — they are prompts, so ambiguity becomes runtime behavior.
