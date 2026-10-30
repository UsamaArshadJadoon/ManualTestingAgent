# Alert Thresholds & Escalation Guide

## Overview

This document defines alert thresholds, severity levels, escalation procedures, and remediation steps for the AI QC Framework metrics monitoring system.

## Severity Levels

### CRITICAL (Red)

**Definition**: System performance is significantly degraded or non-functional

**Deviation**: >50% from baseline

**Response Time**: Immediate (< 5 minutes)

**Actions**:
1. Page on-call engineer
2. Create incident ticket
3. Execute emergency runbook
4. Notify stakeholders

**Example**: Retry success rate drops from 94% to 47%

---

### WARNING (Yellow)

**Definition**: System performance is noticeably degraded but functional

**Deviation**: 10-50% from baseline

**Response Time**: Urgent (< 30 minutes)

**Actions**:
1. Create ticket in monitoring backlog
2. Assign to primary on-call
3. Investigate root cause
4. Update status page if needed

**Example**: Retry success rate drops from 94% to 70%

---

### INFO (Blue)

**Definition**: Minor metric deviation; investigation recommended

**Deviation**: <10% from baseline

**Response Time**: Standard (< 24 hours)

**Actions**:
1. Log in monitoring system
2. Add to daily metric review
3. Investigate trend

**Example**: Retry success rate drops from 94% to 88%

---

## Phase 2: Resilience Alerts

### Alert: Retry Success Rate Below 90%

**Metric**: `phase2.retrySuccessRate`

**Baseline Target**: >90%

**Thresholds**:
- CRITICAL: <70% (20+ point drop)
- WARNING: 70-89% (5-20 point drop)
- INFO: 89-90% (<5 point drop)

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check error logs for failed retry attempts
2. Verify external service connectivity
3. Review recent code changes
4. Check resource availability (CPU, memory)
5. Review network timeouts

**Mitigation**:
- Increase retry timeout values
- Improve network resilience
- Reduce concurrent retry attempts
- Add exponential backoff

**Escalation Path**:
- INFO → Team Lead (4 hours)
- WARNING → Engineering Manager (30 min)
- CRITICAL → VP Engineering (5 min)

---

### Alert: Resource Cleanup Failure

**Metric**: `phase2.resourceCleanupSuccess`

**Baseline Target**: 100%

**Thresholds**:
- CRITICAL: <97% (cleanup failures)
- WARNING: 97-100% (cleanup delays)
- INFO: 100% (no alert)

**Triggers**: Any failure detected

**Runbook**:
1. Identify failed resource types (DB, files, containers)
2. Check system resource limits
3. Review cleanup logic for edge cases
4. Verify permission settings
5. Check for orphaned resources

**Mitigation**:
- Implement forced cleanup with retries
- Add cleanup timeout handling
- Create cleanup validation checks
- Add resource monitoring

**Escalation Path**:
- CRITICAL → On-Call Eng Manager (5 min)
- Create incident, assign root cause

---

### Alert: Health Check Time Exceeds 10 seconds

**Metric**: `phase2.healthCheckTime`

**Baseline Target**: <10s

**Thresholds**:
- CRITICAL: >15s (50% over target)
- WARNING: 10-15s (at/over target)
- INFO: 9-10s (near target)

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check external service health checks
2. Review network latency
3. Analyze database query performance
4. Check for resource contention
5. Review health check implementation

**Mitigation**:
- Parallelize health checks
- Add caching to health check results
- Reduce check frequency if acceptable
- Optimize database queries

**Escalation Path**:
- INFO → Team Lead (8 hours)
- WARNING → Engineering Manager (1 hour)
- CRITICAL → VP Engineering (15 min)

---

### Alert: Error Classification Accuracy Below 95%

**Metric**: `phase2.errorClassificationAccuracy`

**Baseline Target**: >95%

**Thresholds**:
- CRITICAL: <80% (many misclassifications)
- WARNING: 80-94% (some misclassifications)
- INFO: 94-95% (edge cases)

**Triggers**: 5 minutes sustained

**Runbook**:
1. Review error classification rules
2. Identify misclassified error types
3. Check for new error patterns
4. Review recent changes to classifier
5. Analyze edge case errors

**Mitigation**:
- Retrain classification model
- Add missing error patterns
- Improve pattern matching logic
- Add manual review for uncertain classifications

**Escalation Path**:
- INFO → Team Lead (1 day)
- WARNING → Engineering Manager (4 hours)
- CRITICAL → ML Engineer (1 hour)

