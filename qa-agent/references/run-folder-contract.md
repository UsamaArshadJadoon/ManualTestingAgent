# Run Folder Contract

This is the canonical reference for the per-run folder layout and the exact JSON
schema of every file inside it. Every subagent reads and writes only files inside
the run folder path it is given — there is no shared memory between subagents.

## Run folder tree

```text
qa-runs/<PROJ-KEY>_<runId>/
├── run-context.json
├── story.json
├── test-cases.json
├── gap-report.json
├── results.json
├── screenshots/
├── bugs-proposed.json
├── bugs-created.json
├── review.json
├── validation/
│   └── <stage>.json
├── aio-sync.json         # optional: written by qa-test-sync when config.aio.enabled
├── wireframe-spec.md     # optional: transcribed design contract, when the story has one
├── process-steps.json    # optional: narrative for the process log, if one is produced
├── fixtures/             # optional: files the executor manufactures for upload fields
├── report.md
├── report.html
├── bug-report.html       # mandatory whenever bugs-proposed.json has >= 1 draft
└── process-report.html   # optional: step-by-step run log
```

### Report files (written by the `/qa-run` orchestrator, not by a subagent)

| File | When | Contents |
| --- | --- | --- |
| `report.md` | every run | Human-readable run summary: verdict, traceability matrix, tallies, coverage, bugs, screenshot paths, validation summary. |
| `report.html` | every run | Same content as a self-contained HTML page; published as an Artifact. |
| `bug-report.html` | **whenever `bugs-proposed.json` has ≥1 draft** | One detail card per bug (all standard fields: description, numbered repro steps, expected vs actual, console/network errors, duplicates, recommendation, discovered date) plus a summary table, a "not filed" section for `blocked` cases, and a passed-case table. Every screenshot is embedded as a base64 `data:image/png;base64,...` URI at full HD size via `qa-agent/tools/embed-screenshots.js` — never by file path, which the Artifact CSP blocks. Published as an Artifact. |

| `process-report.html` | optional | Step-by-step log of the run — each request, each stage, each gate — led by the pipeline diagram. Rendered by `gen-process-report.js` from `process-steps.json`. |

Screenshots under `screenshots/` are captured by `qa-test-executor` at a 1920×1080 viewport as full-page PNGs (≥1280px wide). `embed-screenshots.js` enforces that floor and hard-fails rather than publishing degraded or unembedded evidence.

**A frame can clear the 1280px floor and still be unreadable.** When the browser reports a CSS viewport of twice its resize width (device pixel ratio 0.5), the app lays out at double width and renders at half scale, so a full-page capture is mostly empty with the content marooned in one corner. Run `qa-agent/tools/crop-screenshots.js <screenshots-dir> --scale 2` before embedding: it crops each PNG to its real content bounds and doubles what remains, leaving already-tight frames untouched.

### `wireframe-spec.md` (optional — written by the orchestrator when the story references a design)

Many stories define an acceptance criterion by reference to an attached wireframe (*"must be as the attached wireframe"*), which makes the design itself the criterion. The MCP cannot download attachment content, so when a human supplies the image the orchestrator transcribes it here as a **checkable contract**: each item marked `[CONFIRMED]` (legible beyond doubt) or `[UNCERTAIN]` (a low-confidence glyph or layout read).

`qa-test-writer`, `qa-test-executor` and `qa-bug-logger` all read it when present. Three rules govern its use, and each exists because the alternative produces a wrong defect:

- **Never found a defect on an `[UNCERTAIN]` item** — escalate it for a human to settle.
- **Where the wireframe and the story's written rules disagree, the written criteria win** — but say so and escalate, because that is a specification conflict, not a code defect.
- **A wireframe may show a before/after comparison.** The "before" panel is what the story exists to remove; asserting the product should match it inverts the ticket.

### `verification.json` (written by `qa-test-executor` in defect re-verification mode)

Before the bug approval gate, every draft in `bugs-proposed.json` is re-confirmed against the **running application** — not against `results.json`. `qa-test-executor` re-measures the live DOM for the condition each draft asserts and records `{ ref, status, observation, method, checkedAt }`, mirroring the same block into each draft as `liveVerification`.

`status` is `reproduced`, `not-reproduced`, or `inconclusive`. The distinction is load-bearing:

- **This is the only stage that re-observes the product.** `qa-validator` re-derives expectations and re-reads recorded evidence, but it has no browser — so a mis-measured or since-fixed defect survives every other check and reaches a developer as fact.
- **A `not-reproduced` draft must never be presented as an approvable bug**, only as a no-longer-reproducing finding with what was seen instead.
- **`inconclusive` must never be rounded up to `reproduced`.** State what blocked the check and let a human weigh it.
- **Re-redact credentials before any capture taken here.** Redaction applies to a rendered page and does not survive navigation; a fresh load re-renders the login identifier in the app's chrome.

