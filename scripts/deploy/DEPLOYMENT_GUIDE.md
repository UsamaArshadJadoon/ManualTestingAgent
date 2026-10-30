# AI QC Framework - Deployment Guide

## Quick Start

### Windows (PowerShell)
```powershell
# 1. Navigate to scripts directory
cd "path\to\scripts\deploy"

# 2. Validate framework
.\deploy-validate.ps1

# 3. Deploy to staging
.\deploy-staging.ps1 -Version "v2.0.0"

# 4. Test canary
.\deploy-canary.ps1 -Version "v2.0.0"

# 5. Production rollout
.\deploy-production.ps1 -Version "v2.0.0"
```

### Linux/Mac (Bash)
```bash
# 1. Navigate to scripts directory
cd "path/to/scripts/deploy"

# 2. Make scripts executable
chmod +x *.sh

# 3. Validate framework
./deploy-validate.sh

# 4. Deploy to staging
./deploy-staging.sh

# 5. Test canary
./deploy-canary.sh

# 6. Production rollout
./deploy-production.sh
```

## Step-by-Step Deployment Process

### Phase 1: Pre-Deployment Validation (30 minutes)

**Objective:** Ensure framework is ready for deployment

**Commands:**
```bash
# PowerShell
.\deploy-validate.ps1 -FrameworkPath "C:\AI QC Framework" -ReportPath ".\validation-report.json"

# Bash
./deploy-validate.sh "/path/to/framework" "./validation-report.json"
```

**Validation Checks:**
- ✓ All 20 Phase 1-4 tools exist
- ✓ Configuration files valid JSON
- ✓ Database connectivity
- ✓ Memory available (min 2GB)
- ✓ Disk space available (min 10GB)
- ✓ No breaking changes detected

**Success Criteria:**
- Status: PASSED
- Total checks: 20+
- Failed checks: 0

**If Validation Fails:**
1. Review `validation-report.json`
2. Check error details in logs
3. Fix issues and re-run validation
4. Do NOT proceed until validation passes

**Output Files:**
- `validation-report.json` - Validation results
- `validation-*.log` - Detailed log

---

### Phase 2: Staging Deployment (45-60 minutes)

**Objective:** Deploy Phase 2-4 tools to staging and verify functionality

**Commands:**
```bash
# PowerShell
.\deploy-staging.ps1 -FrameworkPath "C:\AI QC Framework" `
                    -StagingPath "C:\staging" `
                    -Version "v2.0.0" `
                    -TestSuite ".\tests\full-suite.ps1" `
                    -ReportPath ".\staging-deployment-report.json"

# Bash
./deploy-staging.sh "." "./staging" "v2.0.0" "./tests/full-suite.sh"
```

**Deployment Stages:**

1. **Pre-Deployment Checks** (5 min)
   - Framework path validation
   - Staging path creation
   - Disk space verification
   - Status: Check logs

2. **Backup Current Environment** (10 min)
   - Backs up existing staging tools
   - Retains last 5 backups
   - Status: Check logs for backup path

3. **Deploy Tools** (10 min)
   - Copies Phase 2-4 tools (15 tools total)
   - Copies configuration files
   - Status: Check logs for each tool

4. **Run Test Suite** (20 min)
   - Executes full test suite
   - Captures test results
   - Status: Check test pass/fail counts

5. **Verify Metrics** (5 min)
   - Retry success rate > 90% ✓
   - Cleanup success rate = 100% ✓
   - Health checks all pass ✓

**Success Criteria:**
- Overall status: COMPLETED
- All stages: COMPLETED
- Retry success rate: > 90%
- Cleanup success: = 100%
- Health checks: = 100%
- Tests failed: 0-2 (minor issues OK)

**If Staging Fails:**
1. Review `staging-deployment-report.json`
2. Check `deployment-*.log` for errors
3. Review test failures in test output
4. Rollback: Delete staging directory and try again
5. Fix issues and re-deploy

