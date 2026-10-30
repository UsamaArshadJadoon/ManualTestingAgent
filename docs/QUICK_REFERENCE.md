# Quick Reference — AI QC Framework

**One-page cheat sheet for QA team members**

---

## Most Common Commands

| Task | Command |
|------|---------|
| Run tests for a story | `/qa-run PROJ-123` |
| Run only failed/flaky tests | `/qa-run PROJ-123 --rerun` |
| Resume interrupted run | `/qa-run PROJ-123 --resume` |
| Check system health | `/qa-diagnostics` |
| Set up project (one time) | `/qa-setup` |

> **Important:** Type these in Claude Code chat (Ctrl+Esc), NOT in PowerShell!

---

## Log Locations

| What | Where |
|------|-------|
| Test results | `qa-runs/<STORY-KEY>-<DATE>-<TIME>/results.json` |
| Test logs | `qa-runs/<STORY-KEY>-<DATE>-<TIME>/logs/test-*.log` |
| Diagnostics | `qa-runs/<STORY-KEY>-<DATE>-<TIME>/diagnostics.json` |
| Main report | `qa-runs/<STORY-KEY>-<DATE>-<TIME>/report.html` |
| Bug report | `qa-runs/<STORY-KEY>-<DATE>-<TIME>/bug-report.html` |
| Configuration | `.qa-config.json` (your project root) |
| Credentials | `.qa-secrets` (git-ignored; create with `/qa-setup`) |

---

## Key Files to Know

| File | Purpose | Edit? |
|------|---------|-------|
| `.qa-config.json` | Project config (URL, env name, settings) | Yes, for settings |
| `.qa-secrets` | Credentials (git-ignored) | Yes, add your credentials |
| `results.json` | Test results (JSON) | No, auto-generated |
| `report.html` | Main report for sharing | No, auto-generated |

---

## Feature Quick Start

### Automatic Retry Logic
- **What:** Tests retry up to 3 times on transient errors
- **You do:** Nothing — it's automatic
- **See it in logs:** Look for `[Retry 1/3]` text

### Health Checks
- **What:** Pre-flight validation before tests
- **You do:** Nothing — runs automatically before `/qa-run`
- **If it fails:** Note the service name, contact DevOps, wait, re-run

### Structured Logging
- **What:** Detailed step-by-step logs of what each test did
- **You do:** Read logs in `qa-runs/<STORY>/logs/`
- **Look for:** ✓ (pass), ✗ (fail), ⚠ (warning)

### Diagnostics
- **What:** Deep system health check
- **You do:** Run `/qa-diagnostics` when things seem broken
- **Tells you:** CPU, memory, network, app state, suggestions

### Flaky Detection
- **What:** Identifies unstable tests (pass 50-80% of the time)
- **You do:** Investigate root cause (network? timing? bug?)
- **Report:** See `stability-report.json` after multiple runs

### Performance Optimization
- **What:** Runs tests in parallel, reuses sessions, 20-30% faster
- **You do:** Enable in `.qa-config.json` (`performance.enabled: true`)
- **Verify:** Look at execution time in the report

---

## Configuration Quick Reference

### Enable Performance Optimization
```json
{
  "performance": {
    "enabled": true,
    "parallelization": 4
  }
}
```

### Enable AIO Tests Sync
```json
{
  "aio": {
    "enabled": true,
    "token": "$AIO_TOKEN"
  }
}
```
(Then create a folder in AIO Cases named after the story key)

### Disable Retries (not recommended)
```json
{
  "retry": {
    "enabled": false
  }
}
```

---

## Metrics Dashboard URL

**Contact your QA Lead for your team's dashboard URL.**

Typical URL: `https://qa-metrics.yourcompany.com/dashboard`

**What to look for:**
- Pass/fail trends over time
- Test execution speed
- Which tests are flaky
- Coverage by feature

---

## Support & Escalation

### Level 1: Self-Help
- Check `FAQ.md` for common questions
- Read logs in `qa-runs/` folder
- Run `/qa-diagnostics`

### Level 2: Team Lead
- Contact your **QA Lead**
- Share logs and diagnostics output
- Ask for help interpreting results

### Level 3: QC Lead
- **Name:** Usama Arshad Jadoon
- **Role:** QC Lead, AZM Digital
- **When:** Blockers, framework issues, process changes

### Level 4: DevOps (Environment Issues)
- Contact **DevOps team**
- When: App is down, database is broken, API unreachable
- Share diagnostics output from `/qa-diagnostics`

