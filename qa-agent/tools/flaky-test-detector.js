#!/usr/bin/env node
/**
 * flaky-test-detector.js — QA AZM Digital Agent
 *
 * Analyzes test results across runs to identify and report flaky tests.
 * Flaky tests fail intermittently; identifying them prevents false confidence.
 *
 * Usage:
 *   node flaky-test-detector.js <results-dir> [--min-runs 5] [--threshold 80]
 *
 * <results-dir>    Directory containing results.json files from multiple runs
 * --min-runs       Minimum runs to consider (default: 5)
 * --threshold      Pass rate % to consider stable (default: 80)
 *
 * Output:
 *   flakiness-report.json - Machine-readable report
 *   flakiness-report.html - Human-readable report
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

// ---- config ----

const MIN_RUNS = parseInt(process.argv[3]?.split("=")[1] || "5");
const PASS_THRESHOLD = parseInt(process.argv[4]?.split("=")[1] || "80");
const RESULTS_DIR = process.argv[2];

if (!RESULTS_DIR) die("usage: node flaky-test-detector.js <results-dir> [--min-runs N] [--threshold N]");
if (!fs.existsSync(RESULTS_DIR)) die(`Directory not found: ${RESULTS_DIR}`, 2);

// ---- load results ----

const resultsFiles = fs.readdirSync(RESULTS_DIR)
  .filter(f => f === "results.json" || f.match(/results.*\.json$/))
  .map(f => path.join(RESULTS_DIR, f));

if (resultsFiles.length < MIN_RUNS) {
  die(`Need at least ${MIN_RUNS} runs, found ${resultsFiles.length}`);
}

const testHistory = {};

for (const file of resultsFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const runDate = fs.statSync(file).mtime;

    for (const testCase of data.cases || []) {
      const testId = testCase.id;
      if (!testHistory[testId]) {
        testHistory[testId] = {
          id: testId,
          title: testCase.title || testId,
          runs: [],
          results: [],
        };
      }
      testHistory[testId].runs.push(runDate);
      testHistory[testId].results.push(testCase.status);
    }
  } catch (e) {
    console.warn(`Skipping ${file}: ${e.message}`);
  }
}

// ---- analyze flakiness ----

const analysis = {
  timestamp: new Date().toISOString(),
  runsAnalyzed: resultsFiles.length,
  minRunsRequired: MIN_RUNS,
  passThreshold: PASS_THRESHOLD,
  tests: [],
  summary: {
    total: 0,
    stable: 0,
    flaky: 0,
    veryFlaky: 0,
    failing: 0,
  },
  recommendations: [],
};

for (const [testId, history] of Object.entries(testHistory)) {
  if (history.runs.length < MIN_RUNS) continue;

  const statusCounts = {};
  for (const status of history.results) {
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const passCount = statusCounts.passed || 0;
  const failCount = statusCounts.failed || 0;
  const blockCount = statusCounts.blocked || 0;
  const flakyCount = statusCounts.flaky || 0;
  const total = history.results.length;
  const passRate = Math.round((passCount / total) * 100);

  const test = {
    id: testId,
    title: history.title,
    runsCount: total,
    results: {
      passed: passCount,
      failed: failCount,
      blocked: blockCount,
      flaky: flakyCount,
    },
    passRate,
    stability: passRate >= PASS_THRESHOLD ? "stable" : passRate >= 50 ? "flaky" : "failing",
    pattern: identifyPattern(history.results),
  };

  analysis.tests.push(test);
  analysis.summary.total++;

  if (test.stability === "stable") {
    analysis.summary.stable++;
  } else if (test.stability === "flaky") {
    analysis.summary.flaky++;
    if (passRate < 50) analysis.summary.veryFlaky++;
  } else {
    analysis.summary.failing++;
  }
}

// Sort by pass rate (least stable first)
analysis.tests.sort((a, b) => a.passRate - b.passRate);

// ---- recommendations ----

const veryFlaky = analysis.tests.filter(t => t.passRate < 50);
const flaky = analysis.tests.filter(t => t.passRate >= 50 && t.passRate < PASS_THRESHOLD);

if (veryFlaky.length > 0) {
  analysis.recommendations.push({
    severity: "high",
    title: `${veryFlaky.length} test(s) consistently failing`,
    action: "These tests fail >50% of the time. Root causes: logic errors, missing test data, environment issues.",
    tests: veryFlaky.map(t => t.id).slice(0, 5),
  });
}

if (flaky.length > 0) {
  analysis.recommendations.push({
    severity: "medium",
    title: `${flaky.length} test(s) are flaky`,
    action: "These tests fail 20-50% of the time. Root causes: timing issues, race conditions, network instability.",
    tests: flaky.map(t => t.id).slice(0, 5),
  });
}

if (analysis.summary.flaky === 0) {
  analysis.recommendations.push({
    severity: "low",
    title: "All tests appear stable",
    action: "Good news! No flaky tests detected in this run set.",
    tests: [],
  });
}

// ---- write reports ----

const reportPath = path.join(RESULTS_DIR, "flakiness-report.json");
const htmlPath = path.join(RESULTS_DIR, "flakiness-report.html");

fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2), "utf8");

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Flakiness Report</title>
  <style>
    body { font-family: system-ui; margin: 2rem; background: #f5f5f5; }
    .header { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
    h1 { margin: 0; color: #333; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .stat { background: #f0f0f0; padding: 1rem; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #0066cc; }
    .stat-label { font-size: 0.9em; color: #666; }
    .recommendations { margin-bottom: 2rem; }
    .rec { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #ff9800; }
    .rec.high { border-left-color: #f44336; }
    .rec.medium { border-left-color: #ff9800; }
    .rec.low { border-left-color: #4caf50; }
    .tests-table { background: white; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    .stable { color: #4caf50; }
    .flaky { color: #ff9800; }
    .failing { color: #f44336; }
    .rate { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Flakiness Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Analyzed ${analysis.runsAnalyzed} runs | Threshold: ${PASS_THRESHOLD}% stable</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${analysis.summary.total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #4caf50">${analysis.summary.stable}</div>
        <div class="stat-label">Stable</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #ff9800">${analysis.summary.flaky}</div>
        <div class="stat-label">Flaky</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: #f44336">${analysis.summary.failing}</div>
        <div class="stat-label">Failing</div>
      </div>
    </div>
  </div>

  <div class="recommendations">
    <h2>Recommendations</h2>
    ${analysis.recommendations.map(r => `
      <div class="rec ${r.severity}">
        <h3>${escapeHtml(r.title)}</h3>
        <p>${escapeHtml(r.action)}</p>
        ${r.tests.length > 0 ? `<p><strong>Tests:</strong> ${r.tests.map(t => escapeHtml(t)).join(", ")}</p>` : ""}
      </div>
    `).join("")}
  </div>

  <div class="tests-table">
    <h2>All Tests</h2>
    <table>
      <thead>
        <tr>
          <th>Test ID</th>
          <th>Title</th>
          <th>Runs</th>
          <th>Passed</th>
          <th>Failed</th>
          <th class="rate">Pass Rate</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${analysis.tests.map(t => `
          <tr>
            <td><code>${escapeHtml(t.id)}</code></td>
            <td>${escapeHtml(t.title)}</td>
            <td>${t.runsCount}</td>
            <td>${t.results.passed}</td>
            <td>${t.results.failed}</td>
            <td class="rate ${t.stability}">${t.passRate}%</td>
            <td><span class="${t.stability}">${escapeHtml(t.stability.toUpperCase())}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");

console.log(`✓ Flakiness report generated`);
console.log(`  ${reportPath}`);
console.log(`  ${htmlPath}`);
console.log(`\nSummary:`);
console.log(`  Total tests: ${analysis.summary.total}`);
console.log(`  Stable: ${analysis.summary.stable}`);
console.log(`  Flaky: ${analysis.summary.flaky}`);
console.log(`  Failing: ${analysis.summary.failing}`);

// ---- helper ----

function identifyPattern(results) {
  const streaks = [];
  let currentStreak = { status: results[0], count: 1 };

  for (let i = 1; i < results.length; i++) {
    if (results[i] === currentStreak.status) {
      currentStreak.count++;
    } else {
      streaks.push(currentStreak);
      currentStreak = { status: results[i], count: 1 };
    }
  }
  streaks.push(currentStreak);

  if (streaks.length === 1) return "consistent";
  if (streaks.length <= 3) return "occasional";
  return "random";
}
