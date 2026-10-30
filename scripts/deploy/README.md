# AI QC Framework - Deployment Automation Scripts

Comprehensive deployment automation for the AI QC Framework with support for staging, canary, and production rollouts.

## Overview

This suite provides safe, repeatable production deployment with:
- Pre-deployment validation of all 20 Phase 1-4 tools
- Staging environment testing before production
- Canary deployment (5%) with 24-hour monitoring
- Gradual production rollout (5% → 25% → 50% → 100%)
- Auto-rollback on failure (>5% failure rate)
- Full logging and JSON reporting
- Cross-platform support (Windows PowerShell + Linux/Mac Bash)

## Scripts

### 1. Pre-Deployment Validation
Validates framework before any deployment.

**PowerShell:**
```powershell
.\deploy-validate.ps1 -FrameworkPath "c:\AI QC Framework" -ReportPath ".\validation-report.json"
```

**Bash:**
```bash
./deploy-validate.sh "c:/AI QC Framework" "./validation-report.json"
```

**Validates:**
- All 20 Phase 1-4 tools exist
- Configuration files are valid JSON
- Health checks pass
- No breaking changes
- Dependencies satisfied

**Output:** `validation-report.json`

### 2. Staging Deployment
Deploys Phase 2-4 tools to staging for validation.

**PowerShell:**
```powershell
.\deploy-staging.ps1 -Version "v2.0.0" -StagingPath "C:\staging" -ReportPath ".\staging-deployment-report.json"
```

**Bash:**
```bash
./deploy-staging.sh "c:/AI QC Framework" "./staging" "v2.0.0" "./tests/full-suite.sh" "./staging-deployment-report.json"
```

**Performs:**
1. Pre-deployment checks
2. Backs up current staging
3. Deploys Phase 2-4 tools
4. Runs full test suite
5. Verifies metrics:
   - Retry success > 90%
   - Cleanup success = 100%
   - Health checks = 100%

**Output:** `staging-deployment-report.json`, `deployment-<ID>.log`

### 3. Production Canary Deployment
Safe initial production test with 5% of users.

**PowerShell:**
```powershell
.\deploy-canary.ps1 -Version "v2.0.0" -CanaryPercentage 5 -ProductionPath "C:\production"
```

**Bash:**
```bash
./deploy-canary.sh "v2.0.0" 5 1440 "./production" "./canary-deployment-report.json"
```

**Performs:**
1. Selects 5% of production users
2. Deploys version to canary environment
3. Monitors metrics for 24 hours:
   - Error rate < 5%
   - P95 latency < 1000ms
   - CPU < 85%
   - Memory < 85%
4. Analyzes results
5. Recommends PROCEED or ROLLBACK

**Output:** `canary-deployment-report.json`, `canary-deployment-<ID>.log`, `canary-users-<ID>.json`

### 4. Production Gradual Rollout
Staged rollout with automatic progression and rollback.

**PowerShell:**
```powershell
.\deploy-production.ps1 -Version "v2.0.0" -ProductionPath "C:\production"
```

**Bash:**
```bash
./deploy-production.sh "v2.0.0" "./production" "false" "./production-rollout-report.json"
```

**Stages:**
1. **5% deployment** (5,000 users) → 30-min monitoring
2. **25% deployment** (25,000 users) → 30-min monitoring
3. **50% deployment** (50,000 users) → 30-min monitoring
4. **100% deployment** (100,000 users) → complete

**Auto-Rollback Triggers:**
- Failure rate > 5% at any stage
- Metrics threshold exceeded
- Stage evaluation fails

**Output:** `production-rollout-report.json`, `production-rollout-<ID>.log`

### 5. Emergency Rollback
Reverts to previous version immediately.

**PowerShell:**
```powershell
.\rollback.ps1 -Version "v1.9.9" -ProductionPath "C:\production"
```

**Bash:**
```bash
./rollback.sh "v1.9.9" "./production" "./production/backups"
```

**Performs:**
1. Preparation and validation
2. Reverts to previous version
3. Restores backups if data corrupted
4. Runs health checks
5. Logs rollback event
6. Sends alert notifications

**Output:** `rollback-report-<ID>.json`, `rollback-<ID>.log`

## Deployment Timeline

### Week 1: Phase 2 Staging
```
./deploy-validate.ps1                    # Pre-validate
./deploy-staging.ps1 -Version "v2.0"     # Deploy to staging
                                          # Run test suite
                                          # Verify metrics
```

### Week 2: Phase 2 Production
```
./deploy-canary.ps1 -Version "v2.0"      # Canary (5%)
                                          # Monitor 24 hours
./deploy-production.ps1 -Version "v2.0"  # Gradual rollout
                                          # 5% → 25% → 50% → 100%
```

### Weeks 3-4: Phase 3-4 Deployment
Repeat same process for Phase 3 and Phase 4 tools.

## Metrics & Monitoring

### Deployment Metrics Tracked

**Staging:**
- Retry success rate (requirement: > 90%)
- Cleanup success rate (requirement: 100%)
- Health check pass rate (requirement: 100%)
- Test pass/fail counts

**Canary:**
- Error rate (threshold: < 5%)
- P95 latency (threshold: < 1000ms)
- CPU usage (threshold: < 85%)
- Memory usage (threshold: < 85%)
- Failure rate (threshold: < 5%)

**Production Rollout:**
- Error rate per stage
- P95 latency per stage
- Failure rate per stage (auto-rollback if > 5%)
- User count per stage

