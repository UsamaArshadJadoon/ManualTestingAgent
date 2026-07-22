# QA AZM Digital Agent

> An autonomous, multi-agent QA system for **Claude Code** (VS Code) that turns a single Jira story key into a fully executed, evidence-backed, approval-gated QA report.

**Developed by:** Usama Arshad Jadoon &nbsp;·&nbsp; **Role:** QC Lead &nbsp;·&nbsp; **Company:** AZM Digital

---

## What it does

You type one command:

```
/qa-run ABYR-2167
```

…and the agent reads the Jira story, designs the tests, drives your live app in a **real browser**, and hands you a signed-off report — pausing only at two human approval gates. Behind that one command, an **orchestrator** dispatches seven specialist subagents and re-checks every stage with an independent validator.

**On our live run (Jira `ABYR-2167` — “Client Profile View & Risk Results”):** 12 acceptance criteria → 26 test cases → **22 passed · 2 failed · 2 blocked**, 7 findings surfaced, GO ⚠ verdict — with real screenshots captured for every case.

## How the agents work — step by step

Each agent reads the previous stage's file from a shared run folder, does its job, writes its own file for the next agent, and is independently re-checked by the validator before the pipeline advances. Two human gates guard the consequential actions.

> 🔀 **[Open the interactive animated diagram →](https://claude.ai/code/artifact/4a0f6fce-63da-456a-af85-c74d1c415042)** — press **Play** to watch a story flow through every agent, or click any stage to see what it reads and writes.

```mermaid
flowchart TD
    U(["You: /qa-run ABYR-2167"]):::you
    U --> ORCH{{"Orchestrator (runs the whole pipeline)"}}:::orch
    ORCH == run-context.json ==> S1["1 - qa-story"]:::agent
    S1 == story.json ==> S2["2 - qa-test-writer"]:::agent
    S2 == test-cases.json ==> S3["3 - qa-gap-analyzer"]:::agent
    S3 == gap-report.json ==> G1{"Gate 1: you approve the test plan"}:::gate
    G1 == go ==> S4["4 - qa-test-executor (real browser)"]:::agent
    S4 == "results.json + screenshots" ==> S5A["5 - qa-bug-logger - Phase A (draft only)"]:::agent
    S5A == bugs-proposed.json ==> G2{"Gate 2: you approve which bugs to file"}:::gate
    G2 == approved refs ==> S5B["6 - qa-bug-logger - Phase B (create in Jira)"]:::agent
    S5B == bugs-created.json ==> S6["7 - qa-reviewer"]:::agent
    S6 == "review.json (GO / NO-GO)" ==> R[["report.html + bug-report.html"]]:::report

    VAL{{"qa-validator - independent check after every stage; on a gap it loops the stage back, max 2 retries"}}:::val
    S1 -.-> VAL
    S3 -.-> VAL
    S4 -.-> VAL
    S6 -.-> VAL
    VAL -. gaps .-> ORCH

    classDef you fill:#6d5ae0,stroke:#4b3ec9,color:#fff;
    classDef orch fill:#334155,stroke:#1e293b,color:#fff;
    classDef agent fill:#0e7c86,stroke:#0a5960,color:#fff;
    classDef val fill:#b9791a,stroke:#8a5a12,color:#fff;
    classDef gate fill:#3b6fd4,stroke:#2a52a0,color:#fff;
    classDef report fill:#1f9d57,stroke:#167243,color:#fff;
```

**How to read it:** the flow runs **top → bottom**, 1 through 7. Each **bold arrow is the file** one agent writes for the next. Diamonds are the **two human gates** (nothing runs against the app before Gate 1; nothing reaches Jira before Gate 2). The amber **qa-validator** independently re-checks every stage and dashed-loops a stage back to the orchestrator if it finds a gap.

**Legend:** 🟣 you · ⬛ orchestrator · 🟢 agent · 🟠 validator · 🔵 human gate · 🟩 published reports.

## The pipeline — seven agents + a validator

| # | Agent | Reads → Writes | Job |
|---|-------|----------------|-----|
| 1 | `qa-story` | Jira → `story.json` | Fetch the story; normalize acceptance criteria into atomic, testable items |
| 2 | `qa-test-writer` | `story.json` → `test-cases.json` | Write happy / negative / edge cases per AC |
| 3 | `qa-gap-analyzer` | + → `gap-report.json` | Prove every AC is covered by a real test |
| — | **Gate #1** | — | You approve the test plan before anything runs |
| 4 | `qa-test-executor` | live app → `results.json` + screenshots | Drive the app via Playwright; capture evidence & console errors |
| 5 | `qa-bug-logger` | `results.json` → `bugs-proposed.json` / `bugs-created.json` | Draft detailed bugs (Phase A); create only approved ones in Jira (Phase B) |
| — | **Gate #2** | — | You approve which bugs get filed to Jira |
| 6 | `qa-reviewer` | all → `review.json` | Compute coverage + a GO / NO-GO verdict |
| ★ | `qa-validator` | after every stage | Independently re-check each stage from the source; loop back on gaps (max 2) |

Every subagent runs isolated with no shared memory — all data flows through JSON files in a per-run folder, giving a full audit trail.

## Repository layout

```
qa-agent/
├── commands/            /qa-run and /qa-setup
├── agents/              the 7 qa-* subagents
├── references/          run-folder JSON contract
├── tools/               structural checker
├── install.ps1          deploys agents/commands to ~/.claude
├── qa-config.example.json
└── README.md            full documentation
docs/superpowers/        design spec + implementation plan
```

## Quick start

1. **Authorize connectors** in claude.ai → Settings → Connectors: **Atlassian (Jira)** and **Playwright**.
2. **Install** (Windows PowerShell 5.1):
   ```powershell
   powershell -File qa-agent\install.ps1
   ```
   Copies the 7 agents + 2 commands into `~/.claude` (works in every project).
3. **Configure** your project — run `/qa-setup` (writes `.qa-config.json`, scaffolds a git-ignored `.qa-secrets`, hardens `.gitignore`).
4. **Provide credentials** — fill the git-ignored `.qa-secrets`, or set `$env:QA_USER` / `$env:QA_PASS`.
5. **Run** — `/qa-run <STORY-KEY>` (add `--rerun` to re-test prior failures, `--resume` to continue an interrupted run).

See [`qa-agent/README.md`](qa-agent/README.md) for the complete documentation.

## Safety & credential handling

- **Two human gates** — nothing runs against your app, and nothing is written to Jira, without your approval.
- **Production guard** — a production-looking URL stops the run until explicitly allowed.
- **Credentials never committed** — `.qa-config.json` stores only env-var *names*; real values live in a **git-ignored `.qa-secrets`** file (or OS env vars), are masked in every report/bug, and the executor **auto-deletes the browser snapshot scratch** after each run.
- **Self-correcting** — the validator re-checks every stage and loops back on gaps.
- **Non-destructive** — prefers read/create, reverts edits; retries flaky cases before calling them real bugs.

## Known limitation

The Atlassian MCP has no attachment-upload tool, so bugs reference screenshots by their run-folder path rather than uploading them. The generated `bug-report.html` embeds those screenshots inline for easy sharing.

---

## Credits

**QA AZM Digital Agent** — Developed by **Usama Arshad Jadoon**, QC Lead, **AZM Digital**.
Built on Claude Code with a multi-agent, file-based orchestration architecture.
