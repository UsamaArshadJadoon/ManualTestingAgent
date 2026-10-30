# Team Training Guide

**QA AZM Digital Agent — Onboarding & Training Materials**

> Complete training manual for new team members joining the QA automation program.

---

## Learning Objectives

By the end of this training, you will:
- Understand the automated QA framework architecture
- Run your first test using /qa-run
- Interpret test reports and verdicts
- Handle common issues and troubleshooting
- Integrate tests into your daily workflow
- Escalate issues appropriately

**Estimated Time:** 2-3 hours (spread over 2-3 days)

---

## Day 1: Foundation (1 hour)

### Module 1: Framework Overview (20 minutes)

**What is the QA AZM Digital Agent?**

An automated QA system that:
- Reads your Jira stories
- Generates test cases from acceptance criteria
- Runs tests on your live application
- Captures evidence (screenshots, logs)
- Files bugs automatically
- Provides a GO/NO-GO verdict

**Why automate QA?**
- Faster feedback on quality
- Consistent test execution
- Complete audit trail
- Reduced manual effort
- Early bug detection

### Module 2: Key Concepts (20 minutes)

**Acceptance Criteria (AC):** Requirements from the Jira story  
**Test Cases:** Specific test scenarios (3 per AC: happy, negative, edge)  
**Coverage:** % of ACs with passing tests  
**Verdict:** GO (ready) or NO-GO (needs fixes)  
**Evidence:** Screenshots, console logs, network requests  

### Module 3: Live Demo (20 minutes)

**Watch the instructor run /qa-run PROJ-123**

Key Takeaway: This entire process runs in ~10-15 minutes!

---

## Day 2: Hands-On Practice (1.5 hours)

### Module 4: Installation (20 minutes)

Step-by-step: See [QUICK_START.md](QUICK_START.md)

### Module 5: Your First Test Run (40 minutes)

`ash
/qa-run PROJ-123
`

- Pick a simple story
- Approve test cases
- Let it run
- Review the report

### Module 6: Troubleshooting (10 minutes)

Common issues: See [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md)

---

## Day 3: Integration & Advanced (1.5 hours)

### Module 7: Understanding Reports (30 minutes)

- Summary section
- Coverage analysis
- Findings and bugs
- Verdict interpretation

### Module 8: CI/CD Integration (30 minutes)

See [CI_CD_SETUP.md](../docs/CI_CD_SETUP.md) for GitHub Actions, GitLab CI, Jenkins setup.

### Module 9: Escalation & Support (30 minutes)

See [ESCALATION_PROCEDURES.md](ESCALATION_PROCEDURES.md)

---

## Resources

- Quick Start: [QUICK_START.md](QUICK_START.md)
- Troubleshooting: [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md)
- Operations: [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)
- Questions: [FAQ.md](FAQ.md)

---

**Training Version:** 1.0  
**Company:** AZM Digital  
**QC Lead:** Usama Arshad Jadoon