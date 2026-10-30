# Operations Runbook

**QA AZM Digital Agent — Daily Operations Procedures**

---

## Table of Contents
1. Health Checks
2. Starting/Stopping Services
3. Scheduled Tasks
4. Backup Procedures
5. Performance Monitoring
6. Incident Response

---

## Health Checks

### Daily Health Check (5 minutes)

Perform this every morning:

\\\ash
node qa-agent/commands/qa-setup.js --verify
\\\

Expected output:
\\\
✅ Jira connection: OK
✅ App server: OK
✅ Configuration: OK
✅ Disk space: OK
\\\

### Connection Verification

\\\ash
# Test Jira
curl -I https://your-jira.atlassian.net

# Test App
curl -I https://your-app.example.com

# Test Playwright
npx playwright install --check
\\\

---

## Starting Services

### Start QA Framework

\\\ash
cd /path/to/ManualTestingAgent
npm start
\\\

### Verify Services Running

\\\ash
ps aux | grep node
# Should show qa-orchestrator running
\\\

---

## Scheduled Tasks

### Daily (Every morning 8 AM)
- Run health checks
- Review previous day logs
- Check disk space

### Weekly (Every Monday)
- Backup test results
- Review metrics and trends
- Plan for upcoming releases

### Monthly (First day of month)
- Generate performance report
- Review cost analysis
- Plan infrastructure upgrades

---

## Backup Procedures

### Backup Test Results

\\\ash
tar -czf qa-runs-\.tar.gz qa-agent/runs/
mv qa-runs-*.tar.gz /backup/location/
\\\

### Backup Configuration

\\\ash
cp qa-agent/config.json qa-agent/config.\.backup
\\\

### Retention Policy
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

---

## Performance Monitoring

### Metrics to Watch

| Metric | Threshold | Action |
|--------|-----------|--------|
| Avg Test Time | >20 min | Investigate delays |
| Error Rate | >5% | Review error logs |
| Jira Failures | >10% | Check connectivity |
| Disk Usage | >80% | Clean up old runs |

### View Metrics

Check metrics/METRICS_SETUP_REPORT.json for current baseline.

---

## Incident Response

See [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for procedures.

---

**Last Updated:** 2026-10-30