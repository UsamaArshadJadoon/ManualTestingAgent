# Deployment Scripts - Quick Reference Card

## 5 Core Scripts

### 1. Pre-Deployment Validation
**Purpose:** Verify framework readiness before deployment
- **PowerShell:** `.\deploy-validate.ps1`
- **Bash:** `./deploy-validate.sh`
- **Duration:** 5-10 min
- **Input:** Framework path
- **Output:** `validation-report.json`
- **Success:** All checks pass, no failures

### 2. Staging Deployment
**Purpose:** Deploy Phase 2-4 tools to staging environment
- **PowerShell:** `.\deploy-staging.ps1 -Version "v2.0.0"`
- **Bash:** `./deploy-staging.sh . ./staging v2.0.0`
- **Duration:** 45-60 min
- **Input:** Framework path, version, test suite path
- **Output:** `staging-deployment-report.json`
- **Success:** Retry > 90%, Cleanup = 100%, Health = 100%

### 3. Canary Deployment
**Purpose:** Test 5% of users in production for 24 hours
- **PowerShell:** `.\deploy-canary.ps1 -Version "v2.0.0"`
- **Bash:** `./deploy-canary.sh v2.0.0`
- **Duration:** 24 hours + 10 min setup
- **Input:** Version, canary percentage, monitoring duration
- **Output:** `canary-deployment-report.json`
- **Success:** Error < 5%, Latency < 1000ms, Recommendation = PROCEED

### 4. Production Gradual Rollout
**Purpose:** Roll out to 100% of production in 4 stages
- **PowerShell:** `.\deploy-production.ps1 -Version "v2.0.0"`
- **Bash:** `./deploy-production.sh v2.0.0`
- **Duration:** 2-3 hours (5 stages × 30 min)
- **Input:** Version
- **Output:** `production-rollout-report.json`
- **Success:** All stages PASSED, no rollback
- **Auto-Rollback:** If failure rate > 5% at any stage

### 5. Emergency Rollback
**Purpose:** Immediately revert to previous version
- **PowerShell:** `.\rollback.ps1 -Version "v1.9.9"`
- **Bash:** `./rollback.sh v1.9.9`
- **Duration:** 5-10 min
- **Input:** Previous version to revert to
- **Output:** `rollback-report-<ID>.json`
- **Success:** Services online, data verified

---

## Quick Commands Reference

### Windows PowerShell

```powershell
# Set execution policy (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Validate framework
.\deploy-validate.ps1 -FrameworkPath "C:\AI QC Framework"

# Deploy to staging
.\deploy-staging.ps1 -Version "v2.0.0" -StagingPath "C:\staging"

# Deploy canary (5%)
.\deploy-canary.ps1 -Version "v2.0.0" -CanaryPercentage 5

# Production rollout
.\deploy-production.ps1 -Version "v2.0.0" -ProductionPath "C:\production"

# Emergency rollback
.\rollback.ps1 -Version "v1.9.9"
```

### Linux/Mac Bash

```bash
# Make scripts executable
chmod +x *.sh

# Validate framework
./deploy-validate.sh "/path/to/framework"

# Deploy to staging
./deploy-staging.sh . "./staging" "v2.0.0"

# Deploy canary (5%)
./deploy-canary.sh "v2.0.0" 5 1440

# Production rollout
./deploy-production.sh "v2.0.0" "./production"

# Emergency rollback
./rollback.sh "v1.9.9"
```

---

## Deployment Checklist

### Pre-Deployment (Day 0)
- [ ] Run `deploy-validate.ps1`
- [ ] Review `validation-report.json`
- [ ] Verify all checks PASSED
- [ ] Notify ops team
- [ ] Plan deployment window

### Staging Phase (Day 1, Morning)
- [ ] Run `deploy-staging.ps1 -Version "v2.0.0"`
- [ ] Monitor deployment logs
- [ ] Review `staging-deployment-report.json`
- [ ] Verify metrics requirements met
- [ ] Get approval to proceed

### Canary Phase (Day 1, Evening → Day 2, Evening)
- [ ] Run `deploy-canary.ps1 -Version "v2.0.0"`
- [ ] Let run for full 24 hours
- [ ] Monitor error rate and latency
- [ ] Review `canary-deployment-report.json`
- [ ] Check recommendation (PROCEED or ROLLBACK)
- [ ] Get final approval

### Production Rollout (Day 2, Evening)
- [ ] Only if canary recommendation = PROCEED
- [ ] Run `deploy-production.ps1 -Version "v2.0.0"`
- [ ] Monitor each stage carefully
- [ ] Total time: ~2.5 hours
- [ ] Review `production-rollout-report.json`
- [ ] Confirm 100% deployment

### Post-Deployment
- [ ] Verify all systems operational
- [ ] Check no active alerts
- [ ] Archive deployment logs
- [ ] Document results
- [ ] Celebrate success!

---

## Critical Metrics & Thresholds

| Phase | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| **Staging** | Retry Success | > 90% | MUST PASS |
| | Cleanup Success | 100% | MUST PASS |
| | Health Checks | 100% | MUST PASS |
| **Canary** | Error Rate | < 5% | ROLLBACK if fail |
| | P95 Latency | < 1000ms | ROLLBACK if fail |
| | CPU Usage | < 85% | ROLLBACK if fail |
| | Memory Usage | < 85% | ROLLBACK if fail |
| **Production** | Failure Rate | < 5% | AUTO-ROLLBACK |
| | P95 Latency | < 1000ms | Monitor closely |
| | Error Rate | < 5% | Monitor closely |

