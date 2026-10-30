# Getting Started — QA AZM Digital Agent

> Get up and running in 5 minutes with your first QA test run.

## What You Need

- ✅ Windows + VS Code + Claude Code extension
- ✅ PowerShell 5.1+
- ✅ Jira account & access to your project
- ✅ A Jira story key (e.g., `PROJ-123`)

## 1. Download & Install (One Time)

Open **Windows PowerShell** and paste this:

```powershell
$zip  = "$HOME\Downloads\qa-azm-agent.zip"
$dest = "$HOME\Downloads\qa-azm-agent"
Invoke-WebRequest "https://github.com/UsamaArshadJadoon/ManualTestingAgent/archive/refs/heads/main.zip" -OutFile $zip
Expand-Archive $zip $dest -Force
$root = (Get-ChildItem $dest -Directory)[0].FullName
powershell -ExecutionPolicy Bypass -File "$root\qa-agent\install.ps1"
```

Or if you prefer Git:

```powershell
git clone https://github.com/UsamaArshadJadoon/ManualTestingAgent.git
powershell -ExecutionPolicy Bypass -File ManualTestingAgent\qa-agent\install.ps1
```

Verify the install:

```powershell
Get-ChildItem $HOME\.claude\agents\qa-*.md | Select-Object Name
```

You should see 8 `qa-*` agents listed.

## 2. Authorize Connectors

1. Open **claude.ai → Settings → Connectors**
2. Authorize **Atlassian (Jira)**
3. Authorize **Playwright**
4. Save and close

## 3. Set Up Your Project

In VS Code, open Claude Code and run:

```
/qa-setup
```

This creates `.qa-config.json` and `.qa-secrets` (git-ignored).

Edit `.qa-config.json` with:
- Your **app URL** to test
- Your **Jira project key** (the prefix in story keys)
- Any browser options you want

For credentials, either:
- Edit `.qa-secrets` with `JIRA_USER` and `JIRA_TOKEN`, OR
- Set environment variables `$env:QA_USER` and `$env:QA_PASS`

> ℹ️ API tokens are safer than passwords. [Get yours from Jira](https://id.atlassian.com/manage-profile/security/api-tokens).

## 4. Run Your First Test

Find a Jira story. Example: `PROJ-123`

In the Claude Code chat prompt, type:

```
/qa-run PROJ-123
```

### What happens next:

1. **Stage 1-3:** The agent reads the story, designs test cases, and proves every requirement is covered.
2. **Gate 1:** Review the test plan. Type `approve` to proceed or reject if needed.
3. **Stage 4:** The agent opens your app in a real browser, runs each test, captures screenshots.
4. **Stage 5:** Any failures are drafted as bugs with evidence.
5. **Re-verify:** Bugs are re-tested against the live app to confirm they still reproduce.
6. **Gate 2:** Review bugs found. Type `approve` to file them to Jira or skip any you want.
7. **Stage 6-7:** Final report is generated with verdict: **GO** or **NO-GO**.

## 5. View Your Report

When complete, open:

```
qa-agent/runs/PROJ-123/report.html
```

You'll see:
- Test execution summary
- Coverage matrix (acceptance criteria ↔ test cases)
- Screenshots and evidence for every test
- All bugs filed to Jira
- Final verdict

---

## Common Next Steps

- **Learn the full pipeline?** → [COMPLETE_GUIDE.md](COMPLETE_GUIDE.md)
- **Set up automation?** → [docs/DEPLOYMENT/CI_CD_SETUP.md](DEPLOYMENT/CI_CD_SETUP.md)
- **Troubleshoot an issue?** → [docs/OPERATIONS/TROUBLESHOOTING_FOR_OPS.md](OPERATIONS/TROUBLESHOOTING_FOR_OPS.md)
- **Team onboarding?** → [docs/TEAM/TEAM_TRAINING_GUIDE.md](TEAM/TEAM_TRAINING_GUIDE.md)
- **Questions?** → [FAQ.md](FAQ.md)

---

## ⚠️ Important Notes

| Thing | Do This |
|-------|---------|
| Where to type `/qa-run` | **Claude Code chat prompt in VS Code** (not PowerShell) |
| Where to type `powershell` commands | **Windows PowerShell terminal** (not Claude Code) |
| Storing credentials | **`.qa-secrets` (git-ignored)** or **environment variables** — never commit them |
| Testing production? | Agent will **stop and ask** — you must explicitly allow it |
| Bugs aren't filing? | Check **Gate 2** — you must approve each one individually |

---

## Troubleshooting Quick Fixes

### "qa-run command not found"

- Are you typing in **Claude Code chat prompt** (press **Ctrl+Esc** to focus)?
- Is VS Code reloaded? Try **Ctrl+Shift+P → Reload Window**

### "Jira connection failed"

- Run `/qa-setup` again to re-enter credentials
- Verify your API token [here](https://id.atlassian.com/manage-profile/security/api-tokens)
- Check your internet connection

### "Browser won't open"

- Install Playwright browsers:
  ```powershell
  npx playwright install
  ```

### "Tests timing out"

- Edit `.qa-config.json` and increase `timeout`:
  ```json
  {
    "execution": {
      "timeout": 60000
    }
  }
  ```

---

**Ready?** Run `/qa-run <YOUR-STORY-KEY>` now, or read [COMPLETE_GUIDE.md](COMPLETE_GUIDE.md) first.

---

**Developed by:** Usama Arshad Jadoon · QC Lead · AZM Digital  
**Last updated:** October 2026
