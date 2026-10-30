# Phase 2-4 Quick Reference — One-Page Cheat Sheet

**Keep this at your desk for instant lookup**

---

## Essential Commands

```
/qa-run PROJ-123              Start test run for story
/qa-run PROJ-123 --rerun      Re-test failed/flaky cases only
/qa-run PROJ-123 --resume     Resume interrupted run
/qa-diagnostics               Deep system health check
/qa-setup                     Configure project (one-time)
```

**Remember:** Type these in Claude Code chat (Ctrl+Esc), NOT PowerShell!

---

## The 6 Phase 2-4 Features At A Glance

| Feature | What | Impact | You Do |
|---------|------|--------|--------|
| **Retries** | Auto-retry transient errors 3x | Eliminates false failures | Nothing (automatic) |
| **Health Checks** | Validate app/login/DB before tests | Avoid wasted runs | Nothing (automatic) |
| **Structured Logs** | Clear step-by-step logs | Find issues in 2 min | Read logs in `qa-runs/logs/` |
| **Diagnostics** | Deep system analysis | Spot root cause instantly | Run `/qa-diagnostics` when needed |
| **Flaky Detection** | Auto-find unstable tests | Know what to trust | Review `stability-report.json` |
| **Performance** | Run tests in parallel | 20-30% faster | Enable in `.qa-config.json` |

---

## Critical File Locations

```
Project Root/
├── .qa-config.json                (settings, app URL, env name)
├── .qa-secrets                    (credentials, git-ignored)
│
qa-runs/PROJ-123-2026-10-30-14-32/
├── results.json                   (test results)
├── report.html                    (main report for sharing)
├── bug-report.html                (defects + screenshots)
├── metrics.json                   (performance data)
├── diagnostics.json               (system state snapshot)
├── stability-report.json          (flaky test detection)
└── logs/                          (detailed test logs)
    ├── test-001.log
    ├── test-002.log
    └── ...
```

---

## Config Quick Snippets

**Enable Performance Optimization:**
```json
{
  "performance": {
    "enabled": true,
    "parallelization": 4
  }
}
```

**Disable Retries (not recommended):**
```json
{
  "retry": {
    "enabled": false
  }
}
```

**Enable AIO Tests Sync:**
```json
{
  "aio": {
    "enabled": true,
    "token": "$AIO_TOKEN"
  }
}
```

---

## Common Issues & Fixes

| Problem | Quick Fix |
|---------|-----------|
| Test times out | Run `/qa-diagnostics`, check app health |
| Health checks fail | Note service, contact DevOps, re-run when fixed |
| Tests are slow | Check parallelization setting, run diagnostics |
| Credentials don't work | Verify manually in browser, check `.qa-secrets` typos |
| Can't find logs | Look in `qa-runs/<STORY-KEY>-<DATE>/logs/` |
| Flaky tests | Review `stability-report.json`, investigate root cause |

---

## What's Expected

**Typical run times (50 test cases):**
- Without optimization: ~45 minutes
- With optimization: ~32 minutes
- Health checks: ~30 seconds
- Diagnostics: ~2 minutes

**Expected results:**
- Pass rate: 90%+ (with retries)
- Time to diagnose: <10 minutes
- Test reliability: 90%+ consistency

---

## Reading Logs (2-Minute Format Guide)

```
TEST: Login with valid credentials
  STEP 1: Navigate to login
    URL: https://app.example.com/login
    Response: 200 OK (142ms)
  STEP 2: Enter credentials
    Status: OK
  STEP 3: Click login
    Response: 200 OK (1.2s) ⚠ Slow (target: 800ms)
  
RESULT: ✓ PASSED
Warnings: 1 (slow response)
```

**Quick scan:**
- ✓ = pass, ✗ = fail, ⚠ = warning
- First line = what was tested
- Indented lines = steps
- Last line = result

---

## Support Hierarchy

1. **Quick answer:** Check this page or PHASE2-4_FAQ.md
2. **How to use feature:** Read PHASE2-4_TRAINING_GUIDE.md
3. **Team questions:** Ask your QA Lead
4. **Blockers:** Contact QC Lead (Usama Arshad Jadoon)
5. **DevOps issues:** Contact DevOps team

---

## Emergency Checklist

**Run hangs (10+ minutes, no progress):**
- [ ] Wait 5 more minutes (might be slow)
- [ ] Run `/qa-diagnostics` in another window
- [ ] If still hung, cancel run (**Ctrl+C**)
- [ ] Contact QA Lead

**Health checks fail:**
- [ ] Note which service is down
- [ ] Contact responsible team (DevOps for infrastructure)
- [ ] Wait for confirmation it's fixed
- [ ] Re-run `/qa-run PROJ-123`

**All tests fail (100%):**
- [ ] Run `/qa-diagnostics`
- [ ] Check credentials in `.qa-secrets`
- [ ] Test credentials manually in browser
- [ ] Contact QA Lead with diagnostics output

---

## Time Estimates

| Activity | Time |
|----------|------|
| Health check validation | ~30 seconds |
| 30 test cases | ~22 minutes |
| 50 test cases | ~35 minutes |
| Bug review (Gate #2) | ~10-15 minutes |
| Total pipeline (50 cases) | ~50-60 minutes |
| With optimization enabled | -20-30% (35-45 min) |

---

## Feature Enablement Settings

**In `.qa-config.json` `performance` section:**

```
"parallelization": 4       Default, balanced (change to 2-8)
"caching": true           Reuse sessions (saves 2-3 min)
"enabled": true           Turn optimization on
```

---

## Key Metrics to Monitor

Track these in your dashboard:

- **Pass Rate:** Target 90%+ (baseline was 82%)
- **Execution Time:** Should be 20-30% faster
- **Flaky Tests:** <10% of suite
- **Time to Diagnose:** <10 minutes
- **False Failures:** <7% of failures

---

## One-Minute Setup

1. Open project in VS Code
2. Run `/qa-setup`
3. Edit `.qa-config.json` (verify app URL, env)
4. Fill `.qa-secrets` (credentials)
5. Run `/qa-diagnostics` (verify all green)
6. Run `/qa-run PROJ-123` (test it works)

---

## Print This

**Tear this page off and keep it at your desk.**

```
Phase 2-4 Features Quick Reference
==================================

/qa-run PROJ-123              Main command
/qa-diagnostics               System health check
/qa-setup                     One-time project setup

Key folders:
  .qa-config.json             Settings
  qa-runs/<DATE>/logs/        Test logs
  qa-runs/<DATE>/report.html  Main report

Quick fix:
  Timeout? → Run diagnostics
  Health check fails? → Contact DevOps
  Test slow? → Check parallelization

Support: QA Lead → QC Lead (Usama)
```

---

**Last Updated:** October 30, 2026  
**Print it. Keep it. Use it.**
