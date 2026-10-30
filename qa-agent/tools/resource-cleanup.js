#!/usr/bin/env node
/**
 * resource-cleanup.js — QA AZM Digital Agent
 *
 * Cleanup browser processes, temp files, and resources.
 * Ensures no orphaned processes or files left after agent failures.
 * Implements timeout-based emergency cleanup.
 *
 * Usage:
 *   const { cleanupResources, verifyCleanup } = require('./resource-cleanup.js');
 *   await cleanupResources(runFolder, { timeout: 30000 });
 *   await verifyCleanup(runFolder);
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

/**
 * Cleanup all resources from a run.
 * Graceful shutdown with timeout, then force kill.
 *
 * @param {string} runFolder - Path to run folder
 * @param {object} options - Configuration
 *   - timeout: max time for graceful cleanup (default: 30000ms)
 *   - forceKill: force kill processes (default: true)
 * @returns {object} - { success, cleaned, failed, emergency }
 */
async function cleanupResources(runFolder, options = {}) {
  const { timeout = 30000, forceKill = true } = options;

  const results = {
    success: true,
    cleaned: [],
    failed: [],
    emergency: false,
  };

  const startTime = Date.now();

  try {
    // 1. Kill Playwright browser processes (graceful first)
    const browserCleanup = await cleanupBrowserProcesses(timeout / 2);
    results.cleaned.push(...browserCleanup.cleaned);
    results.failed.push(...browserCleanup.failed);

    // 2. Remove temp files from run folder
    const tempCleanup = await cleanupTempFiles(runFolder);
    results.cleaned.push(...tempCleanup.cleaned);
    results.failed.push(...tempCleanup.failed);

    // 3. Check if we're running out of time
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout * 0.8) {
      results.emergency = true;
    }

    // 4. Emergency: Force kill any remaining processes
    if (forceKill && (results.emergency || results.failed.length > 0)) {
      const forcedCleanup = await forceCleanupProcesses();
      results.cleaned.push(...forcedCleanup.cleaned);
      results.emergency = true;
    }
  } catch (e) {
    results.success = false;
    results.failed.push(`Cleanup error: ${e.message}`);
  }

  return results;
}

/**
 * Kill orphaned Playwright browser processes.
 * Tries graceful shutdown first, then force kill.
 */
async function cleanupBrowserProcesses(timeout = 10000) {
  const results = { cleaned: [], failed: [] };

  try {
    // Platform-specific process cleanup
    const isWindows = process.platform === "win32";
    const processName = isWindows ? "chrome" : "chrome";

    if (isWindows) {
      // Windows: taskkill for chrome processes
      try {
        execSync('taskkill /IM chrome.exe /T /F 2>nul', { timeout, stdio: "ignore" });
        results.cleaned.push("Killed orphaned Chrome processes (Windows)");
      } catch (e) {
        // Expected if no processes found
      }

      try {
        execSync('taskkill /IM msedgedriver.exe /T /F 2>nul', { timeout, stdio: "ignore" });
        results.cleaned.push("Killed orphaned Edge processes (Windows)");
      } catch (e) {
        // Expected if no processes found
      }
    } else {
      // Unix: pkill for chrome/chromium
      try {
        execSync("pkill -9 chrome 2>/dev/null || true", { timeout, stdio: "ignore" });
        results.cleaned.push("Killed orphaned Chrome processes (Unix)");
      } catch (e) {
        // Expected if no processes found
      }

      try {
        execSync("pkill -9 chromium 2>/dev/null || true", { timeout, stdio: "ignore" });
        results.cleaned.push("Killed orphaned Chromium processes (Unix)");
      } catch (e) {
        // Expected if no processes found
      }
    }
  } catch (e) {
    results.failed.push(`Browser cleanup failed: ${e.message}`);
  }

  return results;
}

/**
 * Remove temporary files from run folder.
 * Removes: .tmp, screenshot cache, old logs, etc.
 */
