# Phase 2-4 FAQ — Common Questions Answered

**30+ Questions from QA Teams about Phase 2-4 Enhancements**

---

## Getting Started

### Q: What's changed in Phase 2-4?
**A:** Six major enhancements: automatic retry logic, health checks, structured logging, diagnostics, flaky detection, and performance optimization. See PHASE2-4_TRAINING_GUIDE.md for details.

### Q: Do I need to change how I run tests?
**A:** No. Use `/qa-run <STORY-KEY>` exactly as before. All enhancements are automatic.

### Q: How long will this take to learn?
**A:** 2-3 hours for comprehensive training. Most features work automatically.

### Q: Can I try it on just one project first?
**A:** Yes. Run `/qa-setup` in a test project, then `/qa-run <STORY-KEY>` to see it in action.

---

## Automatic Retries

### Q: Why is my test retrying?
**A:** It encountered a transient error (temporary network hiccup, slow server, brief timeout). The framework automatically retried it. This is normal.

### Q: How many times will it retry?
**A:** Up to 3 times. If it passes on any retry, it counts as passed.

### Q: Can I disable retries?
**A:** Yes, but not recommended. Set `retry.enabled: false` in `.qa-config.json`.

### Q: What's a transient error?
**A:** A temporary, recoverable error: network timeout, 5xx server error, service briefly unavailable. Permanent errors (wrong password, app crash) don't get retried.

### Q: Will retries make tests slower?
**A:** Slightly (~5 seconds per failed step). But avoiding false failures saves you far more time overall.

### Q: How do I know a test was retried?
**A:** Look for `[Retry 1/3]` in the test logs. It's expected behavior.

---

## Health Checks

### Q: What's a health check?
**A:** Pre-flight validation. Before running tests, it confirms the app, login, database, and services are online.

### Q: When do health checks run?
**A:** Automatically before `/qa-run <STORY-KEY>`.

### Q: What if health checks fail?
**A:** The run stops immediately and tells you which service is down. Contact DevOps. Don't re-run yet.

### Q: How long do health checks take?
**A:** ~30 seconds. Much faster than starting 45-minute test run on broken environment.

### Q: Can I skip health checks?
**A:** Not recommended, but yes: `healthCheck.enabled: false` in config.

### Q: What exactly is being checked?
**A:** App reachability, login endpoint, database connectivity, and key services.

### Q: Will health checks block my test run?
**A:** Only if they find problems. If all systems are up, tests start immediately.

---

## Structured Logging

### Q: Where are the logs?
**A:** In `qa-runs/<STORY-KEY>-<DATE>-<TIME>/logs/` folder after the run.

### Q: How do I read the logs?
**A:** Open the `.log` file. It's organized by test, then by step. Look for ✓ (success), ✗ (failure), ⚠ (warning).

### Q: What information is in a log?
**A:** Test name, step-by-step actions, results, timing, errors, and performance warnings.

### Q: Are passwords logged?
**A:** No. Credentials are masked as `[masked]` in all logs.

### Q: Can I share logs with developers?
**A:** Yes. Logs are in the run folder. Share the entire `logs/` directory if needed.

### Q: How do I find a specific failure in the logs?
**A:** Search for `✗` symbols or `FAILED` in the log file.

### Q: Do logs stay available?
**A:** Yes, indefinitely in the run folder (until you delete it).

---

## Diagnostics

### Q: When should I run diagnostics?
**A:** When a test run fails mysteriously, hangs, or is extremely slow.

### Q: How do I run diagnostics?
**A:** Type `/qa-diagnostics` in Claude Code chat.

### Q: How long does diagnostics take?
**A:** ~2 minutes to gather and analyze.

### Q: What does diagnostics check?
**A:** System performance (CPU, memory), network status, app health, browser state, and common issues.

### Q: Can I export diagnostics results?
**A:** Yes. It's saved as `diagnostics.json` in the run folder.

### Q: What should I do if diagnostics shows problems?
**A:** It provides recommendations. Examples: clear browser cache, restart app, contact IT about network.

### Q: Is diagnostics the same as health checks?
**A:** No. Health checks are quick (~30s) and run automatically. Diagnostics is deep (~2m) and manual.

---

## Metrics & Observability

### Q: Are metrics automatic?
**A:** Yes. Every run auto-captures metrics (pass rate, execution time, errors, etc.).

### Q: Where are metrics stored?
**A:** In `metrics.json` in the run folder. Dashboard (if available) shows trends.

### Q: What metrics are captured?
**A:** Test pass rate, execution time, failures, performance, and trends over time.

### Q: Can I see trends?
**A:** Yes, via the dashboard (if your team has one set up). Ask your QA Lead.

### Q: How do I disable metrics?
**A:** Not recommended, but: `metrics.enabled: false` in config.

### Q: Are metrics secure?
**A:** Metrics don't include credentials (they're auto-masked). Safe to share.

---

## Flaky Tests

### Q: What's a flaky test?
**A:** A test that passes sometimes and fails other times unpredictably (e.g., passes 6 out of 10 times).

### Q: How is flakiness detected?
**A:** Framework tracks pass/fail across multiple runs. Tests passing <90% are flagged.

### Q: How do I see flaky tests?
**A:** Look for `stability-report.json` in the run folder after multiple runs.

### Q: What should I do about flaky tests?
**A:** Investigate root cause (network issue? timing bug? environment problem?). Don't ignore them.

### Q: Will a flaky test block my test run?
**A:** No. Flaky tests still run and count toward coverage. But they're flagged so you know not to trust them alone.

