# Monitoring Guide

**QA AZM Digital Agent — Setup & Operations**

---

## Key Metrics to Monitor

### System Health

- **CPU Usage:** Should stay below 80%
- **Memory Usage:** Should stay below 85%
- **Disk Usage:** Should stay below 85%
- **Network Latency:** Should be below 100ms to Jira

### Application Metrics

- **Test Success Rate:** Target 95%+
- **Average Test Duration:** Target under 15 minutes
- **Coverage:** Target 100%
- **Bug Detection Rate:** Measure weekly

### Business Metrics

- **Tests Run Per Day:** Track trend
- **Stories Tested Per Sprint:** Track trend
- **Bugs Found Early:** Track quality metric
- **Time to Fix Issues:** Track efficiency

---

## Setting Up Monitoring

### Prometheus Metrics

Export metrics from the framework:

`json
{
  "metrics": {
    "enabled": true,
    "prometheus": {
      "port": 9090,
      "interval": 60000
    }
  }
}
`

### Grafana Dashboard

Key panels:
- Test execution rate (tests per hour)
- Pass/fail breakdown (stacked bar)
- Average test duration (line graph)
- Coverage trends (area chart)
- Error rate (gauge)

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| High Error Rate | >5% | Investigate |
| Long Test Duration | >20 min | Optimize |
| Low Coverage | <90% | Review tests |
| High CPU Usage | >90% | Scale up |

---

## Dashboard Configuration

### Daily Dashboard

Monitor these every morning:
- Total test runs yesterday
- Pass rate
- New bugs filed
- System health

### Weekly Reports

Review every Monday:
- Trend analysis
- Performance changes
- Resource utilization
- Cost tracking

### Monthly Analysis

Review on 1st of month:
- ROI metrics
- Team productivity
- Infrastructure costs
- Planning for next month

---

## Logging

### Log Levels

- ERROR: System failures requiring attention
- WARN: Potential issues, may recover
- INFO: Normal operations
- DEBUG: Detailed debugging info

### Log Retention

- Daily logs: Keep 30 days
- Weekly summaries: Keep 1 year
- Monthly reports: Keep indefinitely
- Archive to S3 after 90 days

---

**Last Updated:** 2026-10-30