### Health Checks

All scripts validate:
- Database connectivity
- API availability
- Cache system health
- Messaging system health
- Disk space (min 10GB free)
- Memory available (min 2GB)

## Configuration Files

### deployment.json
```json
{
  "environments": {
    "staging": {
      "path": "c:/staging",
      "tools": ["regression-test-suite", "performance-test-runner", ...],
      "health_check_interval": 300
    },
    "production": {
      "path": "c:/production",
      "backup_retention": 5,
      "monitoring_duration": 1800
    }
  }
}
```

### environments.json
```json
{
  "staging": {
    "database_url": "localhost",
    "api_endpoint": "http://localhost:3000",
    "cache_enabled": true
  },
  "production": {
    "database_url": "prod-db.azuredb.net",
    "api_endpoint": "https://api.production.com",
    "cache_enabled": true,
    "replication": true
  }
}
```

## Usage Examples

### Full Deployment Pipeline
```bash
# 1. Validate framework
./deploy-validate.ps1

# 2. Deploy to staging
./deploy-staging.ps1 -Version "v2.0.0"

# 3. Deploy canary (5%)
./deploy-canary.ps1 -Version "v2.0.0"

# 4. Gradual rollout (if canary passed)
./deploy-production.ps1 -Version "v2.0.0"
```

### Windows PowerShell Execution
```powershell
# Set execution policy if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run script
.\deploy-validate.ps1 -FrameworkPath "C:\AI QC Framework"
```

### Linux/Mac Bash Execution
```bash
# Make scripts executable
chmod +x *.sh

# Run script
./deploy-validate.sh "/path/to/framework"
```

### Emergency Rollback
```bash
# Immediate rollback
./rollback.ps1 -Version "v1.9.9"

# Or with Bash
./rollback.sh "v1.9.9"
```

## Logging & Reports

All scripts generate:

**Logs:** `<operation>-<ID>.log`
- Timestamped entries
- All operations logged
- Success/error status
- Metrics values

**Reports:** `<operation>-report.json`
- Structured JSON output
- Deployment metadata
- Metrics and results
- Recommendations
- Stage details

**Examples:**
- `deployment-a1b2c3d4.log` - Detailed staging log
- `staging-deployment-report.json` - Staging results
- `canary-deployment-a1b2c3d4.log` - Canary monitoring log
- `canary-users-a1b2c3d4.json` - Canary user mapping
- `production-rollout-a1b2c3d4.log` - Rollout progress
- `rollback-a1b2c3d4.log` - Rollback execution log

## Failure Handling

### Auto-Rollback Triggers
1. Failure rate > 5% during any stage
2. Critical health check failure
3. Metrics threshold exceeded
4. Deployment validation error

### Manual Rollback
```bash
./rollback.ps1 -Version "previous"
```

## Best Practices

1. **Always validate first:**
   ```bash
   ./deploy-validate.ps1 before any deployment
   ```

2. **Test in staging:**
   ```bash
   ./deploy-staging.ps1 -Version "v2.0.0"
   ```

3. **Monitor canary carefully:**
   - Review canary-deployment-report.json
   - Check error rates and latency
   - Follow recommendation (PROCEED or ROLLBACK)

4. **Gradual production rollout:**
   - Don't skip stages
   - Monitor between stages
   - Allow 30+ minutes per stage

5. **Keep backups:**
   - Automatic backups before each deployment
   - Retains 5 most recent
   - Verify backup integrity

6. **Log everything:**
   - Archive deployment logs
   - Review reports for metrics
   - Track deployment history

## Troubleshooting

### Validation Fails
1. Check framework path exists
2. Verify all tools directory present
3. Validate config files are JSON
4. Check disk space and memory

### Staging Deployment Fails
1. Ensure staging path is writable
2. Check backup storage has space
3. Verify test suite is executable
4. Review staging-deployment-report.json

### Canary Metrics Exceed Threshold
1. Check error logs in production
2. Review latency metrics
3. Consider rollback
4. Investigate root cause

### Rollback Fails
1. Verify backup exists
2. Check backup path is accessible
3. Ensure version file writable
4. Manual intervention may be needed

## Advanced Options

### Custom Monitoring Duration
```powershell
.\deploy-canary.ps1 -MonitoringDurationMinutes 2880  # 48 hours
```

### Skip Canary Testing
```powershell
.\deploy-production.ps1 -SkipCanary $true
```

### Custom Backup Path
```powershell
.\rollback.ps1 -BackupPath "C:\custom\backup\location"
```

## Performance Metrics

**Typical Deployment Times:**
- Validation: 5-10 minutes
- Staging deployment: 15-20 minutes
- Staging tests: 30-45 minutes
- Canary: 24 hours + 10 minutes setup
- Production rollout: 2-3 hours total
- Rollback: 5-10 minutes

**Resource Requirements:**
- Disk space: 20GB minimum
- Memory: 4GB minimum
- Network: Stable connection
- CPU: 2+ cores recommended

## Support & Documentation

- Review logs in `<operation>-*.log` files
- Check JSON reports for detailed metrics
- All scripts include inline help (use `-?` or `--help`)
- Cross-platform tested on Windows 10+, Ubuntu 20.04+, macOS 11+

## Version History

- v1.0.0 - Initial release with all 5 deployment scripts
- PowerShell: Windows 5.1+
- Bash: 4.0+
- Cross-platform compatible

---

**Last Updated:** 2026-10-30
**Status:** Production Ready