---

## Phase 3: Observability Alerts

### Alert: Diagnostics Collection Time Exceeds 10 seconds

**Metric**: `phase3.diagnosticsCollectionTime`

**Baseline Target**: <10s

**Thresholds**:
- CRITICAL: >15s
- WARNING: 10-15s
- INFO: 9-10s

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check log aggregation service
2. Review query performance against logs
3. Analyze network latency to logging service
4. Check for high-volume log writes
5. Review diagnostic data collectors

**Mitigation**:
- Increase log query timeout
- Implement log sampling
- Add result caching
- Optimize log indexing
- Parallelize data collection

**Escalation Path**:
- INFO → Team Lead (2 hours)
- WARNING → Engineering Manager (30 min)
- CRITICAL → Infrastructure Lead (10 min)

---

### Alert: Progress Tracking Accuracy Below 100%

**Metric**: `phase3.progressTrackingAccuracy`

**Baseline Target**: 100%

**Thresholds**:
- CRITICAL: <95%
- WARNING: 95-100%
- INFO: 100% (no alert)

**Triggers**: Any drop from 100%

**Runbook**:
1. Check progress tracking state management
2. Review progress calculation logic
3. Verify database consistency
4. Check for lost progress updates
5. Review concurrency issues

**Mitigation**:
- Implement progress update verification
- Add checksums to progress data
- Improve database transaction handling
- Add progress audit trail

**Escalation Path**:
- CRITICAL → On-Call Eng Manager (5 min)

---

### Alert: Log Query Response Time Exceeds 1 second

**Metric**: `phase3.logQueryResponseTime`

**Baseline Target**: <1s

**Thresholds**:
- CRITICAL: >3s
- WARNING: 1-3s
- INFO: 0.8-1s

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check logging service health
2. Review query performance
3. Analyze index statistics
4. Check for log query backlog
5. Review disk I/O performance

**Mitigation**:
- Add query result caching
- Optimize log indexes
- Reduce query result set
- Add query time limits
- Archive old logs

**Escalation Path**:
- INFO → DBA/Ops (4 hours)
- WARNING → Engineering Manager (1 hour)
- CRITICAL → Infrastructure Lead (15 min)

---

### Alert: Troubleshooting Guide Generation Time Exceeds 5 seconds

**Metric**: `phase3.troubleshootingGuideGenerationTime`

**Baseline Target**: <5s

**Thresholds**:
- CRITICAL: >10s
- WARNING: 5-10s
- INFO: 4-5s

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check AI/ML service performance
2. Review guide generation logic
3. Check for complex error patterns
4. Analyze knowledge base queries
5. Review LLM API latency

**Mitigation**:
- Implement guide caching
- Optimize LLM prompts
- Use simpler guide templates
- Add guide generation timeout
- Pre-generate common guides

**Escalation Path**:
- INFO → ML Engineer (6 hours)
- WARNING → Engineering Manager (1 hour)
- CRITICAL → ML Engineer Lead (15 min)

---

## Phase 4: Advanced Alerts

### Alert: Flaky Test Detection Accuracy Below 90%

**Metric**: `phase4.flakyTestDetectionAccuracy`

**Baseline Target**: >90%

**Thresholds**:
- CRITICAL: <80%
- WARNING: 80-89%
- INFO: 89-90%

**Triggers**: 5 minutes sustained

**Runbook**:
1. Review flaky test detection algorithm
2. Analyze false positive/negative rates
3. Check for new flaky patterns
4. Review recent test changes
5. Analyze test environment stability

**Mitigation**:
- Retrain detection model
- Adjust sensitivity thresholds
- Improve historical data collection
- Add environment isolation checks
- Manual review of edge cases

**Escalation Path**:
- INFO → QA Lead (1 day)
- WARNING → Engineering Manager (4 hours)
- CRITICAL → QA Manager (1 hour)

---

### Alert: High Memory Usage Per Agent

**Metric**: `phase4.memoryUsagePerAgent`

**Baseline Target**: <500MB

**Thresholds**:
- CRITICAL: >700MB (40% over target)
- WARNING: 500-700MB (at/over target)
- INFO: 450-500MB (near target)

**Triggers**: 10 minutes sustained

**Runbook**:
1. Check for memory leaks in agent
2. Review heap usage patterns
3. Analyze long-running agents
4. Check for excessive logging
5. Review cache sizes

