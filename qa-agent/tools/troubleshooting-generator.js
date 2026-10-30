#!/usr/bin/env node
/**
 * troubleshooting-generator.js — QA AZM Digital Agent
 *
 * Generate troubleshooting guides based on actual errors in a run.
 * Analyzes patterns and suggests fixes with links to documentation.
 * Outputs: troubleshooting-guide.md with actionable recommendations.
 *
 * Usage:
 *   const generator = new TroubleshootingGenerator(runFolder);
 *   await generator.generate();
 *   // Creates: runFolder/troubleshooting-guide.md
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const LogAnalyzer = require("./log-analyzer.js");

class TroubleshootingGenerator {
  constructor(runFolder) {
    this.runFolder = runFolder;
    this.outputPath = path.join(runFolder, "troubleshooting-guide.md");
  }

  async generate() {
    const logFiles = this.findLogFiles();
    if (!logFiles.length) {
      return this.writeGuide("# Troubleshooting Guide\n\nNo log files found in run folder.");
    }

    const analyzer = new LogAnalyzer(logFiles[0]);
    const summary = analyzer.getSummary();

    const guide = this.buildGuide(summary, analyzer);
    return this.writeGuide(guide);
  }

  findLogFiles() {
    const logsDir = path.join(this.runFolder, "..", "..", "logs");
    if (!fs.existsSync(logsDir)) return [];

    return fs.readdirSync(logsDir)
      .filter(f => f.endsWith(".log"))
      .map(f => path.join(logsDir, f))
      .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime)
      .slice(0, 1);
  }

  buildGuide(summary, analyzer) {
    let guide = `# Troubleshooting Guide

**Generated:** ${new Date().toISOString()}

---

## Executive Summary

- **Total Events:** ${summary.totalEvents}
- **Errors:** ${summary.errorCount}
- **Warnings:** ${summary.warningCount}
- **Retries:** ${summary.retryCount}
- **Most Active Agent:** ${summary.topAgent || "unknown"}

---

## Error Patterns

`;

    for (const [category, data] of Object.entries(summary.errorPatterns)) {
      guide += `\n### ${category} (${data.count} occurrence${data.count !== 1 ? "s" : ""})\n\n`;
      guide += this.getErrorGuidance(category);
      guide += "\n**Examples:**\n";
      for (const example of data.examples) {
        guide += `- \`${example.message}\` (${example.logger})\n`;
      }
      guide += "\n";
    }

    if (summary.retryCount > 0) {
      guide += `## Retry Analysis\n\n${summary.retryCount} retry attempts detected.\n\n`;
      guide += this.getRetryGuidance(summary.retryCount);
    }

    if (summary.errorCount === 0 && summary.warningCount === 0) {
      guide += "\n## ✓ No Issues Detected\n\nRun completed successfully with no errors or warnings!\n";
    } else {
      guide += `\n## Recommended Actions\n\n${this.getRecommendedActions(summary)}\n`;
    }

    return guide;
  }

  getErrorGuidance(category) {
    const guidance = {
      TIMEOUT: `**Timeout detected.** Request took longer than expected to complete.
- **Common causes:** Slow network, server overload, long-running test
- **Solutions:**
  1. Check network connectivity and latency
  2. Try running the test again (transient issue)
  3. Increase timeout in config if appropriate
  4. Check server status on your app`,

      CONNECTION_ERROR: `**Connection error.** Cannot reach the service or Jira/AIO API.
- **Common causes:** Network down, firewall blocking, wrong URL
- **Solutions:**
  1. Verify network connectivity: \`ping 8.8.8.8\`
  2. Check URL in .qa-config.json
  3. Verify firewall allows outbound connections
  4. Check if service is running`,

      AUTH_ERROR: `**Authentication failed (HTTP 401).** Credentials are invalid or expired.
- **Common causes:** Wrong password, expired token, invalid credentials
- **Solutions:**
  1. Verify credentials in .qa-secrets or environment variables
  2. Check if token/password has expired
  3. Request fresh credentials from admin
  4. Run \`/qa-health\` to verify auth status`,

      PERMISSION_ERROR: `**Permission denied (HTTP 403).** Account lacks required permissions.
- **Common causes:** User role too low, insufficient project access
- **Solutions:**
  1. Contact admin to grant required permissions
  2. Verify account has access to project/board
  3. Check user has "run tests" permission
  4. Verify Jira/AIO API token scope`,

      NOT_FOUND: `**Resource not found (HTTP 404).** The requested resource doesn't exist.
- **Common causes:** Wrong issue key, missing folder, deleted resource
- **Solutions:**
  1. Verify story key is correct (\`PROJ-123\`)
  2. Confirm the Jira issue exists
  3. For AIO: confirm folder exists in Cases module
  4. Check resource hasn't been deleted`,

      RATE_LIMIT: `**Rate limit hit (HTTP 429).** Too many API requests in short time.
- **Common causes:** Many parallel requests, aggressive retry logic
- **Solutions:**
  1. Wait and retry (framework should handle automatically)
  2. Reduce parallel execution threads if applicable
  3. Space out API calls in your tests
  4. Contact admin if limits are too strict`,

      SERVER_ERROR: `**Server error (HTTP 500+).** The service had an internal error.
- **Common causes:** Service bug, database issue, temporary outage
- **Solutions:**
  1. Wait a few minutes and retry
  2. Check service status page
  3. Contact support if error persists
  4. Review server logs for details`,

      MEMORY_ERROR: `**Out of memory.** Process ran out of available memory.
- **Common causes:** Large dataset, memory leak, insufficient system RAM
- **Solutions:**
  1. Check available memory: \`free -h\` (Mac: \`vm_stat\`)
  2. Close other applications
  3. Increase system RAM if possible
  4. Reduce batch size in tests`,

      CRASH: `**Process crashed.** Browser or agent process crashed unexpectedly.
- **Common causes:** Resource exhaustion, browser bug, infinite loop
- **Solutions:**
  1. Check system resources (memory, disk)
  2. Run \`/qa-health\` to verify environment
  3. Try again (may be transient)
  4. Contact support with logs`,

      JSON_ERROR: `**JSON parsing error.** JSON file is malformed or corrupted.
- **Common causes:** Incomplete write, corruption, invalid characters
- **Solutions:**
  1. Check .qa-config.json is valid JSON
  2. Run \`validate-config.js\` to verify
  3. Look for non-ASCII characters
  4. Check line endings (should be LF)`,

      VALIDATION_ERROR: `**Validation error.** Input data is invalid or malformed.
- **Common causes:** Bad config, wrong data format, missing required field
- **Solutions:**
  1. Run \`/qa-health\` to check configuration
  2. Review .qa-config.json for errors
  3. Check test data format
  4. Validate against schema`,

      OTHER: `**Unclassified error.** Unable to automatically categorize this error.
- **Next steps:**
  1. Review error message for clues
  2. Check logs for context
  3. Run \`/qa-diagnostics\` to collect system info
  4. Contact support with logs and diagnostics`,
    };

    return guidance[category] || "Unknown error category.";
  }

  getRetryGuidance(retryCount) {
    if (retryCount === 0) return "";
    if (retryCount < 3) {
      return "Few retries detected. This is normal for occasional transient issues.";
    } else if (retryCount < 10) {
      return "Moderate retries detected. Some instability in the environment or service.";
    } else {
      return `Many retries (${retryCount}+) detected. Significant instability.\n\n**Recommendations:**\n- Check network stability\n- Verify service health\n- Consider infrastructure upgrades\n- Review retry logs for patterns`;
    }
  }

  getRecommendedActions(summary) {
    const actions = [];

    if (summary.errorPatterns.TIMEOUT) {
      actions.push("1. **Network/Performance:** Increase timeout or check server performance");
    }
    if (summary.errorPatterns.CONNECTION_ERROR) {
      actions.push("2. **Connectivity:** Verify network access to Jira, AIO, and app");
    }
    if (summary.errorPatterns.AUTH_ERROR) {
      actions.push("3. **Authentication:** Update credentials in .qa-secrets");
    }
    if (summary.errorPatterns.PERMISSION_ERROR) {
      actions.push("4. **Permissions:** Request admin access for required projects");
    }
    if (summary.errorPatterns.CRASH || summary.errorPatterns.MEMORY_ERROR) {
      actions.push("5. **Resources:** Free up system memory/disk or add hardware");
    }

    if (actions.length === 0) {
      return "No specific recommendations. Run again to gather more data.";
    }

    return actions.join("\n");
  }

  writeGuide(content) {
    fs.writeFileSync(this.outputPath, content, "utf8");
    return this.outputPath;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = TroubleshootingGenerator;
}
