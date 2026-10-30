# Troubleshooting Guide for Operations

**QA AZM Digital Agent — Debugging & Issue Resolution**

---

## Common Issues & Solutions

### Issue 1: Tests Timeout

**Symptoms:**
- Test run takes >30 minutes
- Browser hangs
- Network requests pending

**Debugging:**
1. Check app responsiveness: \curl -I https://your-app.com\
2. Check Jira connectivity: \curl -I https://your-jira.atlassian.net\
3. Review timeout config

**Solutions:**
\\\json
{
  "execution": {
    "timeout": 120000
  }
}
\\\

---

### Issue 2: Jira Connection Fails

**Symptoms:**
- Error: "Cannot connect to Jira"
- story.json empty
- Test run blocked at Stage 1

**Debugging:**
1. Verify credentials: \
ode qa-agent/commands/qa-setup.js --verify\
2. Test DNS: \
slookup your-jira.atlassian.net\
3. Check firewall: \	elnet your-jira.atlassian.net 443\

**Solutions:**
- Update credentials in config.json
- Check VPN/network access
- Restart services

---

### Issue 3: Browser Won't Start

**Symptoms:**
- Error: "Browser launch failed"
- No browser window appears
- Chromium not found

**Debugging:**
1. Check Playwright: \
px playwright install --check\
2. Verify Chrome: \which google-chrome\ (Linux) or \where chrome\ (Windows)
3. Check disk space: \df -h\ / \dir C:\

**Solutions:**
\\\ash
# Reinstall Playwright browsers
npx playwright install --with-deps
\\\

---

### Issue 4: Screenshots Not Captured

**Symptoms:**
- No images in report
- Directory /qa-agent/runs/ empty
- Error: "Permission denied"

**Debugging:**
1. Check permissions: \ls -la qa-agent/runs/\
2. Verify disk space: \df -h\
3. Check temp directory

**Solutions:**
\\\ash
# Fix permissions
chmod -R 755 qa-agent/runs/

# Clear old screenshots
rm -rf qa-agent/runs/*/screenshots/old-*.png
\\\

---

### Issue 5: Test Coverage Shows 0%

**Symptoms:**
- Coverage: 0%
- test-cases.json empty
- No test execution

**Debugging:**
1. Check story.json exists
2. Verify acceptance criteria in Jira
3. Review test-writer logs

**Solutions:**
1. Ensure story has acceptance criteria
2. Verify AC format (must be clear and testable)
3. Rerun test generation

---

## Log Analysis

### View Orchestrator Logs

\\\ash
tail -f qa-agent/runs/<STORY-KEY>/orchestrator.log
\\\

### View Agent Logs

\\\ash
# View specific agent logs
cat qa-agent/runs/<STORY-KEY>/logs/qa-story.log
cat qa-agent/runs/<STORY-KEY>/logs/qa-test-executor.log
\\\

### Parse JSON Results

\\\ash
# View test results
jq '.summary' qa-agent/runs/<STORY-KEY>/results.json

# View specific failure
jq '.results[] | select(.status == "FAILED")' qa-agent/runs/<STORY-KEY>/results.json
\\\

---

## Performance Optimization

### Slow Test Execution

1. **Enable headless mode:**
\\\json
{
  "browser": {
    "headless": true
  }
}
\\\

2. **Reduce screenshot quality:**
\\\json
{
  "screenshot": {
    "quality": 80
  }
}
\\\

3. **Increase parallelization:**
\\\json
{
  "execution": {
    "parallel": true,
    "maxWorkers": 4
  }
}
\\\

---

## Escalation Path

If you cannot resolve the issue:

1. Collect logs: \	ar -czf logs-\.tar.gz qa-agent/runs/\
2. Document issue: Include error messages, steps to reproduce
3. Escalate to QC Lead: Usama Arshad Jadoon
4. See [ESCALATION_PROCEDURES.md](ESCALATION_PROCEDURES.md)

---

**Last Updated:** 2026-10-30