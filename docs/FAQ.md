# Frequently Asked Questions

**QA AZM Digital Agent — Common Questions & Answers**

---

## Getting Started

### Q: How long does a typical test run take?
**A:** It varies based on story complexity:
- Simple story (3-5 ACs): 3-5 minutes
- Medium story (5-10 ACs): 8-12 minutes  
- Complex story (10+ ACs): 15-20 minutes

The interactive browser actions take the most time.

### Q: What browser does the system use?
**A:** Chromium via Playwright by default. You can configure other browsers in `qa-agent/config.json`:
- Chrome (desktop)
- Firefox
- Safari (macOS only)
- Edge

### Q: Do I need to be a developer to use this?
**A:** No. The `/qa-run` command requires only:
- A Jira story key
- Knowledge of your application
- Basic understanding of test acceptance criteria

### Q: Can I run tests on a staging server?
**A:** Yes. Edit `qa-agent/config.json` and set:
```json
{
  "app": {
    "baseUrl": "https://staging.example.com"
  }
}
```

---

## Test Execution

### Q: How do I skip certain test cases?
**A:** Configure in `qa-agent/config.json`:
```json
{
  "execution": {
    "skipCases": ["TC-001", "TC-005"]
  }
}
```

Or pass via CLI:
```bash
/qa-run PROJ-123 --skip TC-001,TC-005
```

### Q: What happens if a test fails?
**A:** The system:
1. Captures a screenshot
2. Logs the error details
3. Continues with other tests
4. Proposes the failure as a bug

### Q: Can I run tests on a headless server?
**A:** Yes. Set in config:
```json
{
  "browser": {
    "headless": true
  }
}
```

### Q: How many tests can run in parallel?
**A:** Currently single-threaded by default. For parallel execution:
```json
{
  "execution": {
    "parallel": true,
    "maxWorkers": 4
  }
}
```

### Q: Can I test mobile apps?
**A:** Yes, via device emulation in config:
```json
{
  "device": {
    "name": "iPhone 12",
    "viewport": {"width": 390, "height": 844}
  }
}
```

---

## Reports & Results

### Q: Where are test results stored?
**A:** In the run folder:
```
qa-agent/runs/PROJ-123/
├── story.json
├── test-cases.json
├── results.json
├── screenshots/
│   ├── TC-001.png
│   ├── TC-002.png
│   └── ...
└── report.html
```

### Q: Can I share the report with stakeholders?
**A:** Yes. The `report.html` file is standalone and can be:
- Emailed as an attachment
- Hosted on a web server
- Shared in Slack or Teams
- Embedded in project dashboards

### Q: How do I understand the verdict?
**A:** The verdict indicates test readiness:
- **GO** ✅ — All acceptance criteria have passing tests; story is ready
- **NO-GO** ❌ — Issues exist that must be resolved first

See [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for details.

### Q: What's included in the bug report?
**A:** Each bug includes:
- Title and description
- Screenshots showing the issue
- Console error logs
- Steps to reproduce
- Linked Jira issue reference

---

## Integration & Automation

### Q: How do I integrate with CI/CD?
**A:** See [CI_CD_SETUP.md](CI_CD_SETUP.md) for:
- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps

### Q: Can tests run on every commit?
**A:** Yes. Configure a CI pipeline to run:
```bash
/qa-run <STORY-KEY> --ci-mode
```

### Q: How do I upload results to a dashboard?
**A:** The system supports:
- JSON export (for custom processing)
- HTML reports (for viewing)
- Jira integration (automatic bug filing)
- Webhook notifications (custom integration)

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).

### Q: Can I run tests on different browsers in CI?
**A:** Yes, set matrix strategy in your CI config:
```yaml
browsers: [chrome, firefox, safari]
```

---

## Jira & Bug Tracking

### Q: Do bugs automatically file to Jira?
**A:** Partially:
1. **Phase A:** Bugs are drafted but not filed (review step)
2. **Gate 2:** You approve which bugs to file
3. **Phase B:** Only approved bugs are created in Jira

This prevents accidental duplicate filing.

### Q: Can I link tests to different Jira projects?
**A:** Currently tests link to the story's project. For cross-project links, see [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).

### Q: How are bugs deduplicated?
**A:** The system checks for existing bugs with:
- Same title
- Same test case
- Same acceptance criterion
- Within past 7 days

Duplicates are flagged for review.

---

## Troubleshooting

### Q: Tests are timing out. What should I do?
**A:** 
1. Check app responsiveness: Is it running?
2. Increase timeout in config:
```json
{
  "execution": {
    "timeout": 120000
  }
}
```
3. Check network: Is connection stable?
4. Review logs in `qa-agent/runs/PROJ-123/logs/`

### Q: Screenshots aren't being captured.
**A:**
1. Verify write permissions to `qa-agent/runs/`
2. Check disk space: `df -h` (Unix) or `dir C:\` (Windows)
3. Restart Playwright:
```bash
npx playwright install --with-deps
```

### Q: Jira connection is failing.
**A:**
1. Verify URL format: `https://your-jira.atlassian.net`
2. Check credentials in config (username/API token)
3. Test connection:
```bash
node qa-agent/commands/qa-setup.js --verify
```

### Q: Browser crashes during execution.
**A:**
1. Increase memory: Check system RAM available
2. Reduce parallel workers
3. Clear browser cache:
```bash
/qa-run PROJ-123 --no-cache
```

### Q: Test coverage shows 0%.
**A:**
1. Verify story has acceptance criteria in Jira
2. Check that test cases were generated:
   - Look at `test-cases.json` in run folder
3. Ensure Gate 1 approval happened

---

## Performance & Optimization

### Q: How can I speed up test runs?
**A:**
1. Reduce browser startup time: Use headless mode
2. Parallel execution: Set `parallel: true`
3. Skip non-critical tests: Use `skipCases`
4. Optimize network: Test on staging with less load

### Q: What are resource requirements?
**A:** Minimum:
- CPU: 2 cores
- RAM: 4 GB
- Disk: 1 GB free
- Network: 5 Mbps stable connection

See [INFRASTRUCTURE_SIZING.md](INFRASTRUCTURE_SIZING.md) for scaling.

### Q: Can I cache test results?
**A:** Currently no caching between runs. Results are always fresh.

---

## AIO Tests Integration

### Q: What is AIO Tests?
**A:** Cloud-based test management platform. The system can sync approved test cases to AIO automatically.

### Q: How do I enable AIO sync?
**A:** See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for setup steps.

### Q: Are AIO tests updated automatically?
**A:** No. Each run creates new test cases in AIO. You manually manage versions.

---

## Advanced Topics

### Q: Can I write custom test logic?
**A:** Yes. See [qa-agent/agents/qa-test-executor.js](../qa-agent/agents/qa-test-executor.js) for extensibility.

### Q: How do I debug a failed test?
**A:** 
1. Check screenshot in run folder
2. Review console logs in `results.json`
3. Re-run with debug mode:
```bash
DEBUG=* /qa-run PROJ-123
```

### Q: Can I test APIs alongside UI?
**A:** The current system focuses on UI testing. For API testing, see [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).

---

## Getting Help

- **Technical Issues?** → [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md)
- **Operational Questions?** → [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)
- **Setup Help?** → [QUICK_START.md](QUICK_START.md)
- **Escalation?** → [ESCALATION_PROCEDURES.md](ESCALATION_PROCEDURES.md)

---

**Developed by:** Usama Arshad Jadoon  
**Role:** QC Lead  
**Company:** AZM Digital
