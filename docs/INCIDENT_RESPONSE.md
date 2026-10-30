# Incident Response

**QA AZM Digital Agent — Incident Management Procedures**

---

## Incident Classification

### Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|-------|---------|
| Critical | System down, no tests can run | 15 min | Jira down, app unreachable |
| High | Major features broken | 30 min | Orchestrator failed, 50% tests fail |
| Medium | Some tests fail or slow | 1 hour | Timeout issues, intermittent failures |
| Low | Minor issues, documentation | 4 hours | UI label wrong, typo in report |

---

## Incident Response Process

### Step 1: Detect & Assess (5 min)

When you notice an issue:

1. **Verify the problem:**
   - Run health check: \
ode qa-agent/commands/qa-setup.js --verify\
   - Check recent logs
   - Try a manual test run

2. **Classify severity:**
   - Can tests still run? → Not critical
   - Is Jira down? → Critical
   - Is app unreachable? → Critical

3. **Document initial findings:**
   - Time issue discovered
   - Error messages
   - Affected stories/users

### Step 2: Immediate Action (10-30 min)

**If Critical (15 min response):**
1. Notify QC Lead immediately
2. Start troubleshooting (see [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md))
3. Attempt mitigation:
   - Restart services
   - Failover to backup system
   - Disable problematic feature

**If High (30 min response):**
1. Notify QC Lead within 30 minutes
2. Gather diagnostics
3. Implement temporary workaround

**If Medium (1 hour response):**
1. Document thoroughly
2. Schedule fix
3. Notify team

### Step 3: Investigate (30 min - 4 hours)

1. **Collect evidence:**
   - System logs
   - Application logs
   - Network diagnostics
   - Browser console output

2. **Identify root cause:**
   - Is it infrastructure? → Notify DevOps
   - Is it configuration? → Fix settings
   - Is it code bug? → Create GitHub issue

3. **Test hypothesis:**
   - Reproduce the issue
   - Verify fix works
   - Test edge cases

### Step 4: Implement Fix

1. **Apply solution:**
   - Code changes
   - Configuration updates
   - Service restarts

2. **Verify fix:**
   - Run tests
   - Check health
   - Monitor for recurrence

### Step 5: Communication

1. **Notify stakeholders:**
   - QC Lead
   - DevOps team
   - Affected users

2. **Provide status updates:**
   - Every 30 minutes during outage
   - Post-incident summary within 24 hours

---

## Post-Incident

### Root Cause Analysis (24 hours)

Document:
- What happened?
- Why did it happen?
- How did we fix it?
- What prevents recurrence?

### Preventive Actions

1. Update monitoring
2. Add tests for edge case
3. Update runbooks
4. Train team

### Postmortem

Schedule within 48 hours:
- Incident review
- Lessons learned
- Action items
- Timeline

---

## Contact & Escalation

### On-Call Schedule

| Day | Name | Contact |
|-----|------|---------|
| Mon-Fri | QC Lead (Usama) | usama@azm.dev |
| Weekends | On-Call Engineer | See schedule |

### Escalation Chain

1. QC Lead (Usama Arshad Jadoon)
2. DevOps Manager
3. CTO / Director of Engineering
4. VP Engineering

---

## Common Incidents

### Incident 1: Jira Connectivity Lost

**Symptoms:** All runs fail at story fetch

**Response:**
1. Verify Jira status page
2. Check network connectivity
3. Verify credentials
4. Wait for Jira recovery OR use cached stories

**Time to Resolve:** 15-30 minutes

### Incident 2: App Server Down

**Symptoms:** Orchestrator times out during test execution

**Response:**
1. Check app server status
2. Verify DNS resolution
3. Check firewall rules
4. Restart app server

**Time to Resolve:** 10-20 minutes

### Incident 3: Disk Space Full

**Symptoms:** Screenshot capture fails

**Response:**
1. Check disk space: \df -h\
2. Clean old test runs: \m -rf qa-agent/runs/old-*\
3. Archive backups
4. Restart service

**Time to Resolve:** 5-15 minutes

---

## Recovery Procedures

### Quick Restart

\\\ash
# Stop all services
pkill -f qa-orchestrator
sleep 5

# Start services
npm start

# Verify health
node qa-agent/commands/qa-setup.js --verify
\\\

### Failover

If primary system fails:
1. Switch to backup instance
2. Verify configuration
3. Resume test runs
4. Notify users

---

**Last Updated:** 2026-10-30