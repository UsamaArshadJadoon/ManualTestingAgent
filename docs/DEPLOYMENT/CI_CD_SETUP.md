# CI/CD Setup Guide

**QA AZM Digital Agent — Automated Pipeline Configuration**

---

## Overview

Integrate automated QA tests into your CI/CD pipeline for continuous quality validation.

---

## Supported Platforms

- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
- CircleCI (planned)

---

## GitHub Actions

### Setup

1. Create .github/workflows/qa-tests.yml

2. Configure with:
   - Node.js setup
   - Dependency installation
   - Playwright browser installation
   - QA test execution

3. Add repository secrets:
   - JIRA_USER
   - JIRA_TOKEN
   - APP_URL

### Running Tests

Tests automatically run on:
- Every pull request
- Every push to main
- Scheduled daily at 2 AM

---

## GitLab CI

### Setup

1. Create .gitlab-ci.yml

2. Configure stages:
   - Install dependencies
   - Run QA tests
   - Archive results

3. Set CI/CD variables:
   - JIRA_USER
   - JIRA_TOKEN
   - APP_URL

---

## Jenkins

### Setup

1. Create Jenkinsfile

2. Configure pipeline stages:
   - Install
   - Run QA
   - Archive Results
   - Publish reports

3. Setup credentials in Jenkins

---

## Azure DevOps

### Setup

1. Create azure-pipelines.yml

2. Configure pool and steps
3. Setup service connections for artifacts
4. Configure test result publishing

---

## CI/CD Mode

Run tests without user interaction:

bash
/qa-run PROJ-123 --ci-mode


Features in CI mode:
- Auto-approve test plans
- Headless browser mode
- JSON output for parsing
- Automatic bug filing

---

## Environment Variables

JIRA_URL=https://your-jira.atlassian.net  
JIRA_USER=your-user  
JIRA_TOKEN=your-api-token  
APP_URL=https://staging.example.com  
CI=true

---

## Report Integration

### Slack Notification

Notify your team of test results in Slack

### GitHub PR Comment

Automatically comment on pull requests with test results

---

## Advanced Scenarios

### Matrix Testing

Run tests across multiple browsers:
- Chrome
- Firefox
- Safari

### Scheduled Runs

Run tests on a daily schedule (e.g., 2 AM)

### Conditional Execution

Only run tests on specific conditions:
- PR with specific labels
- Certain files changed
- Manual trigger

---

## Best Practices

1. Run tests on every PR — Catch issues early
2. Keep configs in repo — Version control
3. Use secrets for credentials — Never commit tokens
4. Archive reports — Keep history
5. Set proper timeouts — Prevent hanging jobs
6. Notify on failures — Alert team quickly

---

**Last Updated:** 2026-10-30