**Output Files:**
- `staging-deployment-report.json` - Deployment metrics
- `deployment-<ID>.log` - Detailed deployment log

**Metrics to Review:**
- Retry success rate: 92% (GOOD - above 90%)
- Cleanup success: 100% (GOOD - equals 100%)
- Health check pass: 100% (GOOD - equals 100%)
- Tests passed: 150 (OK)
- Tests failed: 2 (minor issues)

---

### Phase 3: Canary Deployment (24+ hours)

**Objective:** Test version in production with 5% of users before full rollout

**Commands:**
```bash
# PowerShell
.\deploy-canary.ps1 -Version "v2.0.0" `
                    -CanaryPercentage 5 `
                    -ProductionPath "C:\production" `
                    -ReportPath ".\canary-deployment-report.json"

# Bash
./deploy-canary.sh "v2.0.0" 5 1440 "./production"
```

**Canary Process:**

1. **User Selection** (5 min)
   - Selects 5% of production users (5,000 users)
   - Creates user mapping: `canary-users-<ID>.json`
   - Status: Confirmed

2. **Canary Deployment** (10 min)
   - Deploys version to isolated canary environment
   - Tools ready for 5% of traffic
   - Status: Check logs

3. **Metrics Monitoring** (24 hours)
   - Monitors error rate (requirement: < 5%)
   - Monitors P95 latency (requirement: < 1000ms)
   - Monitors CPU usage (requirement: < 85%)
   - Monitors memory usage (requirement: < 85%)
   - Checks performed every 5 minutes
   - Total: ~288 checks over 24 hours

4. **Metrics Analysis** (10 min)
   - Calculates average metrics
   - Compares against thresholds
   - Generates recommendation

5. **Recommendation**
   - PROCEED if all metrics pass
   - ROLLBACK if any metric fails

**Success Criteria:**
- Status: COMPLETED
- Recommendation: PROCEED
- Error rate: < 5% (e.g., 1.2%)
- P95 latency: < 1000ms (e.g., 280ms)
- CPU usage: < 85% (e.g., 45%)
- Memory usage: < 85% (e.g., 55%)
- Failure rate: < 5%

**If Canary Fails:**
1. Review `canary-deployment-report.json`
2. Check which metric failed
3. Review `canary-deployment-<ID>.log` for errors
4. Recommendation: ROLLBACK (not PROCEED)
5. Do NOT proceed to production
6. Investigate root cause
7. Fix issues and re-deploy

**Output Files:**
- `canary-deployment-report.json` - Canary results
- `canary-deployment-<ID>.log` - Monitoring log
- `canary-users-<ID>.json` - User mapping

**Important Notes:**
- Do NOT interrupt 24-hour monitoring
- Monitor logs in real-time if critical
- Allow full 24-hour monitoring period
- Review metrics before deciding to proceed

---

### Phase 4: Production Gradual Rollout (2-3 hours)

**Objective:** Roll out version to 100% of production users in stages

**ONLY PROCEED IF CANARY RECOMMENDATION = PROCEED**

**Commands:**
```bash
# PowerShell
.\deploy-production.ps1 -Version "v2.0.0" `
                        -ProductionPath "C:\production" `
                        -ReportPath ".\production-rollout-report.json"

