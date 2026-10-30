# Migration Checklist

**QA AZM Digital Agent — Version Upgrade Guide**

---

## Pre-Migration

### Prerequisites
- [ ] Backup current configuration
- [ ] Document current test results
- [ ] Notify team of planned migration
- [ ] Schedule maintenance window

### Verification
- [ ] All current tests passing
- [ ] No active test runs
- [ ] Backups completed
- [ ] Rollback plan documented

---

## Migration Steps

### Step 1: Update Code (5 minutes)
`ash
git pull origin main
npm install
`

### Step 2: Update Configuration (10 minutes)
`ash
# Review changes
diff qa-agent/config.json qa-agent/docs/config.example.json

# Update if needed
cp qa-agent/docs/config.example.json qa-agent/config.new.json
# Manually merge your settings
`

### Step 3: Run Verification (5 minutes)
`ash
node qa-agent/commands/qa-setup.js --verify
`

Expected output:
`
✅ Jira connection: OK
✅ App server: OK
✅ Configuration: OK
`

### Step 4: Test Run (15 minutes)
`ash
/qa-run <TEST-STORY> --ci-mode
`

### Step 5: Verify Results (5 minutes)
- Check report.html
- Verify all test cases ran
- Confirm no errors

---

## Post-Migration

### Validation Checklist
- [ ] All tests execute successfully
- [ ] Reports generate correctly
- [ ] Jira integration working
- [ ] No performance degradation
- [ ] Team trained on changes

### Communication
- [ ] Notify team of successful migration
- [ ] Update documentation if needed
- [ ] Archive old test results
- [ ] Update CI/CD pipelines

---

## Rollback Plan

If issues occur:

`ash
# Revert to previous version
git checkout <PREVIOUS-VERSION>
npm install
/qa-run <TEST-STORY>
`

Contact QC Lead for assistance.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests fail after update | Clear node_modules and reinstall |
| Jira connection fails | Update credentials in config.json |
| Performance degraded | Restart services and verify hardware |
| Reports missing | Check disk space and permissions |

---

**Estimated Time:** 45 minutes  
**Risk Level:** Low  
**Support:** QC Lead (Usama Arshad Jadoon)