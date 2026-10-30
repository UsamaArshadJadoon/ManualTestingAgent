#!/usr/bin/env node
/**
 * memory-disk-monitor.js — QA AZM Digital Agent
 *
 * Monitors memory and disk usage, triggers cleanup when limits approached.
 * Prevents resource exhaustion and framework crashes.
 *
 * Usage (from Node script):
 *   const monitor = new ResourceMonitor({ maxMemoryMB: 2048, maxDiskGB: 100 });
 *   monitor.check(runFolder);  // Check resources
 *   monitor.cleanup(runFolder, { keepRuns: 10 });  // Cleanup old runs
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

class ResourceMonitor {
  constructor(options = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 2048;
    this.maxDiskGB = options.maxDiskGB || 100;
    this.alertThreshold = options.alertThreshold || 0.8;  // Alert at 80%
    this.emergencyThreshold = options.emergencyThreshold || 0.95;  // Emergency at 95%
    this.keepRuns = options.keepRuns || 10;
    this.cleanupLog = [];
  }

  // ---- Memory monitoring ----

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
      rss MB: Math.round(usage.rss / 1024 / 1024),
    };
  }

  getSystemMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usedPercent = usedMemory / totalMemory;

    return {
      totalMB: Math.round(totalMemory / 1024 / 1024),
      usedMB: Math.round(usedMemory / 1024 / 1024),
      freeMB: Math.round(freeMemory / 1024 / 1024),
      usedPercent: Math.round(usedPercent * 100),
      status: usedPercent > this.emergencyThreshold ? "emergency" :
              usedPercent > this.alertThreshold ? "warning" : "ok",
    };
  }

  // ---- Disk monitoring ----

  getDiskUsage(dirPath) {
    try {
      let totalBytes = 0;

      const walkDir = (dir) => {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              const stat = fs.statSync(filePath);
              if (stat.isDirectory() && !filePath.includes("node_modules")) {
                walkDir(filePath);
              } else if (stat.isFile()) {
                totalBytes += stat.size;
              }
            } catch (e) {
              // Skip files we can't access
            }
          }
        } catch (e) {
          // Skip directories we can't read
        }
      };

      walkDir(dirPath);
      return {
        bytes: totalBytes,
        MB: Math.round(totalBytes / 1024 / 1024),
        GB: (totalBytes / 1024 / 1024 / 1024).toFixed(2),
      };
    } catch (e) {
      return { bytes: 0, MB: 0, GB: "0.00", error: e.message };
    }
  }

  // ---- Health checks ----

  checkResources(runFolder) {
    const memoryStatus = this.getSystemMemoryUsage();
    const diskUsage = this.getDiskUsage(runFolder);
    const processMemory = this.getMemoryUsage();

    const alerts = [];
    if (memoryStatus.status === "emergency") {
      alerts.push({
        level: "emergency",
        message: `System memory critical: ${memoryStatus.usedPercent}% used`,
        action: "run emergency cleanup immediately",
      });
    } else if (memoryStatus.status === "warning") {
      alerts.push({
        level: "warning",
        message: `System memory high: ${memoryStatus.usedPercent}% used`,
        action: "consider cleanup",
      });
    }

    if (diskUsage.MB > this.maxDiskGB * 1024 * this.emergencyThreshold) {
      alerts.push({
        level: "emergency",
        message: `Disk usage critical: ${diskUsage.GB}GB (max ${this.maxDiskGB}GB)`,
        action: "run cleanup immediately",
      });
    } else if (diskUsage.MB > this.maxDiskGB * 1024 * this.alertThreshold) {
      alerts.push({
        level: "warning",
        message: `Disk usage high: ${diskUsage.GB}GB (max ${this.maxDiskGB}GB)`,
        action: "consider cleanup",
      });
    }

    return {
      timestamp: new Date().toISOString(),
      system: memoryStatus,
      disk: diskUsage,
      process: processMemory,
      alerts,
      shouldCleanup: alerts.length > 0,
    };
  }

  // ---- Cleanup ----

  cleanup(runFolder, options = {}) {
    const keepRuns = options.keepRuns || this.keepRuns;
    const results = {
      runsFolderPath: runFolder,
      cleaned: [],
      errors: [],
      spaceFreeGB: 0,
    };

    try {
      // Find all run folders
      if (!fs.existsSync(runFolder)) {
        results.errors.push(`Run folder does not exist: ${runFolder}`);
        return results;
      }

      const folders = fs.readdirSync(runFolder)
        .filter(f => fs.statSync(path.join(runFolder, f)).isDirectory())
        .map(f => ({
          name: f,
          path: path.join(runFolder, f),
          mtime: fs.statSync(path.join(runFolder, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);  // Newest first

      // Keep recent N, delete rest
      for (let i = keepRuns; i < folders.length; i++) {
        try {
          const folderSize = this.getDiskUsage(folders[i].path);
          this.deleteFolder(folders[i].path);
          results.cleaned.push({
            folder: folders[i].name,
            freedMB: folderSize.MB,
          });
          results.spaceFreeGB += parseFloat(folderSize.GB);
        } catch (e) {
          results.errors.push(`Failed to cleanup ${folders[i].name}: ${e.message}`);
        }
      }
    } catch (e) {
      results.errors.push(`Cleanup failed: ${e.message}`);
    }

    return results;
  }

  deleteFolder(folderPath) {
    const walk = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walk(filePath);
          fs.rmdirSync(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
    };

    walk(folderPath);
    fs.rmdirSync(folderPath);
  }

  // ---- Emergency cleanup ----

  emergencyCleanup(runFolder) {
    console.error("EMERGENCY: Triggering resource cleanup");

    // Kill old browser processes
    try {
      if (process.platform === "win32") {
        execSync("taskkill /F /IM chrome.exe", { stdio: "ignore" });
        execSync("taskkill /F /IM firefox.exe", { stdio: "ignore" });
      } else {
        execSync("killall -9 chrome 2>/dev/null || true", { stdio: "ignore" });
        execSync("killall -9 firefox 2>/dev/null || true", { stdio: "ignore" });
      }
    } catch (e) {
      // Silently fail
    }

    // Cleanup temp files
    try {
      const tempDir = path.join(runFolder, ".temp");
      if (fs.existsSync(tempDir)) {
        this.deleteFolder(tempDir);
      }
    } catch (e) {
      console.warn(`Could not cleanup temp: ${e.message}`);
    }

    // Cleanup oldest runs
    return this.cleanup(runFolder, { keepRuns: 3 });
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = ResourceMonitor;
}
