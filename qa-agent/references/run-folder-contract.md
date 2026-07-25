# Run Folder Contract

This is the canonical reference for the per-run folder layout and the exact JSON
schema of every file inside it. Every subagent reads and writes only files inside
the run folder path it is given — there is no shared memory between subagents.

## Run folder tree

```
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
├── report.md
├── report.html
└── bug-report.html       # mandatory whenever bugs-proposed.json has >= 1 draft
```

### Report files (written by the `/qa-run` orchestrator, not by a subagent)

| File | When | Contents |
| --- | --- | --- |
| `report.md` | every run | Human-readable run summary: verdict, traceability matrix, tallies, coverage, bugs, screenshot paths, validation summary. |
| `report.html` | every run | Same content as a self-contained HTML page; published as an Artifact. |
| `bug-report.html` | **whenever `bugs-proposed.json` has ≥1 draft** | One detail card per bug (all standard fields: description, numbered repro steps, expected vs actual, console/network errors, duplicates, recommendation, discovered date) plus a summary table, a "not filed" section for `blocked` cases, and a passed-case table. Every screenshot is embedded as a base64 `data:image/png;base64,...` URI at full HD size via `qa-agent/tools/embed-screenshots.js` — never by file path, which the Artifact CSP blocks. Published as an Artifact. |

Screenshots under `screenshots/` are captured by `qa-test-executor` at a 1920×1080 viewport as full-page PNGs (≥1280px wide). `embed-screenshots.js` enforces that floor and hard-fails rather than publishing degraded or unembedded evidence.

## File schemas

### `run-context.json`
```
{ key, appBaseUrl, config, bugProjectKey, mode: "run|rerun|resume", runFolder, timestamp }
```
**`config.app.login`** — how the executor authenticates: `{ required, loginUrl, usernameEnv, passwordEnv, passwordless, notes, sessionReuse }`.

| Field | Meaning |
| --- | --- |
| `usernameEnv` / `passwordEnv` | Env-var **names** (never values) holding the credentials. Resolved from the OS env first, then a git-ignored `.qa-secrets`/`.env`. |
| `passwordless` | `true` when the app authenticates on an **identifier alone** — an employee number, national ID, membership number, magic link. `passwordEnv` is then `null`. |
| `notes` | Free-text guidance on how this app's login actually works (which field takes the identifier, what to click, quirks). The executor reads and follows it. |
| `sessionReuse` | `true` means the executor logs in **once before the first case** and reuses the session throughout. |

**A passwordless login is not a missing credential.** With `passwordless: true` (or `passwordEnv: null`) the executor resolves only the identifier and must never block a case for the absent password. `qa-test-writer` likewise must not write password steps or put a password in `testData`. Because `sessionReuse` means auth is already established, test cases start from the authenticated state rather than repeating login steps — except cases that deliberately test the auth boundary (unauthenticated access, route guards, logout).

`bugProjectKey` is the Jira project `qa-bug-logger` files bugs against for this run — chosen once by the user at run-folder creation (section 3 of `/qa-run`) and may differ from `config.jira.projectKey` (the configured default, offered as the recommended option). The story `key` itself is unaffected — every bug still links back to the same story regardless of which project it's filed in. Older run folders created before this field existed won't have it; `qa-bug-logger` falls back to `config.jira.projectKey` in that case.

### `story.json`
```
{ key, summary, description, acceptanceCriteria: [{ id, text }], components: [..], status, acSource: "explicit|inferred", _validation: {...} }
```

### `test-cases.json`
```
{ cases: [{ id, title, linkedAC: [acId], type: "happy|negative|edge", steps: [str], testData: {}, expectedResult }], _validation: {...} }
```

### `gap-report.json`
```
{ covered: [acId], uncovered: [acId], suggestions: [str], complete: bool, _validation: {...} }
```

### `results.json`
```
{ cases: [{ id, status: "passed|failed|flaky|blocked", steps: [{ step, ok, note }], screenshots: [path], consoleErrors: [str], jsErrorFindings: [str], createdData: [str], reason }], _validation: {...} }
```

### `bugs-proposed.json`
```
{ drafts: [{ ref, title, description, severity, priority, status, linkedAC: [acId], testId, testIds: [caseId],
             environment, reproSteps: [str], expectedResult, actualResult, consoleErrors: [str],
             screenshots: [path], possibleDuplicate: [key], recommendation, discoveredDate }],
  _validation: {...} }
```

`testId` is the **primary** originating case id; **`testIds` lists every case the draft accounts for**, primary first. They differ when `qa-bug-logger` consolidates several cases sharing one root cause into a single draft (`testId: "TC1"`, `testIds: ["TC1", "TC3"]`).

**Consumers must match failed cases to drafts through `testIds`**, treating the singular `testId` only as a fallback for run folders written before `testIds` existed. Matching on `testId` alone makes every consolidated secondary case look untriaged, which pushes `qa-reviewer` onto its happy-path heuristic and can yield two contradictory severity verdicts for one defect.

### `bugs-created.json`
```
{ created: [{ ref, testId, key, url }], _validation: {...} }
```

### `review.json`
```
{ acCoveragePct, totalTests, passed, failed, flaky, blocked, bugsLogged, blockers: [str], verdict: "GO|NO-GO", rationale, _validation: {...} }
```

### `validation/<stage>.json`
```
{ stage, pass: bool, gaps: [{ item, detail }], checklist: [{ item, pass }], iteration }
```

### `aio-sync.json` (optional — written by `qa-test-sync` only when `config.aio.enabled`)
```
{ project, folderID, folderName, storyJiraId, createdCount, total,
  cases: [ { testId, aioKey, aioID, title } | { testId, error, status } ],
  _validation: {...} }
```
Note: the AIO folder (named with the story key) must be created once in the AIO Cases UI beforehand — the AIO API cannot create folders. Runs once per story.