### Level 5: Developers (Product Bugs)
- File bug in Jira
- Include link to `bug-report.html` from the run
- Developers will see screenshots and step-by-step reproduction

---

## Emergency Procedures

### Run Hangs (No Progress for 10+ Minutes)
1. Let it sit 5 more minutes (might just be slow)
2. Run `/qa-diagnostics` in another Claude Code window
3. If CPU/memory is maxed, cancel run (**Ctrl+C**) and reduce parallelization
4. Contact QA Lead if it persists

### Health Checks Fail (Before Tests Start)
1. Note the failing service from the error message
2. **Do not re-run yet** — the issue isn't fixed
3. Contact DevOps: "Service X is not responding"
4. Wait for confirmation it's fixed
5. Re-run `/qa-run PROJ-123`

### All Tests Fail (100% Failure Rate)
1. Run `/qa-diagnostics` — check app health
2. If app is up, check credentials in `.qa-secrets`
3. If credentials look right, test them manually in the app
4. If still broken, contact QA Lead with diagnostics output

### Credentials Not Working
1. Verify they're in `.qa-secrets` or as `$env:QA_USER` / `$env:QA_PASS`
2. Test them manually in the browser (login manually to verify)
3. If they work manually but not in tests, contact QA Lead
4. If they don't work manually, ask for account reset from DevOps

---

## Expected Behavior

### During a Run
```
[14:32] Starting test run...
[14:32] Health checks... ✓ All systems ready
[14:32] Executing 34 test cases...
[14:45] Test 1-5: ✓ Pass (estimated 30% complete)
[14:58] Test 6-10: ✓ Pass (estimated 60% complete)
[15:11] Test 11-34: ✓ Pass (estimated 100% complete)
[15:13] Drafting bugs...
[15:14] Waiting for Gate #1: Approve test plan
(You review and approve)
[15:15] Executing on live app...
[15:28] Tests complete. Waiting for Gate #2: Approve bugs
(You review and approve)
[15:30] Filing bugs to Jira...
[15:31] Run complete.
```

### Report
- **% Pass:** Expected 80-90%+
- **# Passed / Failed / Blocked:** Number of cases in each state
- **# Bugs Filed:** Number of defects created in Jira
- **Execution Time:** ~35-45 minutes for 50 cases (less if optimized)

---

## Common Issues & Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Test timeout | Run `/qa-diagnostics`, check app health |
| Health check fails | Note service, contact DevOps, re-run when fixed |
| Test takes forever | Reduce `parallelization` in config (uses less CPU) |
| Credentials error | Verify in `.qa-secrets`, test manually in browser |
| Weird log output | Check if browser cache is full; use `/qa-diagnostics` |
| Report won't generate | Check disk space, verify logs are complete |
| AIO sync fails | Create folder in AIO Cases with exact story key name |

---

## Time Estimates

| Activity | Time |
|----------|------|
| Health checks | ~30 seconds |
| 30 test cases (execution) | ~22 minutes |
| 50 test cases (execution) | ~35 minutes |
| Bug review (Gate #2) | ~10-15 minutes |
| Total pipeline (50 cases) | ~50-60 minutes |
| With performance optimization | -20-30% (35-45 min for 50 cases) |

---

## When to Re-Run

| Scenario | Command |
|----------|---------|
| Test failed, environment is now stable | `/qa-run PROJ-123 --rerun` |
| Run was interrupted halfway | `/qa-run PROJ-123 --resume` |
| Story changed, need new test plan | `/qa-run PROJ-123` (fresh start) |
| Want to verify a fix | `/qa-run PROJ-123 --rerun` |

---

## Contact Quick Links

- **QA Lead:** [Get from team directory]
- **QC Lead (Framework Issues):** Usama Arshad Jadoon
- **DevOps (Environment Issues):** [DevOps team Slack]
- **QA Team Slack:** #qa-team or #qa-support
- **Framework GitHub:** [Repository link]

---

## One-Minute Onboarding

1. **Setup:** `/qa-setup` (once per project, creates `.qa-secrets`)
2. **Run:** `/qa-run PROJ-123` (replace with a real Jira story)
3. **Approve:** Review test plan at Gate #1, click approve
4. **Wait:** Tests run automatically (30-50 min depending on size)
5. **Review Bugs:** Approve drafted bugs at Gate #2
6. **Done:** Report and bugs automatically filed to Jira

---

**Printed on:** October 30, 2026  
**Keep this sheet at your desk for quick reference!**
