#!/usr/bin/env node
/**
 * performance-profiler.js — QA AZM Digital Agent
 *
 * Profiles test execution to identify slow steps and bottlenecks.
 * Generates performance reports with optimization recommendations.
 *
 * Usage (from Node script):
 *   const profiler = new PerformanceProfiler();
 *   profiler.profile(results);
 *   profiler.generateReport(outputPath);
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

class PerformanceProfiler {
  constructor() {
    this.measurements = {};
    this.apiCalls = [];
    this.slowestSteps = [];
  }

  /**
   * Record a performance measurement.
   */
  measure(label, durationMs, metadata = {}) {
    if (!this.measurements[label]) {
      this.measurements[label] = {
        count: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: 0,
        instances: [],
      };
    }

    const m = this.measurements[label];
    m.count++;
    m.totalMs += durationMs;
    m.minMs = Math.min(m.minMs, durationMs);
    m.maxMs = Math.max(m.maxMs, durationMs);
    m.instances.push({ durationMs, ...metadata });
  }

  /**
   * Record an API call.
   */
  recordApiCall(method, url, durationMs, status, metadata = {}) {
    this.apiCalls.push({
      method,
      url,
      durationMs,
      status,
      ...metadata,
    });
  }

  /**
   * Generate performance report.
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      measurements: this.generateMeasurementStats(),
      apiCalls: this.generateApiStats(),
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generateOptimizations(),
    };

    return report;
  }

  /**
   * Generate summary statistics.
   */
  generateSummary() {
    let totalTime = 0;
    for (const m of Object.values(this.measurements)) {
      totalTime += m.totalMs;
    }

    return {
      totalTimeSeconds: (totalTime / 1000).toFixed(1),
      measurements: Object.keys(this.measurements).length,
      apiCalls: this.apiCalls.length,
      slowestMeasurement: this.findSlowest(),
    };
  }

  /**
   * Generate stats for each measurement.
   */
  generateMeasurementStats() {
    const stats = [];

    for (const [label, data] of Object.entries(this.measurements)) {
      const avg = Math.round(data.totalMs / data.count);
      stats.push({
        label,
        count: data.count,
        totalMs: Math.round(data.totalMs),
        avgMs: avg,
        minMs: Math.round(data.minMs),
        maxMs: Math.round(data.maxMs),
        percentOfTotal: this.getPercentOfTotal(data.totalMs),
      });
    }

    return stats.sort((a, b) => b.totalMs - a.totalMs);
  }

  /**
   * Generate API call statistics.
   */
  generateApiStats() {
    if (this.apiCalls.length === 0) return { total: 0, byEndpoint: {} };

    const byEndpoint = {};
    let totalTime = 0;

    for (const call of this.apiCalls) {
      const key = `${call.method} ${call.url}`;
      if (!byEndpoint[key]) {
        byEndpoint[key] = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0 };
      }

      byEndpoint[key].count++;
      byEndpoint[key].totalMs += call.durationMs;
      byEndpoint[key].minMs = Math.min(byEndpoint[key].minMs, call.durationMs);
      byEndpoint[key].maxMs = Math.max(byEndpoint[key].maxMs, call.durationMs);
      totalTime += call.durationMs;
    }

    // Sort by total time
    const sorted = Object.entries(byEndpoint)
      .map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
        avgMs: Math.round(stats.totalMs / stats.count),
        percentOfTotal: ((stats.totalMs / totalTime) * 100).toFixed(1),
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    return {
      total: this.apiCalls.length,
      totalTimeMs: Math.round(totalTime),
      byEndpoint: sorted,
    };
  }

  /**
   * Identify performance bottlenecks.
   */
  identifyBottlenecks() {
    const stats = this.generateMeasurementStats();
    const bottlenecks = [];

    for (const stat of stats.slice(0, 5)) {  // Top 5 slowest
      if (stat.totalMs > 5000) {  // >5s
        bottlenecks.push({
          label: stat.label,
          timeMs: stat.totalMs,
          avgMs: stat.avgMs,
          percentOfTotal: stat.percentOfTotal,
          severity: stat.totalMs > 30000 ? "critical" : stat.totalMs > 10000 ? "high" : "medium",
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Generate optimization recommendations.
   */
  generateOptimizations() {
    const recommendations = [];
    const bottlenecks = this.identifyBottlenecks();

    if (bottlenecks.length > 0) {
      recommendations.push({
        priority: "high",
        title: "Address slow operations",
        details: bottlenecks.map(b => `${b.label}: ${b.timeMs}ms`).join(", "),
        suggestions: [
          "Profile and optimize slow functions",
          "Add caching where applicable",
          "Parallelize independent operations",
        ],
      });
    }

    // Check API performance
    const apiStats = this.generateApiStats();
    if (apiStats.byEndpoint.length > 0) {
      const slowest = apiStats.byEndpoint[0];
      if (slowest.avgMs > 1000) {
        recommendations.push({
          priority: "medium",
          title: `Slow API: ${slowest.endpoint}`,
          details: `Average: ${slowest.avgMs}ms, Total: ${slowest.totalMs}ms`,
          suggestions: [
            "Check server-side performance",
            "Implement request batching",
            "Add caching for repeated calls",
          ],
        });
      }
    }

    // Screenshot processing
    const screenshots = this.measurements["screenshot-processing"];
    if (screenshots && screenshots.avgMs > 100) {
      recommendations.push({
        priority: "medium",
        title: "Screenshot processing slow",
        details: `Average: ${screenshots.avgMs}ms per screenshot`,
        suggestions: [
          "Enable screenshot compression",
          "Reduce screenshot dimensions",
          "Process screenshots in parallel",
        ],
      });
    }

    return recommendations;
  }

  // ---- Helpers ----

  findSlowest() {
    let slowest = null;
    let maxTime = 0;

    for (const [label, data] of Object.entries(this.measurements)) {
      if (data.maxMs > maxTime) {
        maxTime = data.maxMs;
        slowest = { label, ms: data.maxMs };
      }
    }

    return slowest;
  }

  getPercentOfTotal(ms) {
    let total = 0;
    for (const m of Object.values(this.measurements)) {
      total += m.totalMs;
    }

    return total > 0 ? `${((ms / total) * 100).toFixed(1)}%` : "0%";
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = PerformanceProfiler;
}
