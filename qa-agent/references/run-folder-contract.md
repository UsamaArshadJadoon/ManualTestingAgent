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
└── report.html
```

## File schemas

### `run-context.json`
```
{ key, appBaseUrl, config, bugProjectKey, mode: "run|rerun|resume", runFolder, timestamp }
```
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
{ drafts: [{ ref, title, description, reproSteps: [str], severity, linkedAC: [acId], testId, screenshots: [path], possibleDuplicate: [key] }], _validation: {...} }
```

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