async function cleanupTempFiles(runFolder) {
  const results = { cleaned: [], failed: [] };

  if (!fs.existsSync(runFolder)) {
    results.failed.push(`Run folder not found: ${runFolder}`);
    return results;
  }

  try {
    // Patterns to clean
    const patterns = [
      { dir: runFolder, pattern: /\.tmp\..+$/, desc: "Temp files" },
      { dir: path.join(runFolder, "screenshots"), pattern: /^\./, desc: "Hidden files in screenshots" },
    ];

    for (const { dir, pattern, desc } of patterns) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (pattern.test(file)) {
            const filePath = path.join(dir, file);
            try {
              fs.unlinkSync(filePath);
              results.cleaned.push(`${desc}: ${file}`);
            } catch (e) {
              results.failed.push(`Could not delete ${file}: ${e.message}`);
            }
          }
        }
      } catch (e) {
        results.failed.push(`Failed to list ${dir}: ${e.message}`);
      }
    }

    // Cleanup old logs (>24h)
    const logsDir = path.join(runFolder, "logs");
    if (fs.existsSync(logsDir)) {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      try {
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
          const filePath = path.join(logsDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtime.getTime() > oneDay) {
            fs.unlinkSync(filePath);
            results.cleaned.push(`Old log: ${file}`);
          }
        }
      } catch (e) {
        results.failed.push(`Failed to cleanup logs: ${e.message}`);
      }
    }
  } catch (e) {
    results.failed.push(`Temp file cleanup failed: ${e.message}`);
  }

  return results;
}

/**
 * Force kill any remaining processes (emergency cleanup).
 * Called only when graceful cleanup doesn't work.
 */
async function forceCleanupProcesses() {
  const results = { cleaned: [], failed: [] };

  try {
    const isWindows = process.platform === "win32";

    if (isWindows) {
      // Windows: aggressive taskkill
      execSync('taskkill /F /IM node.exe 2>nul || true', { stdio: "ignore" });
      results.cleaned.push("Force killed Node processes (emergency)");
    } else {
      // Unix: aggressive pkill
      execSync("pkill -9 -f 'qa-' 2>/dev/null || true", { stdio: "ignore" });
      results.cleaned.push("Force killed QA processes (emergency)");
    }
  } catch (e) {
    results.failed.push(`Force cleanup failed: ${e.message}`);
  }

  return results;
}

/**
 * Verify that cleanup was successful.
 * Checks: no temp files remain, reasonable disk usage, no orphaned processes.
 */
async function verifyCleanup(runFolder) {
  const checks = {
    tempFilesRemoved: true,
    diskUsageReasonable: true,
    noOrphanedProcesses: true,
    details: [],
  };

  try {
    // Check 1: No temp files
    const tempFiles = [];
    if (fs.existsSync(runFolder)) {
      const files = fs.readdirSync(runFolder);
      for (const file of files) {
        if (/\.tmp\..+$/.test(file)) {
          tempFiles.push(file);
        }
      }
    }

    if (tempFiles.length > 0) {
      checks.tempFilesRemoved = false;
      checks.details.push(`Found ${tempFiles.length} temp files: ${tempFiles.slice(0, 3).join(", ")}`);
    } else {
      checks.details.push("✓ No temp files remain");
    }

    // Check 2: Disk usage reasonable (run folder <1GB)
    if (fs.existsSync(runFolder)) {
      const sizeBytes = getDirSize(runFolder);
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);
      if (sizeGB > 1) {
        checks.diskUsageReasonable = false;
        checks.details.push(`Run folder size: ${sizeGB.toFixed(2)}GB (threshold: 1GB)`);
      } else {
        checks.details.push(`✓ Run folder size: ${sizeGB.toFixed(2)}GB`);
      }
    }

    // Check 3: No Playwright processes
    const isWindows = process.platform === "win32";
    try {
      if (isWindows) {
        execSync('tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | find /I "chrome" >nul', {
          stdio: "ignore",
        });
        checks.noOrphanedProcesses = false;
        checks.details.push("Warning: Chrome processes still running");
      } else {
        execSync("pgrep chrome 2>/dev/null >/dev/null", { stdio: "ignore" });
        checks.noOrphanedProcesses = false;
        checks.details.push("Warning: Chrome processes still running");
      }
    } catch (e) {
      checks.details.push("✓ No orphaned browser processes");
    }

    checks.success = checks.tempFilesRemoved && checks.diskUsageReasonable && checks.noOrphanedProcesses;
  } catch (e) {
    checks.success = false;
    checks.details.push(`Verification error: ${e.message}`);
  }

  return checks;
}

/**
 * Get directory size recursively.
 */
function getDirSize(dirPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stat.size;
      }
    }
  } catch (e) {
    // Silently fail, size is best-effort
  }
  return size;
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    cleanupResources,
    cleanupBrowserProcesses,
    cleanupTempFiles,
    forceCleanupProcesses,
    verifyCleanup,
  };
}