### `process-steps.json` (optional — per-run narrative for the process log)

`{ "steps": [ { "phase", "actor", "title", "said", "html" } ] }` — `actor` is one of `req` | `stage` | `gate` | `check`; `said` is a verbatim request or `null`. `gen-process-report.js` renders these and exits non-zero if the file is absent: a process log invented by the renderer would be fiction.

## File schemas

### `run-context.json`

```text
{ key, appBaseUrl, config, bugProjectKey, mode: "run|rerun|resume", runFolder, timestamp }
```

**`config.app.login`** — how the executor authenticates: `{ required, loginUrl, usernameEnv, passwordEnv, passwordless, notes, sessionReuse }`.

| Field | Meaning |
| --- | --- |
| `usernameEnv` / `passwordEnv` | Env-var **names** (never values) holding the credentials. Resolved from the OS env first, then a git-ignored `.qa-secrets`/`.env`. |
| `passwordless` | `true` when the app authenticates on an **identifier alone** — a contractor ID, national ID, employee number, magic link. `passwordEnv` is then `null`. |
| `notes` | Free-text guidance on how this app's login actually works (which field takes the identifier, what to click, quirks). The executor reads and follows it. |
| `sessionReuse` | `true` means the executor logs in **once before the first case** and reuses the session throughout. |

**A passwordless login is not a missing credential.** With `passwordless: true` (or `passwordEnv: null`) the executor resolves only the identifier and must never block a case for the absent password. `qa-test-writer` likewise must not write password steps or put a password in `testData`. Because `sessionReuse` means auth is already established, test cases start from the authenticated state rather than repeating login steps — except cases that deliberately test the auth boundary (unauthenticated access, route guards, logout).

`bugProjectKey` is the Jira project `qa-bug-logger` files bugs against for this run — chosen once by the user at run-folder creation (section 3 of `/qa-run`) and may differ from `config.jira.projectKey` (the configured default, offered as the recommended option). The story `key` itself is unaffected — every bug still links back to the same story regardless of which project it's filed in. Older run folders created before this field existed won't have it; `qa-bug-logger` falls back to `config.jira.projectKey` in that case.

### `story.json`

```text
{ key, summary, description, acceptanceCriteria: [{ id, text }], components: [..], status, acSource: "explicit|inferred", _validation: {...} }
```

### `test-cases.json`

```text
{ cases: [{ id, title, linkedAC: [acId], type: "happy|negative|edge", steps: [str], testData: {}, expectedResult }], _validation: {...} }
```

### `gap-report.json`

```text
{ covered: [acId], uncovered: [acId], suggestions: [str], complete: bool, _validation: {...} }
```

### `results.json`

```text
{ cases: [{ id, status: "passed|failed|flaky|blocked", steps: [{ step, ok, note }], screenshots: [path], consoleErrors: [str], jsErrorFindings: [str], createdData: [str], reason }], _validation: {...} }
```

### `bugs-proposed.json`

```text
{ drafts: [{ ref, title, description, severity, priority, status, linkedAC: [acId], testId, testIds: [caseId],
             environment, reproSteps: [str], expectedResult, actualResult, consoleErrors: [str],
             screenshots: [path], possibleDuplicate: [key], recommendation, discoveredDate }],
  _validation: {...} }
```

`testId` is the **primary** originating case id; **`testIds` lists every case the draft accounts for**, primary first. They differ when `qa-bug-logger` consolidates several cases sharing one root cause into a single draft (`testId: "TC1"`, `testIds: ["TC1", "TC3"]`).

**Consumers must match failed cases to drafts through `testIds`**, treating the singular `testId` only as a fallback for run folders written before `testIds` existed. Matching on `testId` alone makes every consolidated secondary case look untriaged, which pushes `qa-reviewer` onto its happy-path heuristic and can yield two contradictory severity verdicts for one defect.

### `bugs-created.json`

```text
{ created: [{ ref, testId, key, url }], _validation: {...} }
```

### `review.json`

```text
{ acCoveragePct, totalTests, passed, failed, flaky, blocked, bugsLogged, blockers: [str], verdict: "GO|NO-GO", rationale, _validation: {...} }
```

### `validation/<stage>.json`

```text
{ stage, pass: bool, gaps: [{ item, detail }], checklist: [{ item, pass }], iteration }
```

### `aio-sync.json` (optional — written by `qa-test-sync` only when `config.aio.enabled`)

```text
{ project, folderID, folderName, storyJiraId, createdCount, total,
  cases: [ { testId, aioKey, aioID, title } | { testId, error, status } ],
  _validation: {...} }
```

Note: the AIO folder (named with the story key) must be created once in the AIO Cases UI beforehand — the AIO API cannot create folders. Runs once per story.