**Mitigation**:
- Implement garbage collection tuning
- Add memory pooling
- Reduce cache retention
- Implement agent recycling
- Add resource limits per agent

**Escalation Path**:
- INFO → Team Lead (4 hours)
- WARNING → Engineering Manager (1 hour)
- CRITICAL → Performance Engineer (15 min)

---

### Alert: Disk Cleanup Effectiveness Below 100%

**Metric**: `phase4.diskCleanupEffectiveness`

**Baseline Target**: 100%

**Thresholds**:
- CRITICAL: <95%
- WARNING: 95-100%
- INFO: 100% (no alert)

**Triggers**: Any drop from 100%

**Runbook**:
1. Identify files not cleaned
2. Check file permissions
3. Review cleanup logic for edge cases
4. Check for file locks
5. Verify cleanup schedule execution

**Mitigation**:
- Implement forced cleanup with retries
- Fix file permission issues
- Improve cleanup error handling
- Add cleanup validation
- Increase cleanup timeout

**Escalation Path**:
- CRITICAL → On-Call Eng Manager (5 min)

---

### Alert: Low Performance Improvement

**Metric**: `phase4.performanceImprovement`

**Baseline Target**: >20%

**Thresholds**:
- CRITICAL: <10%
- WARNING: 10-20%
- INFO: 15-20%

**Triggers**: 5 minutes sustained

**Runbook**:
1. Check optimization code changes
2. Review performance profiler data
3. Analyze test environment performance
4. Check for regression in optimizations
5. Review caching effectiveness

**Mitigation**:
- Review optimization implementation
- Profile for new bottlenecks
- Improve optimization algorithms
- Add performance monitoring
- Increase optimization investment

**Escalation Path**:
- INFO → Performance Lead (2 days)
- WARNING → Engineering Manager (1 day)
- CRITICAL → VP Engineering (4 hours)

---

## Anomaly Detection Configuration

### Standard Deviation Thresholds

```javascript
// Default: deviation > stdDev * 2 triggers warning
const zScoreThresholds = {
  CRITICAL: 3.0,  // 3 standard deviations
  WARNING: 2.0,   // 2 standard deviations
  INFO: 1.0       // 1 standard deviation
};
```

### Baseline Deviation Thresholds

```javascript
const deviationThresholds = {
  CRITICAL: 0.50,  // 50% deviation
  WARNING: 0.10,   // 10% deviation
  INFO: 0.05       // 5% deviation
};
```

---

## Escalation Chain

### On-Call Schedule

```
Level 1: Primary On-Call Engineer (response: 15 min)
Level 2: Engineering Manager (response: 30 min)
Level 3: VP Engineering (response: 1 hour)
```

### Escalation Triggers

- CRITICAL alert not acknowledged: 5 minutes
- CRITICAL alert not resolved: 30 minutes
- WARNING alert not acknowledged: 30 minutes
- WARNING alert not resolved: 4 hours

---

## Alert Acknowledgment & Resolution

### Acknowledgment

1. Acknowledge alert in monitoring system
2. Create incident ticket
3. Add brief description of investigation plan
4. Update status message

### Resolution

1. Document root cause
2. Document remediation steps taken
3. Close incident ticket
4. Plan long-term fix
5. Update runbook if needed

### Post-Mortem

- For CRITICAL alerts: full post-mortem within 24 hours
- For WARNING alerts: brief review within 5 days
- Document findings and preventive measures

---

## Metric Exemptions & Overrides

### Scheduled Maintenance

```
alert_disabled_during: ["2024-11-15 00:00 to 06:00", "...]
reason: Database migration
alerting_manager: ops-team@company.com
```

### Known Issues

```
metric: phase3.logQueryResponseTime
exemption: >2s during 22:00-23:00 daily
reason: Nightly log compaction
until: 2024-12-31
```

---

## Alert Review & Tuning

### Weekly Review

- Analyze false positive rate
- Review alert response times
- Check for missing alerts
- Adjust thresholds if needed

### Monthly Review

- Trend analysis
- Threshold optimization
- Alert effectiveness report
- Process improvements

### Quarterly Review

- Baseline update
- Target adjustment
- New metric addition
- Escalation process improvement

---

## Related Documents

- [README.md](./README.md) - Metrics collection guide
- [BASELINE_REPORT.md](./BASELINE_REPORT.md) - Baseline metrics report
- [dashboard-config.json](./dashboard-config.json) - Dashboard configuration
