#!/usr/bin/env node
/**
 * parallel-execution-planner.js — QA AZM Digital Agent
 *
 * Analyzes test dependencies and creates a plan for parallel execution.
 * This tool PLANS parallelization (doesn't execute it yet).
 *
 * Usage (from Node script):
 *   const planner = new ParallelExecutionPlanner();
 *   const plan = planner.createPlan(testCases, { maxParallel: 4 });
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

class ParallelExecutionPlanner {
  constructor(options = {}) {
    this.maxParallel = options.maxParallel || 4;
    this.timeoutMs = options.timeoutMs || 300000;  // 5 min per test
  }

  /**
   * Create parallel execution plan from test cases.
   * Groups independent tests that can run concurrently.
   */
  createPlan(testCases, outputPath = null) {
    // Build dependency graph
    const dependencies = this.analyzeDependencies(testCases);

    // Group tests into partitions (each can run in parallel)
    const partitions = this.partitionTests(testCases, dependencies);

    // Calculate speedup potential
    const speedup = this.calculateSpeedup(partitions, testCases);

    const plan = {
      timestamp: new Date().toISOString(),
      totalTests: testCases.length,
      maxParallelWorkers: this.maxParallel,
      partitions,
      dependencies,
      speedup,
      recommendations: this.generateRecommendations(partitions, speedup),
    };

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2), "utf8");
    }

    return plan;
  }

  /**
   * Analyze dependencies between tests.
   * Tests with different app states, login states, or same AC are independent.
   */
  analyzeDependencies(testCases) {
    const dependencies = {};

    for (const test of testCases) {
      dependencies[test.id] = {
        id: test.id,
        appState: test.appState || "default",
        loginRequired: test.login !== false,
        linkedAC: test.linkedAC || [],
        canRunInParallel: [],
      };
    }

    // Mark which tests can run in parallel
    for (const test1 of testCases) {
      for (const test2 of testCases) {
        if (test1.id !== test2.id) {
          if (this.canRunInParallel(test1, test2)) {
            dependencies[test1.id].canRunInParallel.push(test2.id);
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Check if two tests can run in parallel.
   * Safe if: different app states, don't share login, don't modify same data.
   */
  canRunInParallel(test1, test2) {
    // Different AC = different features = safe
    if ((test1.linkedAC || []).every(ac => !(test2.linkedAC || []).includes(ac))) {
      return true;
    }

    // If same AC, they test same feature, must be serial
    return false;
  }

  /**
   * Partition tests into groups that can run in parallel.
   * Each group runs serially (but groups run in parallel).
   */
  partitionTests(testCases, dependencies) {
    const partitions = [];
    const assigned = new Set();

    for (const test of testCases) {
      if (assigned.has(test.id)) continue;

      // Start a new partition with this test
      const partition = [test];
      assigned.add(test.id);

      // Add other tests that can run in parallel with this group
      for (const other of testCases) {
        if (assigned.has(other.id)) continue;

        let canAddToPartition = true;
        for (const inPartition of partition) {
          if (!this.canRunInParallel(inPartition, other)) {
            canAddToPartition = false;
            break;
          }
        }

        if (canAddToPartition && partition.length < 20) {  // Cap tests per partition
          partition.push(other);
          assigned.add(other.id);
        }
      }

      partitions.push(partition);
    }

    return partitions;
  }

  /**
   * Calculate speedup from parallelization.
   * Assumes: N tests, M parallel workers, baseline = serial time.
   */
  calculateSpeedup(partitions, testCases) {
    // Estimate: 1 min per test (rough average)
    const baselineMinutes = testCases.length * 1;

    // With parallelization: sum of partition times (each partition is serial)
    const partitionMinutes = partitions.map(p => p.length * 1).reduce((a, b) => a + b, 0);

    // But we can run M partitions in parallel
    const parallelMinutes = Math.ceil(partitionMinutes / Math.min(this.maxParallel, partitions.length));

    return {
      baselineMinutes,
      estimatedMinutesWithParallel: parallelMinutes,
      speedupFactor: (baselineMinutes / parallelMinutes).toFixed(1),
      maxSpeedupPotential: Math.min(this.maxParallel, partitions.length),
    };
  }

  /**
   * Generate recommendations for parallelization.
   */
  generateRecommendations(partitions, speedup) {
    const recommendations = [];

    if (speedup.speedupFactor < 1.5) {
      recommendations.push({
        level: "low",
        message: "Low parallelization benefit detected",
        reason: "Tests have many dependencies; little speedup possible",
        action: "Consider refactoring tests to be more independent",
      });
    } else if (speedup.speedupFactor >= 3) {
      recommendations.push({
        level: "high",
        message: "High parallelization benefit possible",
        reason: `${speedup.speedupFactor}x speedup potential (${speedup.baselineMinutes}min → ${speedup.estimatedMinutesWithParallel}min)`,
        action: "Implement parallel execution to speed up test runs",
      });
    } else {
      recommendations.push({
        level: "medium",
        message: "Moderate parallelization benefit",
        reason: `${speedup.speedupFactor}x speedup possible`,
        action: "Consider parallel execution if test run time is a concern",
      });
    }

    if (partitions.length > 1 && partitions.length < 4) {
      recommendations.push({
        level: "info",
        message: `Only ${partitions.length} independent partitions detected`,
        reason: "Many tests are dependent, limiting parallelization",
        action: "Review test structure to increase independence",
      });
    }

    return recommendations;
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = ParallelExecutionPlanner;
}
