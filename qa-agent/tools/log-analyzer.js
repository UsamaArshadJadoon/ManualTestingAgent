#!/usr/bin/env node
/**
 * log-analyzer.js — QA AZM Digital Agent
 *
 * Query and analyze structured logs for debugging and metrics.
 * Extract events by test case, find retries, identify patterns.
 * Generate summaries and export for external analysis.
 *
 * Usage:
 *   const analyzer = new LogAnalyzer(logFile);
 *   const caseEvents = analyzer.filterByTestCase('TC1');
 *   const retries = analyzer.findAllRetries();
 *   const patterns = analyzer.identifyErrorPatterns();
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

class LogAnalyzer {
  constructor(logFilePath) {
    this.logFilePath = logFilePath;
    this.events = [];
    this.load();
  }

  load() {
    if (!fs.existsSync(this.logFilePath)) {
      throw new Error(`Log file not found: ${this.logFilePath}`);
    }

    try {
      const content = fs.readFileSync(this.logFilePath, "utf8");
      const lines = content.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          this.events.push(JSON.parse(line));
        } catch (e) {
          this.events.push({ raw: line, parseError: true });
        }
      }
    } catch (e) {
      throw new Error(`Failed to read log file: ${e.message}`);
    }
  }

  filterByTestCase(caseId) {
    return this.events.filter(
      e => e.caseId === caseId || e.testId === caseId || e.raw?.includes(caseId)
    );
  }

  filterByLevel(level) {
    return this.events.filter(e => e.level === level.toUpperCase());
  }

  filterByAgent(agentName) {
    return this.events.filter(e => e.logger === agentName);
  }

  filterByStage(stageName) {
    return this.events.filter(e => e.message?.includes(stageName) || e.stage === stageName);
  }

  findAllRetries() {
    return this.events.filter(e =>
      e.message?.toLowerCase().includes("retry") ||
      e.message?.toLowerCase().includes("retrying") ||
      e.attempt !== undefined
    );
  }

  findAllErrors() {
    return this.events.filter(e => e.level === "ERROR" || e.error !== undefined);
  }

  findAllWarnings() {
    return this.events.filter(e => e.level === "WARN" || e.level === "WARNING");
  }

  identifyErrorPatterns() {
    const errors = this.findAllErrors();
    const patterns = {};

    for (const error of errors) {
      const message = error.message || error.error || error.raw || "unknown";
      const category = this.categorizeError(message);

      if (!patterns[category]) {
        patterns[category] = { count: 0, examples: [] };
      }

      patterns[category].count++;
      if (patterns[category].examples.length < 3) {
        patterns[category].examples.push({
          message,
          timestamp: error.timestamp,
          logger: error.logger,
        });
      }
    }

    return patterns;
  }

  categorizeError(message) {
    const msg = String(message).toLowerCase();

    if (msg.includes("timeout")) return "TIMEOUT";
    if (msg.includes("connection") || msg.includes("refused")) return "CONNECTION_ERROR";
    if (msg.includes("401") || msg.includes("authentication")) return "AUTH_ERROR";
    if (msg.includes("403") || msg.includes("forbidden")) return "PERMISSION_ERROR";
    if (msg.includes("404") || msg.includes("not found")) return "NOT_FOUND";
    if (msg.includes("429") || msg.includes("rate limit")) return "RATE_LIMIT";
    if (msg.includes("500") || msg.includes("server error")) return "SERVER_ERROR";
    if (msg.includes("memory") || msg.includes("oom")) return "MEMORY_ERROR";
    if (msg.includes("crash") || msg.includes("crashed")) return "CRASH";
    if (msg.includes("json")) return "JSON_ERROR";
    if (msg.includes("invalid")) return "VALIDATION_ERROR";

    return "OTHER";
  }

  getTimingAnalysis() {
    const timings = {};

    for (const event of this.events) {
      if (event.duration !== undefined && event.logger) {
        const logger = event.logger;
        if (!timings[logger]) {
          timings[logger] = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0 };
        }
        timings[logger].count++;
        timings[logger].totalMs += event.duration;
        timings[logger].minMs = Math.min(timings[logger].minMs, event.duration);
        timings[logger].maxMs = Math.max(timings[logger].maxMs, event.duration);
      }
    }

    const analysis = {};
    for (const [logger, data] of Object.entries(timings)) {
      analysis[logger] = {
        count: data.count,
        avgMs: Math.round(data.totalMs / data.count),
        minMs: data.minMs,
        maxMs: data.maxMs,
      };
    }

    return analysis;
  }

  getSummary() {
    const errors = this.findAllErrors().length;
    const warnings = this.findAllWarnings().length;
    const retries = this.findAllRetries().length;
    const patterns = this.identifyErrorPatterns();

    return {
      totalEvents: this.events.length,
      errorCount: errors,
      warningCount: warnings,
      retryCount: retries,
      errorPatterns: patterns,
      topAgent: this.getMostActiveAgent(),
      timing: this.getTimingAnalysis(),
    };
  }

  getMostActiveAgent() {
    const agents = {};
    for (const event of this.events) {
      if (event.logger) {
        agents[event.logger] = (agents[event.logger] || 0) + 1;
      }
    }

    let topAgent = null;
    let topCount = 0;
    for (const [agent, count] of Object.entries(agents)) {
      if (count > topCount) {
        topAgent = agent;
        topCount = count;
      }
    }

    return topAgent;
  }

  exportCsv(outputPath) {
    const csv = [];
    csv.push("timestamp,level,logger,message,caseId,duration,error");

    for (const event of this.events) {
      const row = [
        event.timestamp || "",
        event.level || "",
        event.logger || "",
        `"${(event.message || "").replace(/"/g, '""')}"`,
        event.caseId || "",
        event.duration || "",
        event.error || "",
      ];
      csv.push(row.join(","));
    }

    fs.writeFileSync(outputPath, csv.join("\n"), "utf8");
    return outputPath;
  }

  exportJson(outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(this.events, null, 2), "utf8");
    return outputPath;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = LogAnalyzer;
}
