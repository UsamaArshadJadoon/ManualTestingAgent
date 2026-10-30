# Complete QA System Guide

> Comprehensive documentation of the QA AZM Digital Agent architecture, pipeline, and operations.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [The Seven-Stage Pipeline](#the-seven-stage-pipeline)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Understanding Results](#understanding-results)
- [Advanced Usage](#advanced-usage)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

The QA AZM Digital Agent is an **autonomous, multi-stage QA system** that transforms a Jira story key into a **complete QA report with bug evidence, screenshot proof, and a GO/NO-GO verdict**.

### Key Features

- **Fully autonomous:** Reads Jira, designs tests, runs them in a real browser, files bugs, generates report
- **Evidence-driven:** Every test is screenshot-backed; every bug is re-verified before filing
- **Gated approvals:** You approve the test plan before anything runs, and approve bugs before they're filed
- **Orchestrated:** A coordinator dispatches 7 specialist agents + a validator that re-checks every stage
- **Audit trail:** All data flows through JSON files — full history of every run

### On a Typical Run

- **Input:** One Jira story key (e.g., `PROJ-123`)
- **Output:** 
  - Acceptance criteria → Test cases (ratio: typically 1 AC : 2-3 test cases)
  - Tests executed in real browser
  - Failures captured with screenshots
  - Bugs filed to Jira with evidence
  - Final report with GO/NO-GO verdict

---

## System Architecture

### The Pipeline: 7 Stages + Validation

```
You: /qa-run PROJ-123
         ↓
    ORCHESTRATOR (orchestrates all 7 stages)
         ↓
    1. qa-story (fetch & normalize)
    2. qa-test-writer (design tests)
    3. qa-gap-analyzer (verify coverage)
    ↓ Gate 1: You approve test plan
    4. qa-test-executor (run in real browser)
    5. qa-bug-logger (draft bugs)
    ↓ Re-verify bugs against live app
    ↓ Gate 2: You approve bugs to file
    6. qa-bug-logger Phase B (create in Jira)
    7. qa-reviewer (compute verdict)
         ↓
    report.html + bugs-filed to Jira
    
    + qa-validator independently checks every stage
    + optional: qa-test-sync mirrors approved cases to AIO Tests
```

### Agent Responsibilities

| # | Agent | Reads | Writes | Job |
|---|-------|-------|--------|-----|
| 1 | **qa-story** | Jira API | `story.json` | Fetch story; normalize acceptance criteria |
| 2 | **qa-test-writer** | `story.json` | `test-cases.json` | Generate happy/negative/edge test cases |
| 3 | **qa-gap-analyzer** | `test-cases.json` | `gap-report.json` | Prove every AC is covered by a test |
| — | **Gate 1** | — | your approval | Approve test plan before running |
| 4 | **qa-test-executor** | live app | `results.json` + screenshots | Drive app; capture evidence |
| 5 | **qa-bug-logger** Phase A | `results.json` | `bugs-proposed.json` | Draft detailed bugs (not filed yet) |
| — | **Re-verify** | drafts + live app | `verification.json` | Confirm each bug still reproduces |
| — | **Gate 2** | — | your approval | Approve which bugs to file |
| 6 | **qa-bug-logger** Phase B | approved | `bugs-created.json` | Create approved bugs in Jira |
| 7 | **qa-reviewer** | all files | `review.json` | Compute coverage % and GO/NO-GO |
| ★ | **qa-validator** | after each stage | validation report | Independent re-check; loop back on gaps |

---

## The Seven-Stage Pipeline

### Stage 1: Story Normalization

**Agent:** `qa-story`  
**Input:** Jira story key  
**Output:** `story.json`

**What it does:**
- Fetches the story from Jira
- Extracts acceptance criteria (AC)
- Breaks compound criteria into atomic, testable statements
- Captures story summary, description, components

**Example story.json:**
```json
{
  "key": "PROJ-123",
  "summary": "User login with SSO",
  "description": "...",
  "criteria": [
    {
      "id": "AC-1",
      "text": "User can log in with valid SSO credentials",
      "must_test": true
    },
    {
      "id": "AC-2",
      "text": "Invalid credentials show error message",
      "must_test": true
    }
  ]
}
```

### Stage 2: Test Design

**Agent:** `qa-test-writer`  
**Input:** `story.json`  
**Output:** `test-cases.json`

**What it does:**
- Generates test cases for each AC
- Creates **happy path** cases (normal usage)
- Creates **negative** cases (invalid input, error handling)
- Creates **edge** cases (boundary values, special scenarios)
- Links each case to the AC it verifies

**Case structure:**
```json
{
  "id": "TC-001",
  "criterion_id": "AC-1",
  "type": "happy-path",
  "title": "User logs in with valid credentials",
  "steps": [
    "Navigate to login page",
    "Enter valid username",
    "Enter valid password",
    "Click login"
  ],
  "expected_result": "User is logged in and dashboard is visible"
}
```

**Typical ratios:**
- 1 AC → 2-3 test cases average
- 12 AC → 26 test cases (example from README)

### Stage 3: Coverage Analysis

**Agent:** `qa-gap-analyzer`  
**Input:** `test-cases.json` + `story.json`  
**Output:** `gap-report.json`

**What it does:**
- Verifies every AC has at least one test case
- Identifies any gaps (uncovered criteria)
- Suggests additional tests if needed
- Flags criteria that are hard to test automatically

**Example report:**
```json
{
  "coverage": {
    "total_criteria": 8,
    "covered": 8,
    "coverage_percent": 100,
    "gaps": []
  }
}
```

### ⚠️ Gate 1: Test Plan Approval

**What you do:**
1. Review the generated test cases
2. Check coverage report
3. Type `approve` to proceed, or `reject` to adjust

**If you reject:**
- The orchestrator sends feedback back to `qa-test-writer`
- New cases are generated
- Gap analysis repeats
- You review again

### Stage 4: Test Execution (Live Browser)

**Agent:** `qa-test-executor`  
**Input:** `test-cases.json` + your live app  
**Output:** `results.json` + `/screenshots` folder

**What it does:**
- Opens your app in a **real browser** (Playwright)
- Executes each test case step-by-step
- **Screenshots every step** (or every significant action)
- Captures console errors
- Logs success/failure for each case

**Result structure:**
```json
{
  "cases": [
    {
      "id": "TC-001",
      "status": "passed",
      "screenshots": ["step1.png", "step2.png", "step3.png"],
      "console_errors": [],
      "duration_ms": 1234
    },
    {
      "id": "TC-002",
      "status": "failed",
      "screenshots": ["step1.png", "error.png"],
      "console_errors": ["TypeError: undefined is not a function"],
      "error_message": "Expected button text to be 'Success' but got 'Error'",
      "duration_ms": 892
    }
  ],
  "summary": {
    "total": 26,
    "passed": 22,
    "failed": 2,
    "blocked": 2
  }
}
```

### Stage 5: Bug Drafting (Phase A)

**Agent:** `qa-bug-logger` Phase A  
**Input:** `results.json`  
**Output:** `bugs-proposed.json`

**What it does:**
- Analyzes failed test results
- Drafts detailed bug reports (title, description, steps to reproduce, expected vs actual)
- **Applies AC-conformance gate:** a bug must violate a quoted acceptance criterion
- Links each bug to the test case that found it and the AC it violates
- Flags findings that cannot be tied to an AC (test case issues)

**Example bug draft:**
```json
{
  "id": "DRAFT-1",
  "title": "Login button not visible on mobile",
  "criterion_violated": "AC-1: User can log in with valid SSO credentials",
  "test_case": "TC-001",
  "steps_to_reproduce": [
    "1. Navigate to login page on mobile device (320px width)",
    "2. Scroll to login section",
    "3. Observe login button is off-screen"
  ],
  "expected": "Login button is visible and clickable",
  "actual": "Login button is hidden below viewport",
  "severity": "critical",
  "evidence": ["screenshot_step3.png"],
  "status": "proposed"
}
```

### Stage 5b: Re-Verification

**Agent:** `qa-test-executor` (in re-verify mode)  
**Input:** `bugs-proposed.json` + your live app  
**Output:** `verification.json`

**What it does:**
- **Re-runs against the live app** to confirm each bug still reproduces
- Marks each bug as `reproduced` / `not-reproduced` / `inconclusive`
- Captures fresh screenshots of the issue
- Flags bugs that may have been fixed since test execution

**Why this matters:**
- Between test execution and approval, the app might have been patched
- A bug that no longer reproduces never reaches Gate 2
- Prevents filing stale issues to Jira

### ⚠️ Gate 2: Bug Approval

**What you do:**
1. Review each proposed bug
2. Look at re-verification status (Did it reproduce again?)
3. Type `approve` to file to Jira, or `skip` to discard
4. Each bug must be explicitly approved individually

**What happens after:**
- Approved bugs are filed to Jira with:
  - Full description
  - Screenshots (embedded as base64 in HTML report)
  - Link to test case
  - Link to acceptance criterion violated

### Stage 6: Bug Filing (Phase B)

**Agent:** `qa-bug-logger` Phase B  
**Input:** approved bugs from Gate 2  
**Output:** `bugs-created.json`

**What it does:**
- Creates an issue in Jira for each approved bug
- Populates title, description, severity, component
- Attaches screenshots (via run folder reference; embedded in HTML report)
- Links issue to the original story (parent)
- Records Jira issue key for each bug

### Stage 7: Final Report & Verdict

**Agent:** `qa-reviewer`  
**Input:** all run files  
**Output:** `review.json` + `report.html` + `bug-report.html`

**Computes:**
- **Coverage %:** `(criteria with ≥1 passing test) / total criteria × 100`
- **Test pass rate:** `passed / total`
- **Verdict:** GO or NO-GO

**Verdict Rule:**

**GO** if:
- ✅ Every acceptance criterion has at least one **passing** linked test case
- ✅ All failures have been logged as bugs (or skipped via Gate 2)

**NO-GO** if:
- ❌ Any criterion has only `failed` or `blocked` cases (no passing case linked)
- ❌ Unreviewed failures exist
- ❌ Re-verification marked a bug as `not-reproduced` or `inconclusive`

### Validation: Continuous Re-Check

**Agent:** `qa-validator`  
**Runs:** After stages 1, 3, 4, 7

**What it does:**
- Independently re-reads the source data for each stage
- Re-derives expectations (doesn't trust the stage's output)
- Re-checks the JSON contract
- If gaps found: loops the failed stage back to the orchestrator (max 2 retries)
- Reports any structural or logical issues

**Example validation checks:**
- Stage 1: Verifies every AC is atomic and testable
- Stage 3: Re-counts coverage independently
- Stage 4: Verifies screenshot evidence exists for each test
- Stage 7: Re-computes verdict from raw data

---

## Configuration

### The Config File: `.qa-config.json`

Created by `/qa-setup`. Example:

```json
{
  "jira": {
    "project": "PROJ",
    "apiVersion": "3"
  },
  "app": {
    "baseUrl": "http://localhost:3000",
    "loginUrl": "http://localhost:3000/login"
  },
  "execution": {
    "timeout": 30000,
    "headless": false,
    "slowMo": 100
  },
  "browser": {
    "type": "chromium",
    "viewport": { "width": 1280, "height": 720 }
  },
  "screenshots": {
    "capture": "full",
    "onError": true
  },
  "aio": {
    "enabled": false
  }
}
```

### The Secrets File: `.qa-secrets`

Git-ignored. Never commit this file.

```json
{
  "JIRA_USER": "your.email@company.com",
  "JIRA_TOKEN": "your-api-token-from-atlassian",
  "APP_USER": "testuser@app.com",
  "APP_PASSWORD": "password"
}
```

Or use environment variables:
```powershell
$env:JIRA_USER = "your.email@company.com"
$env:JIRA_TOKEN = "your-api-token"
$env:QA_USER = "testuser@app.com"
$env:QA_PASS = "password"
```

### Environment Variables (Alternative to .qa-secrets)

```powershell
$env:QA_USER = "testuser"
$env:QA_PASS = "testpass"
$env:JIRA_USER = "user@company.com"
$env:JIRA_TOKEN = "token"
```

---

## Running Tests

### Basic Run

```
/qa-run PROJ-123
```

### Re-Run (All Tests)

```
/qa-run PROJ-123 --rerun
```

Executes from scratch, even if a previous run exists.

### Resume (Continue Interrupted)

```
/qa-run PROJ-123 --resume
```

Picks up from where the run stopped.

### Skip Cache

```
/qa-run PROJ-123 --no-cache
```

Forces browser restart and screenshot refresh.

### Set Log Level

```
/qa-run PROJ-123 --debug
```

Verbose output for troubleshooting.

---

## Understanding Results

### Report Structure

Each run creates a folder: `qa-agent/runs/PROJ-123/`

```
PROJ-123/
├── story.json                    Normalized story & criteria
├── test-cases.json               Designed test cases
├── gap-report.json              Coverage analysis
├── results.json                 Test execution results
├── bugs-proposed.json           Drafted bugs (Phase A)
├── verification.json            Re-verification results
├── bugs-created.json            Filed bugs (Phase B)
├── review.json                  Coverage % & verdict
├── report.html                  Main report (traceability matrix)
├── bug-report.html              Bug evidence & details
├── process-log.html             Step-by-step run log
└── screenshots/                 All captured screenshots
    ├── TC-001_step1.png
    ├── TC-001_step2.png
    └── ...
```

### Reading the Main Report

**report.html** contains:

1. **Summary**
   - Test counts (passed / failed / blocked)
   - Coverage %
   - Verdict (GO / NO-GO)

2. **Traceability Matrix**
   - Rows: Acceptance criteria
   - Columns: Test cases
   - Shows which criterion each test verifies
   - Highlights failed/blocked cases in red

3. **Test Details**
   - Each test case with full steps
   - Screenshots at each step
   - Pass/fail status
   - Console errors (if any)

4. **Coverage Analysis**
   - Which criteria are fully covered (≥1 passing test)
   - Which criteria have gaps (only failing/blocked tests)
   - Suggestions for additional tests

### Reading the Bug Report

**bug-report.html** contains:

1. **Bug Summary**
   - Count of proposed vs approved vs filed
   - Severity breakdown (critical / high / medium / low)

2. **Bug Details**
   - For each bug:
     - Title & description
     - Violated acceptance criterion (with quote)
     - Steps to reproduce (from test case)
     - Expected vs actual
     - Screenshots (embedded)
     - Re-verification status
     - Jira issue link (if filed)

### The Verdict

| Verdict | Meaning | When You'd See This |
|---------|---------|-------------------|
| **GO ✓** | Story passes; all ACs are covered by passing tests | Ready to merge or release |
| **GO ⚠** | Passing coverage but some findings exist (needs review) | Passes but has bugs to track |
| **NO-GO ✗** | Story does not pass; coverage gaps or failures | Needs fixes before release |

---

## Advanced Usage

### AIO Tests Integration (Optional)

If your team uses **AIO Tests**, you can auto-sync approved test cases there.

1. Enable in `.qa-config.json`:
   ```json
   {
     "aio": {
       "enabled": true
     }
   }
   ```

2. Add token to `.qa-secrets`:
   ```json
   {
     "AIO_TOKEN": "your-aio-api-token"
   }
   ```

3. **Before running:** Create a folder in AIO Tests **Cases module** named with the story key (e.g., `PROJ-123`)

4. Run `/qa-run PROJ-123`

After Gate 1 approval, `qa-test-sync` automatically:
- Creates a case in the AIO folder for each approved test
- Links each case to the Jira story
- Syncs again each time you run (re-verify or re-run)

### Running Specific Test Cases

Edit `test-cases.json` before running, or use CLI:

```
/qa-run PROJ-123 --cases TC-001,TC-003,TC-005
```

### Skipping Problematic Cases

If a test is timing out or blocking execution:

```
/qa-run PROJ-123 --skip TC-999
```

### Custom Verdict Rules

Edit the verdict rule in `qa-agent/agents/qa-reviewer.md`:

Default: "Every AC needs ≥1 passing case"

Options:
- Stricter: "Every AC needs 100% passing cases" (no failed/blocked)
- Looser: "≥80% of ACs covered" (allows some gaps)

---

## Production Deployment

### GitHub Actions CI/CD

Create `.github/workflows/qa-test.yml`:

```yaml
name: QA Tests

on:
  workflow_dispatch:
    inputs:
      story_key:
        description: "Jira story key (e.g., PROJ-123)"
        required: true

jobs:
  qa-test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install Claude agents
        run: powershell -ExecutionPolicy Bypass -File qa-agent/install.ps1
      
      - name: Run QA pipeline
        env:
          JIRA_USER: ${{ secrets.JIRA_USER }}
          JIRA_TOKEN: ${{ secrets.JIRA_TOKEN }}
          QA_USER: ${{ secrets.QA_USER }}
          QA_PASS: ${{ secrets.QA_PASS }}
        run: |
          node qa-agent/commands/qa-run.js ${{ github.event.inputs.story_key }}
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: qa-report
          path: qa-agent/runs/
```

See [DEPLOYMENT/CI_CD_SETUP.md](DEPLOYMENT/CI_CD_SETUP.md) for more details.

### Infrastructure Sizing

See [DEPLOYMENT/INFRASTRUCTURE_SIZING.md](DEPLOYMENT/INFRASTRUCTURE_SIZING.md) for:
- CPU / memory requirements
- Concurrent run limits
- Database sizing
- Network bandwidth

---

## Troubleshooting

### Test Execution Issues

**Tests timing out:**
- Increase timeout in `.qa-config.json`: `"timeout": 60000`
- Check network latency to app
- Check app server logs for slow responses

**Browser won't open:**
- Install Playwright: `npx playwright install`
- Check Windows Defender / antivirus blocking
- Check port availability

**Screenshots not captured:**
- Verify disk space in `C:\Temp` or temp folder
- Check file permissions
- Try clearing screenshot cache: `/qa-run PROJ-123 --no-cache`

### Jira Connection Issues

**"Unauthorized" error:**
- Verify API token [here](https://id.atlassian.com/manage-profile/security/api-tokens)
- Check IP whitelisting if on VPN
- Run `/qa-setup` again to re-enter credentials

**Story not found:**
- Verify story key is correct (case-sensitive)
- Verify you have access to the story
- Check `.qa-config.json` has correct Jira project

### Bug Filing Issues

**"You must approve bugs":**
- Gate 2 requires explicit approval
- Type `approve` at the gate to proceed

**"Bug already exists in Jira":**
- Check if duplicate detection found it
- Look in Jira for recent issues with same title

**"Can't attach screenshots":**
- Atlassian MCP cannot attach files; screenshots are referenced by path
- Download and share `bug-report.html` which embeds all evidence as base64

---

## Next Steps

- **Operations?** → [docs/OPERATIONS](OPERATIONS/)
- **Deployment?** → [docs/DEPLOYMENT](DEPLOYMENT/)
- **Team training?** → [docs/TEAM](TEAM/)
- **Specific FAQ?** → [FAQ.md](FAQ.md)

---

**Developed by:** Usama Arshad Jadoon · QC Lead · AZM Digital  
**Last updated:** October 2026
