# Quick Start Guide

**QA AZM Digital Agent — Get Started in 5 Minutes**

> This guide gets you up and running with your first QA test run.

---

## Prerequisites

- ✅ Node.js 16+ installed
- ✅ Jira access (for story fetch)
- ✅ VS Code with Claude Code extension installed
- ✅ Browser for running tests (Chrome recommended)
- ✅ Repository cloned locally

---

## Installation (First Time Only)

### 1. Clone the Repository

```bash
git clone https://github.com/UsamaArshadJadoon/ManualTestingAgent.git
cd ManualTestingAgent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Credentials

Copy the example configuration:

```bash
cp qa-agent/docs/config.example.json qa-agent/config.json
```

Edit `qa-agent/config.json` with:
- Jira URL and credentials
- Target app URL
- Browser configuration (optional)

### 4. Verify Installation

```bash
node qa-agent/commands/qa-setup.js --verify
```

Expected output:
```
✅ Jira connection: OK
✅ App server: OK  
✅ Configuration: OK
```

---

## Running Your First QA Test

### 1. Get a Jira Story Key

Find a story in your Jira project. Example: `PROJ-123`

### 2. Open Claude Code

```bash
# In your VS Code workspace
claude code
```

### 3. Execute the QA Command

Type in the Claude Code terminal:

```bash
/qa-run PROJ-123
```

### 4. Approve the Test Plan

When prompted:
- Review the generated test cases
- Check coverage of acceptance criteria
- Type `approve` to proceed (or `reject` to adjust)

### 5. Watch the Tests Run

The system will:
- ✅ Open your live app in a browser
- ✅ Execute each test case
- ✅ Capture screenshots and evidence
- ✅ Log any errors or issues

### 6. Approve Bugs (if any)

If issues are found:
- Review each proposed bug
- Confirm reproduction status
- Type `file` to create Jira issues (or `skip` to skip)

### 7. View Your Report

The final report includes:
- 📊 Test execution summary
- 📸 Screenshots for each test
- 📋 All findings and bugs filed
- ✅ GO / NO-GO verdict

---

## Understanding the Report

### Report Sections

#### Summary
- Number of test cases executed
- Pass/fail/blocked statistics
- Overall verdict (GO / NO-GO)

#### Coverage Analysis
- Which acceptance criteria are covered
- Number of passing cases per criterion
- Any gaps in coverage

#### Findings
- Bugs with evidence (screenshots)
- Console errors captured
- Linked Jira issues created

#### Verdict Rule

The system returns **GO** when:
- ✅ Every acceptance criterion has at least one **passing** test case
- ✅ All **failed** cases have been logged as bugs

The system returns **NO-GO** when:
- ❌ Any criterion has only blocked/failed cases
- ❌ Unreviewed failures exist

---

## Common Tasks

### Re-running a Story

```bash
/qa-run PROJ-123 --force
```

This will re-execute all tests for the story.

### Running Specific Test Cases

Edit `qa-agent/config.json` to set:

```json
{
  "execution": {
    "skipCases": ["TC-005", "TC-007"]
  }
}
```

### Reviewing Logs

Logs are saved in the run folder:

```
qa-agent/runs/PROJ-123/
├── story.json
├── test-cases.json
├── results.json
├── bugs-proposed.json
└── report.html
```

---

## Troubleshooting

### Issue: Jira Connection Failed

**Solution:**
1. Verify Jira URL in `qa-agent/config.json`
2. Check credentials (username/API token)
3. Ensure IP whitelisting if on VPN

```bash
node qa-agent/commands/qa-setup.js --verify
```

### Issue: Browser Won't Start

**Solution:**
1. Ensure Chrome/Chromium is installed
2. Try installing Playwright browsers:

```bash
npx playwright install
```

### Issue: Tests Timing Out

**Solution:**
1. Check network connectivity to the app
2. Increase timeout in `qa-agent/config.json`:

```json
{
  "execution": {
    "timeout": 60000
  }
}
```

### Issue: Screenshots Not Captured

**Solution:**
1. Verify `/tmp` or `C:\Temp` has write access
2. Check disk space
3. Restart the browser:

```bash
/qa-run PROJ-123 --no-cache
```

---

## Next Steps

- 📖 Read [TEAM_TRAINING_GUIDE.md](TEAM_TRAINING_GUIDE.md) for deeper understanding
- 🔧 Configure [CI_CD_SETUP.md](../docs/CI_CD_SETUP.md) for automated runs
- 📊 Review [PERFORMANCE_BENEFITS.md](PERFORMANCE_BENEFITS.md) for ROI metrics
- ❓ Check [FAQ.md](FAQ.md) for more questions

---

## Need Help?

- **Common Issues?** → [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md)
- **Questions?** → [FAQ.md](FAQ.md)
- **Escalation?** → [ESCALATION_PROCEDURES.md](ESCALATION_PROCEDURES.md)
- **Full Guide?** → Open `qa-agent/docs/complete-guide.html` in browser

---

## Key Concepts

### Acceptance Criteria (AC)
Requirements extracted from the Jira story that must be tested.

### Test Cases
Specific test scenarios that verify each acceptance criterion.

### Coverage
Percentage of acceptance criteria with at least one passing test.

### Verdict
GO means the story passes all required tests; NO-GO means issues must be resolved first.

---

**Developed by:** Usama Arshad Jadoon  
**Role:** QC Lead  
**Company:** AZM Digital

---
