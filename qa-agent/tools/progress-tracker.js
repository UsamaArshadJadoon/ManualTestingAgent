#!/usr/bin/env node
/**
 * progress-tracker.js — QA AZM Digital Agent
 *
 * Tracks and displays run progress in real-time.
 * Updates % complete, time remaining, and case tallies.
 * Streams progress to stdout and saves progress file.
 *
 * Usage:
 *   const tracker = new ProgressTracker(runFolder);
 *   tracker.start();
 *   tracker.updateStage('test-executor', { caseCount: 20, progress: 5 });
 *   tracker.finish();
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

class ProgressTracker {
  constructor(runFolder, options = {}) {
    this.runFolder = runFolder;
    this.progressFile = path.join(runFolder, ".qa-progress.json");
    this.useColors = options.useColors !== false && process.stdout.isTTY;
    this.startTime = Date.now();
    this.stages = {
      "qa-story": { name: "Fetching Story", index: 1, weight: 5 },
      "qa-test-writer": { name: "Writing Test Cases", index: 2, weight: 20 },
      "qa-gap-analyzer": { name: "Analyzing Coverage", index: 3, weight: 10 },
      "qa-test-executor": { name: "Executing Tests", index: 4, weight: 45 },
      "qa-bug-logger": { name: "Logging Bugs", index: 5, weight: 15 },
      "qa-reviewer": { name: "Generating Report", index: 6, weight: 5 },
    };
    this.progress = {
      startTime: this.startTime,
      currentStage: null,
      stageProgress: {},
      overall: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      flaky: 0,
    };

    for (const stage in this.stages) {
      this.progress.stageProgress[stage] = { percent: 0, current: 0, total: 0 };
    }
  }

  start() {
    this.print("\n" + this.colorize("▶ Starting QA Run", "blue"));
    this.print(this.colorize(`  Run folder: ${this.runFolder}`, "gray"));
    this.print(this.colorize(`  Started at ${new Date().toLocaleTimeString()}`, "gray"));
    this.print("");
  }

  updateStage(stageName, data = {}) {
    if (!this.stages[stageName]) return;

    this.progress.currentStage = stageName;
    const stage = this.stages[stageName];

    if (data.caseCount) {
      this.progress.stageProgress[stageName].total = data.caseCount;
    }
    if (data.progress !== undefined) {
      this.progress.stageProgress[stageName].current = data.progress;
      this.progress.stageProgress[stageName].percent = Math.round(
        (data.progress / (data.caseCount || 1)) * 100
      );
    }

    // Update tallies
    if (data.passed !== undefined) this.progress.passed = data.passed;
    if (data.failed !== undefined) this.progress.failed = data.failed;
    if (data.blocked !== undefined) this.progress.blocked = data.blocked;
    if (data.flaky !== undefined) this.progress.flaky = data.flaky;

    // Calculate overall progress
    this.progress.overall = this.calculateOverallProgress();

    this.displayProgress();
    this.saveProgress();
  }

  calculateOverallProgress() {
    let totalWeight = 0;
    let weightedProgress = 0;

    for (const [stageName, stageInfo] of Object.entries(this.stages)) {
      const stageProgress = this.progress.stageProgress[stageName];
      const percent = stageProgress.percent || 0;
      const weight = stageInfo.weight;

      weightedProgress += (percent / 100) * weight;
      totalWeight += weight;
    }

    return Math.round(weightedProgress);
  }

  displayProgress() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const elapsedMin = Math.floor(elapsed / 60);
    const elapsedSec = elapsed % 60;

    const overallPercent = this.progress.overall;
    const estimatedTotal = elapsed / (overallPercent / 100);
    const remaining = Math.round(estimatedTotal - elapsed);
    const remainingMin = Math.floor(remaining / 60);
    const remainingSec = remaining % 60;

    // Overall progress bar
    const barLength = 30;
    const filledLength = Math.round((overallPercent / 100) * barLength);
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

    this.clearLine();
    this.print(
      this.colorize(`Overall: ${bar} ${overallPercent}%`, "green") +
      this.colorize(` [${elapsedMin}:${String(elapsedSec).padStart(2, "0")}/${remainingMin}:${String(remainingSec).padStart(2, "0")}]`, "gray")
    );

    // Current stage
    if (this.progress.currentStage) {
      const stage = this.stages[this.progress.currentStage];
      const stageProgress = this.progress.stageProgress[this.progress.currentStage];
      this.print(
        this.colorize(`  ▸ ${stage.name}`, "blue") +
        this.colorize(` ${stageProgress.current}/${stageProgress.total} (${stageProgress.percent}%)`, "gray")
      );
    }

    // Test tallies
    const tallies = [
      this.colorize(`✓ ${this.progress.passed}`, "green"),
      this.colorize(`✗ ${this.progress.failed}`, "red"),
      this.colorize(`⊘ ${this.progress.blocked}`, "yellow"),
    ];
    if (this.progress.flaky > 0) {
      tallies.push(this.colorize(`≈ ${this.progress.flaky}`, "yellow"));
    }
    this.print(`  Tests: ${tallies.join(" ")}`);
    this.print("");
  }

  finish() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const elapsedMin = Math.floor(elapsed / 60);
    const elapsedSec = elapsed % 60;

    this.progress.endTime = Date.now();
    this.progress.durationSeconds = elapsed;

    this.print(this.colorize("✓ Run Completed", "green"));
    this.print(this.colorize(`  Duration: ${elapsedMin}:${String(elapsedSec).padStart(2, "0")}`, "gray"));
    this.print(
      this.colorize(
        `  Results: ${this.progress.passed} passed, ${this.progress.failed} failed, ${this.progress.blocked} blocked`,
        "gray"
      )
    );
    this.print("");

    this.saveProgress();
  }

  saveProgress() {
    try {
      fs.writeFileSync(this.progressFile, JSON.stringify(this.progress, null, 2), "utf8");
    } catch (e) {
      // Silently fail if can't save progress
    }
  }

  calculateOverallProgress() {
    let totalWeight = 0;
    let weightedProgress = 0;

    for (const [stageName, stageInfo] of Object.entries(this.stages)) {
      const stageProgress = this.progress.stageProgress[stageName];
      const percent = stageProgress.percent || 0;
      const weight = stageInfo.weight;

      weightedProgress += (percent / 100) * weight;
      totalWeight += weight;
    }

    return Math.round(weightedProgress);
  }

  colorize(text, color) {
    if (!this.useColors) return text;
    const colors = {
      green: "\x1b[32m",
      red: "\x1b[31m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      gray: "\x1b[90m",
    };
    const reset = "\x1b[0m";
    return `${colors[color] || ""}${text}${reset}`;
  }

  print(text) {
    console.log(text);
  }

  clearLine() {
    process.stdout.write("\r\x1b[K");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProgressTracker;
}
