# Integration Guide

**QA AZM Digital Agent — External System Integration**

---

## Jira Integration

### Configuration

`json
{
  "jira": {
    "url": "https://your-jira.atlassian.net",
    "user": "your-email@company.com",
    "apiToken": "your-api-token",
    "project": "PROJ",
    "bugType": "Bug"
  }
}
`

### Features

- Auto-fetch stories by key
- Auto-file bugs to Jira
- Link test cases to stories
- Track issue resolution

---

## Slack Integration

### Setup

1. Create Slack webhook
2. Add to config:

`json
{
  "slack": {
    "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
`

### Notifications

- Test run started
- Test run completed
- Bugs filed
- Coverage alerts
- System errors

---

## AIO Tests Integration

### Setup

1. Create AIO account
2. Generate API token
3. Configure:

`json
{
  "aio": {
    "enabled": true,
    "apiKey": "your-api-key",
    "projectId": "your-project-id"
  }
}
`

### Features

- Auto-sync approved test cases
- Link tests to Jira stories
- Track test execution history
- Report generation

---

## GitHub Integration

### Setup

1. Add repository webhook
2. Configure branch protection

### CI Integration

See [CI_CD_SETUP.md](CI_CD_SETUP.md)

---

## Email Reports

### Configuration

`json
{
  "email": {
    "enabled": true,
    "provider": "sendgrid",
    "apiKey": "your-api-key",
    "from": "qa@company.com",
    "recipients": ["team@company.com"]
  }
}
`

### Send Report After Run

`ash
/qa-run PROJ-123 --email
`

---

## Custom Webhooks

### Setup

`json
{
  "webhooks": {
    "onRunComplete": "https://your-api.com/webhook",
    "onBugFiled": "https://your-api.com/webhook",
    "onError": "https://your-api.com/webhook"
  }
}
`

### Payload Example

`json
{
  "event": "run_complete",
  "storyKey": "PROJ-123",
  "verdict": "GO",
  "timestamp": "2026-10-30T12:00:00Z",
  "reportUrl": "https://..."
}
`

---

**Last Updated:** 2026-10-30