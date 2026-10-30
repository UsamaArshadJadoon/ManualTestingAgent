# Escalation Procedures

**QA AZM Digital Agent — When & How to Escalate Issues**

---

## Decision Tree

`
Is your issue...
│
├─ A Question? → Try [FAQ.md](FAQ.md)
├─ A Bug? → Check [TROUBLESHOOTING_FOR_OPS.md](TROUBLESHOOTING_FOR_OPS.md)
├─ System Down? → Follow [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)
└─ Still Unresolved? → Escalate
`

---

## Escalation Levels

### Level 1: Self-Help (15 min)

**Resources:**
- [FAQ.md](FAQ.md)
- [QUICK_START.md](QUICK_START.md)
- Search documentation

**Action:** Review and attempt to resolve

### Level 2: Team Discussion (30 min)

**Resources:**
- #qa-automation Slack channel
- QA team wiki
- Peer assistance

**Action:** Post question, get team input

### Level 3: QC Lead (1 hour)

**Contact:** Usama Arshad Jadoon  
**Email:** usama@azm.dev  
**Slack:** @usama.jadoon  
**When:**
- Issue unresolved after 30 min
- Potential system problem
- Production impact

**Include:**
- Problem description
- Steps to reproduce
- Error messages
- Screenshots/logs

### Level 4: DevOps (1-2 hours)

**Contact:** DevOps Manager  
**When:**
- Infrastructure problem
- Server down
- Network issue
- Database problem

**Include:**
- System metrics
- Error logs
- Network diagnostics

### Level 5: Engineering Manager (2-4 hours)

**Contact:** VP Engineering  
**When:**
- Critical incident
- Multiple systems affected
- Customer impact
- Requires management decision

---

## Escalation Template

**Email Subject:** [URGENT] QA System Issue - Story PROJ-123

**Body:**
\\\
ISSUE: [Brief description]
SEVERITY: [Critical/High/Medium/Low]
AFFECTED: [Who/what is affected]
IMPACT: [Business impact]

TIMELINE:
- Detected: [Time]
- Diagnostics started: [Time]

DIAGNOSTICS:
- Verification status: [Passed/Failed]
- Error message: [Include verbatim]
- Logs: [Attach or link]

ATTEMPTED SOLUTIONS:
- [Solution 1 and result]
- [Solution 2 and result]

CURRENT STATUS:
- [What is currently happening]

NEEDED:
- [What you need to resolve]
\\\

---

## Response Time SLAs

| Level | Category | Response | Resolution |
|-------|----------|----------|-----------|
| L1 | Self-Help | N/A | Self |
| L2 | Team | 15 min | 2 hours |
| L3 | QC Lead | 30 min | 4 hours |
| L4 | DevOps | 1 hour | 8 hours |
| L5 | Management | 2 hours | 24 hours |

---

## Preventing Escalations

### Best Practices

1. **Read documentation first** → Saves 80% of escalations
2. **Search Slack history** → Common issues answered there
3. **Check recent incidents** → Similar issues likely
4. **Verify configuration** → Most issues are config-related
5. **Collect logs early** → Speeds resolution

### Self-Help Checklist

Before escalating, verify:
- [ ] I've read the relevant documentation
- [ ] I've checked FAQ.md
- [ ] I've reviewed recent Slack history
- [ ] I've run health checks
- [ ] I've collected logs and error messages
- [ ] I've attempted restart
- [ ] I've tried on different network/device

---

## Support Hours

| Support Level | Hours | Days |
|---------------|-------|------|
| Self-Help | 24/7 | All |
| Team (Slack) | 9 AM - 5 PM | Mon-Fri |
| QC Lead | 8 AM - 6 PM | Mon-Fri |
| On-Call | 24/7 | All (critical only) |

---

## Communication Channels

### Slack
- Channel: #qa-automation
- For general questions and updates

### Email
- usama@azm.dev (QC Lead)
- ops@azm.dev (DevOps)

### GitHub Issues
- For bugs and feature requests
- repo: ManualTestingAgent

### Status Page
- Check: status.azm.dev
- System outages announced here

---

**Last Updated:** 2026-10-30  
**QC Lead:** Usama Arshad Jadoon  
**Company:** AZM Digital