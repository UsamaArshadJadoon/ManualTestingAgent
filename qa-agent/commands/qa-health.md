---
name: qa-health
description: Check system health before running QA tests — verify Node, Playwright, Jira, AIO, disk space, memory, config, credentials are ready. Reports pass/fail with recommendations.
tools:
  - Read
  - Bash
---

You are the `/qa-health` command. Run a complete health check and report readiness.

## Job

1. Import health-checker.js
2. Run performHealthCheck()
3. Report results to user (human-readable)
4. Output JSON for tools to parse
5. Exit 0 if ready, 1 if issues found

## Implementation

```javascript
const { performHealthCheck, generateReport, generateJsonReport } = require(
  path.join(__dirname, '../tools/health-checker.js')
);

async function runHealthCheck() {
  try {
    const result = await performHealthCheck();
    
    // Human report
    console.log(generateReport(result));
    
    // JSON output
    console.log('\n--- JSON Report (for tools) ---');
    console.log(JSON.stringify(generateJsonReport(result), null, 2));
    
    // Exit code
    process.exit(result.overall === 'PASS' ? 0 : 1);
  } catch (e) {
    console.error(`Health check failed: ${e.message}`);
    process.exit(1);
  }
}

runHealthCheck();
```

## Checks Performed

| Check | Purpose | Pass Condition |
|-------|---------|----------------|
| **Node.js** | Minimum version 14.0.0 | Major version >= 14 |
| **Playwright** | Browser executable installed | Browser cache found |
| **Disk Space** | Minimum 500MB free | Free space >= 500MB |
| **Memory** | Minimum 2GB available | Free RAM >= 2GB |
| **Config** | `.qa-config.json` valid | File exists, has jira + app |
| **Credentials** | Auth configured | Env vars or .qa-secrets |
| **Jira** | API connectivity | (Checked at runtime) |
| **AIO** | API connectivity | (Checked at runtime) |

## Output Format

### Human-Readable
```
╔════════════════════════════════════════════╗
║  QA Framework Health Check  [PASS]         ║
╚════════════════════════════════════════════╝

Results:
  ✓ Node.js Version                PASS
  ✓ Playwright Browser             PASS
  ✓ Disk Space                     PASS
  ✓ Available Memory               PASS
  ✓ Config File                    PASS
  ✓ Credentials                    PASS

Check completed in 245ms

✓ All checks passed! Framework is ready.
```

### JSON Output (for tools)
```json
{
  "timestamp": "2026-10-30T15:30:00.000Z",
  "status": "PASS",
  "elapsed": 245,
  "checks": {
    "nodejs": { "passed": true, "current": "18.0.0", "minimum": "14.0.0" },
    "playwright": { "passed": true, "detail": "✓ Chromium installed" },
    ...
  },
  "recommendations": []
}
```

## Exit Codes

- **0** = All checks passed, ready to run
- **1** = One or more checks failed, fix issues first

## Usage

```
/qa-health
```

## Recommendations

The command provides auto-fix suggestions for common issues:
- Missing Playwright: `npx playwright install`
- Missing config: `/qa-setup`
- Missing credentials: `export QA_USER=... QA_PASS=...`

---

*Part of the QA AZM Digital Agent — Developed by Usama Arshad Jadoon · QC Lead · AZM Digital*