# Bash
./deploy-production.sh "v2.0.0" "./production" "false"
```

**Rollout Stages:**

**Stage 1: 5% Deployment** (0-45 min)
- Deploys to 5,000 users
- Monitors for 30 minutes
- Checks for errors, latency, CPU/memory
- Requires: Failure rate < 5%
- Status: Check logs
- Decision: PROCEED to 25% or ROLLBACK

**Stage 2: 25% Deployment** (45-90 min)
- Deploys to additional 20,000 users (total 25,000)
- Monitors for 30 minutes
- Same metrics as Stage 1
- Status: Check logs
- Decision: PROCEED to 50% or ROLLBACK

**Stage 3: 50% Deployment** (90-135 min)
- Deploys to additional 25,000 users (total 50,000)
- Monitors for 30 minutes
- Same metrics as Stage 1
- Status: Check logs
- Decision: PROCEED to 100% or ROLLBACK

**Stage 4: 100% Deployment** (135-165 min)
- Deploys to remaining 50,000 users (total 100,000)
- FULL PRODUCTION RELEASE
- Status: Check logs

**Success Criteria:**
- Status: COMPLETED
- Overall status: COMPLETED
- Stages deployed: [5, 25, 50, 100]
- No rollback triggered
- All stages: PASSED

**If Stage Fails:**
1. AUTO-ROLLBACK automatically triggers
2. Version reverted to previous stable version
3. Review `production-rollout-report.json`
4. Check which stage failed
5. Investigate root cause
6. Fix issues and re-deploy

**Output Files:**
- `production-rollout-report.json` - Rollout results
- `production-rollout-<ID>.log` - Detailed progress

**Critical Monitoring:**
- Error rate at each stage
- P95 latency trending
- CPU and memory usage
- Failure rate (> 5% triggers rollback)

---

## Emergency Procedures

### Immediate Rollback

**If deployment is failing or causing issues:**

```bash
# PowerShell
.\rollback.ps1 -Version "v1.9.9" -ProductionPath "C:\production"

# Bash
./rollback.sh "v1.9.9" "./production"
```

**Rollback Process:**
1. Preparation (validates paths and backups)
2. Version revert (restores previous version)
3. Data restore (if data was corrupted)
4. Verification (health checks)
5. Notification (sends alerts)

**Expected Duration:** 5-10 minutes

**Success Indicators:**
- Version file updated to v1.9.9
- Tools restored from backup
- Health checks pass
- Services online

**Output Files:**
- `rollback-report-<ID>.json` - Rollback results
- `rollback-<ID>.log` - Detailed log

---

## Metrics & Success Criteria

### Staging Metrics
| Metric | Requirement | Status |
|--------|------------|--------|
| Retry Success Rate | > 90% | Must PASS |
| Cleanup Success Rate | 100% | Must PASS |
| Health Check Pass Rate | 100% | Must PASS |
| Test Pass Rate | > 95% | Should PASS |

### Canary Metrics
| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | < 5% | If fails: Rollback |
| P95 Latency | < 1000ms | If fails: Rollback |
| CPU Usage | < 85% | If fails: Rollback |
| Memory Usage | < 85% | If fails: Rollback |
| Failure Rate | < 5% | If fails: Rollback |

### Production Metrics
| Metric | Threshold | Stage |
|--------|-----------|-------|
| Error Rate | < 5% | All stages |
| P95 Latency | < 1000ms | All stages |
| Failure Rate | < 5% | All stages (auto-rollback if > 5%) |

---

## Troubleshooting

### Issue: Validation Fails

**Error:** "Framework path not found"
- **Solution:** Check framework path parameter
- **Check:** `Test-Path "C:\AI QC Framework"`

**Error:** "Tools directory not found"
- **Solution:** Verify tools folder exists in framework
- **Check:** `Get-ChildItem "C:\AI QC Framework\tools"`

**Error:** "Configuration file invalid JSON"
- **Solution:** Check JSON syntax in config file
- **Check:** `python3 -m json.tool config/deployment.json`

### Issue: Staging Deployment Fails

**Error:** "Insufficient disk space"
- **Solution:** Free up at least 5GB on drive
- **Check:** `df -h` (Linux) or `Get-Volume` (Windows)

**Error:** "Test suite execution failed"
- **Solution:** Check test suite is executable
- **Fix:** `chmod +x ./tests/full-suite.sh`

**Error:** "Metrics verification failed"
- **Solution:** Review metrics in staging-deployment-report.json
- **Action:** Fix tools that don't meet metrics and re-deploy

### Issue: Canary Metrics Exceed Threshold

**Error:** "Error rate: 7.5% (threshold: 5%)"
- **Recommendation:** ROLLBACK (do NOT proceed)
- **Investigation:** Check error logs in production
- **Action:** Fix performance issues and re-deploy

**Error:** "P95 latency: 1200ms (threshold: 1000ms)"
- **Recommendation:** ROLLBACK
- **Investigation:** Check database performance
- **Action:** Optimize queries and re-deploy

### Issue: Production Rollout Fails at 25%

**Error:** "Failure rate exceeded 5%"
- **Status:** AUTO-ROLLBACK automatically triggered
- **Action:** Version automatically reverted
- **Investigation:** Check error types in logs
- **Fix:** Deploy canary again after fixing issues

### Issue: Rollback Fails

**Error:** "No backup found for rollback"
- **Critical:** Manual intervention required
- **Action:** Contact infrastructure team
- **Check:** Verify backups in production/backups directory

---

## Best Practices Checklist

### Before Deployment
- [ ] Run pre-deployment validation
- [ ] Review validation report
- [ ] Check all metrics requirements met
- [ ] Verify backup storage has space
- [ ] Notify team of deployment schedule
- [ ] Have rollback procedures ready

### During Staging
- [ ] Monitor test execution in real-time
- [ ] Check for test failures
- [ ] Verify metric requirements met
- [ ] Review tool deployment logs
- [ ] Confirm all tools deployed successfully

### During Canary (24 hours)
- [ ] Monitor error rate continuously
- [ ] Check latency trending
- [ ] Watch CPU and memory usage
- [ ] Allow full 24-hour monitoring period
- [ ] Do NOT skip monitoring phase
- [ ] Review metrics before proceeding

### During Production Rollout
- [ ] Monitor each stage carefully
- [ ] Check logs between stages
- [ ] Verify no alerts triggered
- [ ] Be ready for emergency rollback
- [ ] Have team standing by
- [ ] Monitor for 30+ min per stage

### Post-Deployment
- [ ] Verify all systems online
- [ ] Check health indicators
- [ ] Review final metrics
- [ ] Archive deployment logs
- [ ] Document deployment results
- [ ] Send status update to team

---

## Timeline Example: Week 2 Phase 2 Production Deployment

```
09:00 - Pre-deployment validation (30 min)
09:30 - Staging deployment (45 min)
10:15 - Staging tests complete, metrics verified
        Review staging-deployment-report.json
