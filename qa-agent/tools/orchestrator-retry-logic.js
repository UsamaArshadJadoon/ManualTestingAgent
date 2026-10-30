#!/usr/bin/env node
/**
 * orchestrator-retry-logic.js — QA AZM Digital Agent
 *
 * Wraps agent dispatch with intelligent retry logic.
 * Uses error-classifier to decide: retry transient error or fail permanently.
 * Implements exponential backoff with jitter.
 *
 * Usage (in qa-run orchestrator):
 *   const { dispatchWithRetry } = require('./orchestrator-retry-logic.js');
 *   const result = await dispatchWithRetry(log, agentName, runFolder, maxRetries=3);
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const { classify, backoffDelay } = require("./error-classifier.js");

/**
 * Dispatch agent with automatic retry logic.
 * Retries transient errors; fails immediately on permanent errors.
 *
 * @param {Logger} log - Logger instance (from structured-logger.js)
 * @param {string} agentName - Name of agent to dispatch (e.g., 'qa-story')
 * @param {string} runFolder - Path to run folder
 * @param {object} options - Configuration
 *   - maxRetries: max retry attempts (default: 3)
 *   - context: error classification context (default: agent name)
 *   - Task: Task function to call (from Claude SDK)
 * @returns {object} - Agent result or throws error
 * @throws {Error} - If permanent error or max retries exceeded
 */
async function dispatchWithRetry(log, agentName, runFolder, options = {}) {
  const { maxRetries = 3, context = agentName, Task } = options;

  if (!agentName) throw new Error("agentName is required");
  if (!runFolder) throw new Error("runFolder is required");
  if (!Task) throw new Error("Task function is required (from Claude SDK)");

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Dispatching agent`, { agent: agentName, attempt, runFolder });

      const result = await Task(agentName, { runFolder });

      log.info(`Agent dispatch succeeded`, { agent: agentName, attempt });
      return result;
    } catch (error) {
      lastError = error;

      const classified = classify(error, {
        context: `agent-${agentName}`,
        attempt,
      });

      const isLastAttempt = attempt === maxRetries;

      if (classified.shouldRetry && !isLastAttempt) {
        const delay = classified.nextBackoffMs;
        log.warn(`Agent dispatch will retry`, {
          agent: agentName,
          attempt,
          category: classified.category,
          delay,
          reason: classified.guidance,
        });

        // Wait before retry
        await sleep(delay);
        // Continue to next iteration
      } else if (classified.shouldRetry && isLastAttempt) {
        // Max retries exceeded for transient error
        log.error(`Agent dispatch failed after max retries`, {
          agent: agentName,
          maxRetries,
          category: classified.category,
          reason: classified.guidance,
        });
        throw new Error(
          `${agentName} failed after ${maxRetries} retries (${classified.category}): ${classified.guidance}`
        );
      } else {
        // Permanent error - don't retry
        log.error(`Agent dispatch failed permanently`, {
          agent: agentName,
          category: classified.category,
          reason: classified.guidance,
          nextAction: classified.nextAction,
        });
        throw new Error(
          `${agentName} failed (${classified.category}): ${classified.guidance}\nNext: ${classified.nextAction}`
        );
      }
    }
  }

  // Should not reach here, but if we do, throw the last error
  throw lastError || new Error(`${agentName} dispatch failed without error details`);
}

/**
 * Sleep for N milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create retry configuration for orchestrator.
 * Returns object with retry settings for all agents.
 */
function createRetryConfig() {
  return {
    maxRetries: process.env.QA_MAX_RETRIES ? parseInt(process.env.QA_MAX_RETRIES) : 3,
    initialBackoffMs: process.env.QA_BACKOFF_MS ? parseInt(process.env.QA_BACKOFF_MS) : 1000,
    maxBackoffMs: 30000, // 30 second max
    agents: {
      "qa-story": { maxRetries: 3 },          // Fetching story, allow retries
      "qa-test-writer": { maxRetries: 2 },    // Writing tests, fewer retries
      "qa-gap-analyzer": { maxRetries: 2 },   // Analyzing gaps, fewer retries
      "qa-test-executor": { maxRetries: 2 },  // Browser operations, careful retries
      "qa-bug-logger": { maxRetries: 2 },     // Jira operations, fewer retries
      "qa-reviewer": { maxRetries: 1 },       // Final review, minimal retries
    },
  };
}

/**
 * Get retry config for specific agent.
 * Falls back to default if not found.
 */
function getAgentRetryConfig(agentName, defaultConfig) {
  return defaultConfig.agents[agentName] || { maxRetries: defaultConfig.maxRetries };
}

/**
 * Extract retry metrics from logs.
 * Calculates retry success rate and common failure reasons.
 */
function analyzeRetryMetrics(structuredLogs) {
  let totalDispatches = 0;
  let successDispatches = 0;
  let retryAttempts = 0;
  let retrySuccesses = 0;
  const failureReasons = {};

  for (const entry of structuredLogs) {
    if (entry.message === "Dispatching agent") {
      if (entry.attempt === 0) totalDispatches++;
    } else if (entry.message === "Agent dispatch succeeded" && entry.attempt > 0) {
      retrySuccesses++;
    } else if (entry.message === "Agent dispatch succeeded" && entry.attempt === 0) {
      successDispatches++;
    } else if (entry.message === "Agent dispatch will retry") {
      retryAttempts++;
    } else if (entry.message === "Agent dispatch failed permanently") {
      failureReasons[entry.category] = (failureReasons[entry.category] || 0) + 1;
    }
  }

  return {
    totalDispatches,
    successFirstTry: successDispatches,
    successAfterRetry: retrySuccesses,
    retryAttempts,
    retrySuccessRate: retryAttempts > 0 ? (retrySuccesses / retryAttempts) * 100 : 0,
    failureReasons,
  };
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    dispatchWithRetry,
    createRetryConfig,
    getAgentRetryConfig,
    analyzeRetryMetrics,
  };
}
