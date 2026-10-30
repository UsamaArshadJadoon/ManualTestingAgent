#!/usr/bin/env node
/**
 * diagnostics-collector.js — QA AZM Digital Agent
 *
 * Collects comprehensive diagnostic information for troubleshooting.
 * Gathers system info, config, logs, and run folder summary.
 * Outputs JSON + HTML report for support and debugging.
 *
 * Usage:
 *   const collector = new DiagnosticsCollector();
 *   const report = await collector.collect(runFolder);
 *   // Returns: { system, config, logs, runFolder, report }
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

class DiagnosticsCollector {
  constructor(options = {}) {
    this.maxLogEvents = options.maxLogEvents || 500;
    this.redactPatterns = options.redactPatterns || [/password/i, /token/i, /secret/i, /key/i];
  }

  async collect(runFolder) {
    const startTime = Date.now();
    const report = {
      timestamp: new Date().toISOString(),
      system: this.collectSystemInfo(),
      nodejs: this.collectNodeInfo(),
      environment: this.collectEnvironmentInfo(),
      config: this.collectConfigInfo(runFolder),
      logs: await this.collectRecentLogs(runFolder),
      runFolder: this.collectRunFolderInfo(runFolder),
      performance: { collectionTimeMs: 0 },
    };

    report.performance.collectionTimeMs = Date.now() - startTime;
    return report;
  }

  collectSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      osVersion: os.release(),
      hostname: os.hostname(),
      homeDir: os.homedir(),
      cpuCount: os.cpus().length,
      totalMemoryGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      freeMemoryGb: Math.round(os.freemem() / 1024 / 1024 / 1024),
    };
  }

  collectNodeInfo() {
    return {
      version: process.version,
      nodeExePath: process.execPath,
      npmVersion: this.tryExec("npm --version"),
      npmRegistry: this.tryExec("npm config get registry"),
    };
  }

  collectEnvironmentInfo() {
    const env = {};
    const allowedVars = [
      "NODE_ENV",
      "PATH",
      "HOME",
      "TMPDIR",
      "QA_USER",  // (redacted if set)
      "QA_PASS",  // (redacted if set)
      "AIO_TOKEN", // (redacted if set)
      "JIRA_TOKEN", // (redacted if set)
    ];

    for (const key of allowedVars) {
      if (process.env[key]) {
        env[key] = this.shouldRedact(key) ? "***" : process.env[key];
      }
    }

    return env;
  }

  collectConfigInfo(runFolder) {
    const configPath = path.resolve(".qa-config.json");
    if (!fs.existsSync(configPath)) {
      return { status: "NOT_FOUND", path: configPath };
    }

    try {
      const content = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        status: "FOUND",
        path: configPath,
        size: fs.statSync(configPath).size,
        fields: {
          hasJira: !!content.jira,
          hasApp: !!content.app,
          hasSafety: !!content.safety,
          hasAio: !!content.aio,
          hasExecution: !!content.execution,
        },
      };
    } catch (e) {
      return { status: "ERROR", error: e.message };
    }
  }

  async collectRecentLogs(runFolder) {
    const logsDir = path.join(runFolder, "..", "..", "logs");
    const logs = [];

    if (!fs.existsSync(logsDir)) {
      return { status: "NO_LOGS_DIR", path: logsDir };
    }

    try {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith(".log"))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          mtime: fs.statSync(path.join(logsDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5);  // Recent 5 log files

      for (const file of files) {
        try {
          const content = fs.readFileSync(file.path, "utf8");
          const lines = content.split("\n").filter(Boolean);
          const recent = lines.slice(-this.maxLogEvents).map(line => {
            try { return JSON.parse(line); } catch { return { raw: line }; }
          });

          logs.push({
            file: file.name,
            lineCount: lines.length,
            recentCount: recent.length,
            events: recent,
          });
        } catch (e) {
          logs.push({
            file: file.name,
            error: e.message,
          });
        }
      }

      return { status: "OK", files: logs };
    } catch (e) {
      return { status: "ERROR", error: e.message };
    }
  }

  collectRunFolderInfo(runFolder) {
    if (!fs.existsSync(runFolder)) {
      return { status: "NOT_FOUND", path: runFolder };
    }

    try {
      const stat = fs.statSync(runFolder);
      const files = fs.readdirSync(runFolder);
      const jsonFiles = files.filter(f => f.endsWith(".json"));
      const screenshotCount = fs.existsSync(path.join(runFolder, "screenshots"))
        ? fs.readdirSync(path.join(runFolder, "screenshots")).length
        : 0;

      return {
        status: "OK",
        path: runFolder,
        sizeBytes: this.getDirSize(runFolder),
        sizeGb: Math.round(this.getDirSize(runFolder) / 1024 / 1024 / 1024 * 100) / 100,
        fileCount: files.length,
        jsonFiles: jsonFiles.map(f => ({
          name: f,
          size: fs.statSync(path.join(runFolder, f)).size,
        })),
        screenshotsCount: screenshotCount,
        lastModified: stat.mtime.toISOString(),
      };
    } catch (e) {
      return { status: "ERROR", error: e.message };
    }
  }

  getDirSize(dir) {
    let size = 0;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          size += this.getDirSize(filePath);
        } else {
          size += stat.size;
        }
      }
    } catch (e) {
      // Silently fail for permission issues
    }
    return size;
  }

  shouldRedact(key) {
    return /password|token|secret|key|credential/i.test(key);
  }

  tryExec(cmd) {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch {
      return "N/A";
    }
  }

  generateHtmlReport(diagnostics) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QA Framework Diagnostics Report</title>
  <style>
    body { font-family: system-ui; margin: 2rem; background: #f5f5f5; }
    .report { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #0e7c86; padding-bottom: 0.5rem; }
    h2 { color: #0e7c86; margin-top: 2rem; }
    .section { margin: 1.5rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: 600; }
    .good { color: #27ae60; font-weight: 600; }
    .warning { color: #f39c12; font-weight: 600; }
    .error { color: #e74c3c; font-weight: 600; }
    .code { background: #f4f4f4; padding: 0.25rem 0.5rem; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="report">
    <h1>QA Framework Diagnostics Report</h1>
    <p><strong>Generated:</strong> ${diagnostics.timestamp}</p>
    <p><strong>Collection Time:</strong> ${diagnostics.performance.collectionTimeMs}ms</p>

    <h2>System Information</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Platform</td><td>${diagnostics.system.platform}</td></tr>
      <tr><td>OS Version</td><td>${diagnostics.system.osVersion}</td></tr>
      <tr><td>CPU Count</td><td>${diagnostics.system.cpuCount}</td></tr>
      <tr><td>Total Memory</td><td>${diagnostics.system.totalMemoryGb} GB</td></tr>
      <tr><td>Free Memory</td><td><span class="${diagnostics.system.freeMemoryGb < 2 ? 'warning' : 'good'}">${diagnostics.system.freeMemoryGb} GB</span></td></tr>
    </table>

    <h2>Node.js Environment</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Node Version</td><td>${diagnostics.nodejs.version}</td></tr>
      <tr><td>NPM Version</td><td>${diagnostics.nodejs.npmVersion}</td></tr>
    </table>

    <h2>Configuration</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Config Status</td><td><span class="${diagnostics.config.status === 'FOUND' ? 'good' : 'error'}">${diagnostics.config.status}</span></td></tr>
      <tr><td>Jira Config</td><td>${diagnostics.config.fields?.hasJira ? '<span class="good">✓</span>' : '<span class="warning">✗</span>'}</td></tr>
      <tr><td>AIO Config</td><td>${diagnostics.config.fields?.hasAio ? '<span class="good">✓</span>' : '<span class="warning">✗</span>'}</td></tr>
    </table>

    <h2>Run Folder</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Status</td><td><span class="${diagnostics.runFolder.status === 'OK' ? 'good' : 'error'}">${diagnostics.runFolder.status}</span></td></tr>
      <tr><td>Size</td><td>${diagnostics.runFolder.sizeGb} GB</td></tr>
      <tr><td>File Count</td><td>${diagnostics.runFolder.fileCount}</td></tr>
      <tr><td>Screenshots</td><td>${diagnostics.runFolder.screenshotsCount}</td></tr>
    </table>

    <h2>Recent Logs</h2>
    <p>Last 100 events from most recent log file:</p>
    <pre style="background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto;">${JSON.stringify(diagnostics.logs.files?.[0]?.events?.slice(-100) || [], null, 2)}</pre>

    <h2>Next Steps</h2>
    <ul>
      <li>Review the system information above to identify resource constraints</li>
      <li>Check configuration status — ensure .qa-config.json is valid</li>
      <li>Review recent logs for error patterns</li>
      <li>If issues persist, provide this report to support</li>
    </ul>
  </div>
</body>
</html>`;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DiagnosticsCollector;
}