10:30 - Canary deployment begins (5% users)
10:35 - Canary monitoring for 24 hours

10:30+24h = Next Day 10:30
10:30 - Canary monitoring complete
10:35 - Review canary-deployment-report.json
        Recommendation: PROCEED
10:40 - Production rollout begins
10:40 - Stage 1: 5% deployment (users: 5,000)
11:10 - Stage 1 complete, metrics verified
11:15 - Stage 2: 25% deployment (users: 25,000)
11:45 - Stage 2 complete, metrics verified
11:50 - Stage 3: 50% deployment (users: 50,000)
12:20 - Stage 3 complete, metrics verified
12:25 - Stage 4: 100% deployment (users: 100,000)
12:55 - Production rollout complete
        Version v2.0.0 at 100% production

Total Time: 30 min validation + 45 min staging + 24 hours canary + 2.25 hours rollout
= 27 hours 15 minutes total
```

---

## Support & Contact

**For Issues:**
1. Review relevant log file
2. Check JSON report for details
3. Consult this guide's troubleshooting section
4. Contact infrastructure team if critical

**Key Files to Share:**
- `validation-report.json`
- `staging-deployment-report.json`
- `canary-deployment-report.json`
- `production-rollout-report.json`
- `rollback-report-<ID>.json`
- `<operation>-<ID>.log`

---

**Last Updated:** 2026-10-30
**Version:** 1.0.0