---

## File Structure

```
scripts/deploy/
├── deploy-validate.ps1          # PowerShell validation
├── deploy-validate.sh           # Bash validation
├── deploy-staging.ps1           # PowerShell staging
├── deploy-staging.sh            # Bash staging
├── deploy-canary.ps1            # PowerShell canary
├── deploy-canary.sh             # Bash canary
├── deploy-production.ps1        # PowerShell production
├── deploy-production.sh         # Bash production
├── rollback.ps1                 # PowerShell rollback
├── rollback.sh                  # Bash rollback
├── README.md                    # Full documentation
├── DEPLOYMENT_GUIDE.md          # Step-by-step guide
├── QUICK_REFERENCE.md           # This file
├── deployment-config.json       # Configuration
└── validation-report.json       # Example output
```

---

## Output Files Location

All scripts generate reports and logs in current directory:

**Validation:**
- `validation-report.json` - JSON report
- `validation-*.log` - Timestamped log

**Staging:**
- `staging-deployment-report.json` - JSON report
- `deployment-<ID>.log` - Deployment log

**Canary:**
- `canary-deployment-report.json` - JSON report
- `canary-deployment-<ID>.log` - Monitoring log
- `canary-users-<ID>.json` - User mapping

**Production:**
- `production-rollout-report.json` - JSON report
- `production-rollout-<ID>.log` - Rollout log

**Rollback:**
- `rollback-report-<ID>.json` - JSON report
- `rollback-<ID>.log` - Rollback log

---

## Common Issues & Quick Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Framework path not found" | Wrong path | Check path exists |
| "Insufficient disk space" | < 5GB free | Free up disk space |
| "Test suite not found" | Wrong path | Verify test file exists |
| "Metrics verification failed" | Tools not meeting requirements | Review specific metric and fix |
| "Canary recommendation: ROLLBACK" | Metrics exceeded | Don't proceed to production |
| "Auto-rollback triggered" | Failure rate > 5% | Check error logs |

---

## Success Indicators

### Staging - All Must Pass
- ✓ Retry success rate > 90%
- ✓ Cleanup success rate = 100%
- ✓ Health check pass rate = 100%
- ✓ Tests pass (most tests)

### Canary - All Must Pass
- ✓ Error rate < 5%
- ✓ P95 latency < 1000ms
- ✓ CPU usage < 85%
- ✓ Memory usage < 85%
- ✓ Failure rate < 5%
- ✓ Recommendation = PROCEED

### Production - Must Complete All Stages
- ✓ Stage 1 (5%): PASSED
- ✓ Stage 2 (25%): PASSED
- ✓ Stage 3 (50%): PASSED
- ✓ Stage 4 (100%): COMPLETED
- ✓ No auto-rollback triggered

---

## Emergency Actions

### Immediate Rollback Needed
```powershell
# PowerShell - Instant rollback
.\rollback.ps1 -Version "v1.9.9"
```

```bash
# Bash - Instant rollback
./rollback.sh "v1.9.9"
```

### Monitor Key Metrics Real-Time
- Error rate (should be < 1%)
- P95 latency (should be < 300ms)
- CPU usage (should be < 50%)
- Memory usage (should be < 60%)
- Active alerts (should be 0)

### Contact Points
- Ops Team: @ops-team
- DevOps Lead: @devops-lead
- Architecture: @architecture-team

---

## Deployment Timeline Example

```
Week 1: Phase 2 Staging
  Monday 09:00 - Validation (30 min)
  Monday 09:30 - Staging deployment (45 min)
  Monday 10:15 - Staging tests + metrics validation

Week 2: Phase 2 Production
  Monday 10:30 - Canary deployment (5%, 24 hr monitoring)
  Tuesday 10:30 - Canary decision: PROCEED
  Tuesday 10:40 - Production rollout starts
  Tuesday 13:00 - Production rollout complete (5%→25%→50%→100%)
  Tuesday 13:00 - v2.0.0 in full production

Week 3: Phase 3 Deployment (same pattern)
Week 4: Phase 4 Deployment (same pattern)
Week 5-6: Production stabilization

Total: ~6 weeks to full deployment
```

---

## Version Information

- **Script Version:** 1.0.0
- **Framework:** AI QC Framework
- **Phases:** 4 (20 tools total)
- **Environments:** Staging + Production
- **Platforms:** Windows + Linux/Mac
- **Status:** Production Ready

---

## Key Features

✓ **Cross-Platform:** Windows PowerShell + Linux/Mac Bash
✓ **Idempotent:** Safe to run multiple times
✓ **Automated:** Full pipeline automation
✓ **Validated:** Pre-deployment verification
✓ **Safe Rollout:** Canary + gradual deployment
✓ **Auto-Rollback:** Failure detection & reversal
✓ **Logged:** Full audit trail
✓ **Reported:** JSON reports for analysis
✓ **Monitored:** 24-hour metrics collection
✓ **Backed Up:** Automatic backup retention

---

**Quick Start:** Read DEPLOYMENT_GUIDE.md for detailed steps
**Support:** Check README.md for full documentation
**Last Updated:** 2026-10-30
