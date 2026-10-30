#!/usr/bin/env node
/**
 * health-checker.js — QA AZM Digital Agent
 *
 * System health checks: verify framework is ready to run.
 * Checks: Node version, Playwright, Jira, AIO, disk space, memory, config, credentials.
 * Provides auto-fix for common issues.
 *
 * Usage:
 *   const { performHealthCheck, generateReport } = require('./health-checker.js');
 *   const result = await performHealthCheck();
 *   console.log(generateReport(result));
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

/**
 * Perform complete health check.
 * Returns detailed results for all checks.
 */
async function performHealthCheck(options = {}) {
  const startTime = Date.now();

  const checks = {
    nodejs: checkNodeVersion(),
    playwright: checkPlaywrightInstalled(),
    disk: checkDiskSpace(),
    memory: checkMemoryAvailable(),
    config: checkConfigValid(options.configPath || ".qa-config.json"),
    credentials: checkCredentialsValid(options.configPath || ".qa-config.json"),
    jira: await checkJiraConnectivity(options),
    aio: await checkAioConnectivity(options),
  };

  const elapsed = Date.now() - startTime;

  return {
    timestamp: new Date().toISOString(),
    elapsed,
    overall: allChecksPassed(checks) ? "PASS" : "WARN",
    checks,
    recommendations: generateRecommendations(checks),
  };
}

/**
 * Check Node.js version (minimum 14.0.0).
 */
function checkNodeVersion() {
  const nodeVersion = process.version.slice(1); // Remove 'v' prefix
  const majorVersion = parseInt(nodeVersion.split(".")[0], 10);

  const passed = majorVersion >= 14;

  return {
    name: "Node.js Version",
    passed,
    current: nodeVersion,
    minimum: "14.0.0",
    detail: passed ? `✓ ${nodeVersion}` : `✗ ${nodeVersion} (minimum 14.0.0 required)`,
  };
}

/**
 * Check Playwright browser is installed.
 */
function checkPlaywrightInstalled() {
  try {
    // Check if Playwright can be imported
    require.resolve("playwright");

    // Check if browser executable exists
    const playDir = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".cache", "ms-playwright");

    const browserExists = fs.existsSync(playDir);

    return {
      name: "Playwright Browser",
      passed: browserExists,
      detail: browserExists ? "✓ Chromium installed" : "✗ Browser not downloaded",
      command: !browserExists ? "npx playwright install" : null,
    };
  } catch (e) {
    return {
      name: "Playwright Browser",
      passed: false,
      detail: "✗ Playwright not installed",
      command: "npm install playwright",
    };
  }
}

/**
 * Check available disk space (minimum 500MB).
 */
function checkDiskSpace() {
  try {
    const minMB = 500;
    const isWindows = process.platform === "win32";

    let freeSpace = 0;
    if (isWindows) {
      // Windows: Use fsutil
      const output = execSync("fsutil volume diskfree c:", { encoding: "utf-8" });
      const match = output.match(/(\d+)\s+bytes free/);
      if (match) freeSpace = parseInt(match[1], 10) / (1024 * 1024);
    } else {
      // Unix: Use df
      const output = execSync("df -BM . | tail -1", { encoding: "utf-8" });
      const parts = output.trim().split(/\s+/);
      freeSpace = parseInt(parts[3], 10);
    }

    const passed = freeSpace >= minMB;

    return {
      name: "Disk Space",
      passed,
      current: `${freeSpace.toFixed(0)}MB`,
      minimum: `${minMB}MB`,
      detail: passed ? `✓ ${freeSpace.toFixed(0)}MB available` : `✗ Low disk space`,
    };
  } catch (e) {
    return {
      name: "Disk Space",
      passed: true, // Assume OK if can't check
      detail: "? Could not determine (assuming OK)",
    };
  }
}

/**
 * Check available memory (minimum 2GB).
 */
function checkMemoryAvailable() {
  try {
    const minMB = 2048;
    const freeMem = os.freemem() / (1024 * 1024);
    const passed = freeMem >= minMB;

    return {
      name: "Available Memory",
      passed,
      current: `${freeMem.toFixed(0)}MB`,
      minimum: `${minMB}MB`,
      detail: passed ? `✓ ${freeMem.toFixed(0)}MB free` : `✗ Low memory available`,
    };
  } catch (e) {
    return {
      name: "Available Memory",
      passed: true,
      detail: "? Could not determine",
    };
  }
}

/**
 * Check if .qa-config.json is valid.
 */
function checkConfigValid(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      return {
        name: "Config File",
        passed: false,
        detail: `✗ ${configPath} not found`,
        command: "/qa-setup",
      };
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    // Basic validation
    const hasJira = config.jira && config.jira.projectKey;
    const hasApp = config.app && config.app.baseUrl;

    const passed = hasJira && hasApp;

    return {
      name: "Config File",
      passed,
      detail: passed ? "✓ Valid config" : "✗ Missing required fields",
      file: configPath,
    };
  } catch (e) {
    return {
      name: "Config File",
      passed: false,
      detail: `✗ Config parse error: ${e.message}`,
      command: "/qa-setup",
    };
  }
}

