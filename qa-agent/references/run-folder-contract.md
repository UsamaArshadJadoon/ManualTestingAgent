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
├── report.md
└── report.html
```

## File schemas

### `run-context.json`
```
{ key, appBaseUrl, config, mode: "run|rerun|resume", runFolder, timestamp }
```

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