### Q: How do I fix flakiness?
**A:** Depends on cause. Network issue? Contact IT. Timing bug? Ask developers. Test bug? Fix the test.

### Q: Can a test be stable one day and flaky the next?
**A:** Usually no. But if your environment is unstable (network issues, server under load), tests might be inconsistent.

---

## Performance Optimization

### Q: What's the speed improvement?
**A:** Typically 20-30% faster. Example: 50 tests in 45 minutes becomes ~32 minutes.

### Q: How is optimization achieved?
**A:** Parallel execution (4+ tests at once), session caching, smart prioritization.

### Q: Is optimization on by default?
**A:** Check `.qa-config.json`. It's enabled if `performance.enabled: true`.

### Q: Can I make it faster?
**A:** Yes. Increase `parallelization` (4 → 6 or 8). More parallel = faster, but more CPU/memory usage.

### Q: Will faster tests reduce quality?
**A:** No. Tests run the same; they just run in parallel. Quality unaffected.

### Q: What if my system gets overloaded?
**A:** Reduce `parallelization` to 2-3. Slower tests, lighter system load.

### Q: Can I disable optimization?
**A:** Yes: `performance.enabled: false` in config (not recommended).

---

## Configuration

### Q: Where is the config file?
**A:** `.qa-config.json` in your project root.

### Q: Should I commit the config to Git?
**A:** Yes. It contains only environment variable names, not actual values.

### Q: Where do actual credentials go?
**A:** In `.qa-secrets` (git-ignored). Never committed.

### Q: How do I update configuration?
**A:** Edit `.qa-config.json`, save, commit. Changes take effect on next run.

### Q: Can I have different configs per environment?
**A:** Yes. Create `.qa-config.staging.json`, `.qa-config.production.json`, etc.

### Q: What if my config has a syntax error?
**A:** VS Code will highlight it. Fix the JSON (check commas, quotes, braces).

---

## Error Messages

### Q: How do I understand error messages?
**A:** New error format includes: what failed, why, when, and suggestions to fix it.

### Q: What's an "AC violation"?
**A:** Test found something breaking an acceptance criterion. Example: login took 2.3s but AC says <1s.

### Q: What does "inconclusive" mean?
**A:** Test ran but result is unclear (e.g., timeout before completion). Requires investigation.

### Q: How do I report an error to developers?
**A:** Share the `bug-report.html` from the run folder. It includes screenshots and step-by-step reproduction.

---

## Bugs & Reporting

### Q: When are bugs filed to Jira?
**A:** After Gate #2 (approval gate). Framework drafts bugs in Phase A; you approve in Gate #2; approved ones auto-file to Jira.

### Q: Why not file bugs immediately?
**A:** To prevent false defects. Every drafted bug is re-measured against the live app before you're asked to approve.

### Q: Can I modify bugs before filing?
**A:** At Gate #2, you approve or reject each bug. You can decline ones that seem wrong.

### Q: Are screenshots included?
**A:** Yes. Embedded in `bug-report.html`. You can share this with developers.

### Q: What info is in a filed bug?
**A:** Story link, acceptance criterion, test case, evidence, screenshots, console errors, expected vs. actual result.

---

## Environment Issues

### Q: Can I test against production?
**A:** The framework warns you before running against a production URL. You must explicitly allow it.

### Q: Can I test multiple environments?
**A:** Yes. Create separate config files (`.qa-config.staging.json`, `.qa-config.production.json`).

### Q: What if credentials don't work?
**A:** Verify manually (log in to app directly). If they work manually but not in tests, check `.qa-secrets` for typos.

### Q: What if the app is down?
**A:** Health checks will catch it immediately. Fix the app or infrastructure and re-run.

### Q: What if the network is slow?
**A:** Run `/qa-diagnostics` to measure latency. Contact IT if it's your network. App might just be slow.

---

## Troubleshooting

### Q: A test timed out. What do I do?
**A:** Run `/qa-diagnostics` to check app health. If app is slow, wait or contact DevOps.

### Q: Health checks failed. What do I do?
**A:** Note which service failed. Contact the team responsible. Don't re-run yet.

### Q: A test fails every time. Is it flaky?
**A:** No. Flaky means inconsistent. Consistent failure = real product bug or environment issue.

### Q: Tests are running really slow. Why?
**A:** Check `parallelization` setting. System overloaded? High CPU/memory? Run `/qa-diagnostics`.

### Q: I see console errors in logs. Should I worry?
**A:** Not necessarily. JavaScript warnings don't fail tests unless the test specifically checks for them.

### Q: The run hangs and won't finish.
**A:** Let it sit 5+ minutes (might just be slow). Run `/qa-diagnostics` in another window. If still hung, cancel (**Ctrl+C**) and investigate.

---

## Support

### Q: Where can I get help?
**A:** 
1. **Quick answers:** This FAQ
2. **Deep training:** PHASE2-4_TRAINING_GUIDE.md
3. **Quick lookup:** QUICK_REFERENCE.md
4. **Your QA Lead:** For team-specific questions
5. **QC Lead:** For framework issues

### Q: What if my question isn't answered?
**A:** Ask your QA Lead. If they don't know, contact Usama Arshad Jadoon (QC Lead, AZM Digital).

### Q: Can I suggest improvements?
**A:** Yes! Contact your QA Lead with feedback.

---

**Last Updated:** October 30, 2026  
**Questions not answered? Ask your QA Lead.**