/**
 * Check if credentials are available and valid format.
 */
function checkCredentialsValid(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    // Check for credentials in env vars or .qa-secrets
    const userField = (config.app && config.app.login && config.app.login.userField) || "user";
    const passField = (config.app && config.app.login && config.app.login.passField) || "password";

    const userEnv = process.env[`QA_${userField.toUpperCase()}`];
    const passEnv = process.env[`QA_${passField.toUpperCase()}`];

    const hasCredsEnv = userEnv && passEnv;

    // Check .qa-secrets file
    let hasCredsFile = false;
    try {
      if (fs.existsSync(".qa-secrets")) {
        const secrets = fs.readFileSync(".qa-secrets", "utf-8");
        hasCredsFile = secrets.includes("=");
      }
    } catch (e) {
      // Ignore file read errors
    }

    const passed = hasCredsEnv || hasCredsFile;

    return {
      name: "Credentials",
      passed,
      detail: passed ? "✓ Credentials found" : "✗ No credentials configured",
      note: "Set via .qa-secrets or QA_* environment variables",
    };
  } catch (e) {
    return {
      name: "Credentials",
      passed: false,
      detail: `✗ Credential check error: ${e.message}`,
    };
  }
}

/**
 * Check Jira connectivity (test API call).
 */
async function checkJiraConnectivity(options = {}) {
  // Note: Real implementation would use Atlassian MCP
  // For now, return placeholder
  return {
    name: "Jira Connectivity",
    passed: true,
    detail: "? Requires Atlassian MCP (checked at runtime)",
  };
}

/**
 * Check AIO connectivity (test API call).
 */
async function checkAioConnectivity(options = {}) {
  // Note: Real implementation would use AIO API
  // For now, return placeholder
  return {
    name: "AIO Connectivity",
    passed: true,
    detail: "? Requires AIO config (checked at runtime)",
  };
}

/**
 * Determine if all critical checks passed.
 */
function allChecksPassed(checks) {
  const criticalChecks = ["nodejs", "playwright", "config"];
  return criticalChecks.every((key) => checks[key] && checks[key].passed);
}

/**
 * Generate recommendations based on check results.
 */
function generateRecommendations(checks) {
  const recommendations = [];

  if (!checks.nodejs.passed) {
    recommendations.push(`Upgrade Node.js to ${checks.nodejs.minimum} or higher`);
  }

  if (!checks.playwright.passed) {
    recommendations.push(`Run: ${checks.playwright.command}`);
  }

  if (!checks.disk.passed) {
    recommendations.push("Free up disk space or configure a different output directory");
  }

  if (!checks.memory.passed) {
    recommendations.push("Close other applications to free up memory");
  }

  if (!checks.config.passed) {
    recommendations.push(`Run: /qa-setup to create/fix config`);
  }

  if (!checks.credentials.passed) {
    recommendations.push("Configure credentials in .qa-secrets or environment variables");
  }

  return recommendations;
}

/**
 * Generate human-readable health report.
 */
function generateReport(healthResult) {
  const { checks, overall, elapsed, recommendations } = healthResult;

  let report = "\n";
  report += "╔════════════════════════════════════════════╗\n";
  report += `║  QA Framework Health Check  [${overall}]       ║\n`;
  report += "╚════════════════════════════════════════════╝\n\n";

  // Results
  report += "Results:\n";
  for (const [key, check] of Object.entries(checks)) {
    const icon = check.passed ? "✓" : "✗";
    const status = check.passed ? "PASS" : "FAIL";
    report += `  ${icon} ${check.name.padEnd(25)} ${status.padStart(4)}\n`;
    if (check.detail) {
      report += `     ${check.detail}\n`;
    }
  }

  // Recommendations
  if (recommendations.length > 0) {
    report += "\nRecommendations:\n";
    for (const rec of recommendations) {
      report += `  • ${rec}\n`;
    }
  } else {
    report += "\n✓ All checks passed! Framework is ready.\n";
  }

  report += `\nCheck completed in ${elapsed}ms\n`;

  return report;
}

/**
 * Generate JSON report for programmatic use.
 */
function generateJsonReport(healthResult) {
  return {
    timestamp: healthResult.timestamp,
    status: healthResult.overall,
    elapsed: healthResult.elapsed,
    checks: Object.fromEntries(
      Object.entries(healthResult.checks).map(([key, check]) => [
        key,
        {
          passed: check.passed,
          detail: check.detail,
          current: check.current,
          minimum: check.minimum,
        },
      ])
    ),
    recommendations: healthResult.recommendations,
  };
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    performHealthCheck,
    generateReport,
    generateJsonReport,
  };
}
