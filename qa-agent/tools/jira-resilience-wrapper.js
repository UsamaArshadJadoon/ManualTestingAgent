#!/usr/bin/env node
/**
 * jira-resilience-wrapper.js — QA AZM Digital Agent
 *
 * Wraps Jira API calls with resilience:
 * - Automatic retry on transient errors
 * - Auth failure detection + user prompt
 * - Rate limit handling (429) with exponential backoff
 * - Idempotent issue creation (transaction log)
 *
 * Usage (in qa-bug-logger):
 *   const { createIssueResilient } = require('./jira-resilience-wrapper.js');
 *   const result = await createIssueResilient(log, jiraApi, issueData, { maxRetries: 2 });
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { classify } = require("./error-classifier.js");

/**
 * Wrapper for Jira API calls with retries and error handling.
 *
 * @param {Logger} log - Logger instance
 * @param {object} jiraApi - Jira API client
 * @param {Function} apiCall - Function to call (e.g., () => jiraApi.createIssue(...))
 * @param {object} options - Configuration
 *   - maxRetries: max retry attempts (default: 2)
 *   - context: error context (default: 'jira-api')
 * @returns {object} - API result
 * @throws {Error} - If permanent error or auth needed
 */
async function callJiraResilient(log, jiraApi, apiCall, options = {}) {
  const { maxRetries = 2, context = "jira-api" } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`Jira API call (attempt ${attempt + 1})`, { context });
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Check for auth failure (needs user intervention)
      if (error.statusCode === 401 || error.message.includes("unauthorized")) {
        log.error("Jira auth failed", { error: error.message });
        throw new Error("JIRA_AUTH_FAILED: Check your credentials in .qa-secrets");
      }

      // Check for rate limiting
      if (error.statusCode === 429) {
        const retryAfter = parseInt(error.headers?.["retry-after"] || "60", 10);
        log.warn("Jira rate limited", { retryAfter, attempt });
        await sleep(retryAfter * 1000);
        continue;
      }

      // Classify other errors
      const classified = classify(error, { context, attempt, statusCode: error.statusCode });

      const isLastAttempt = attempt === maxRetries;

      if (classified.shouldRetry && !isLastAttempt) {
        const delay = classified.nextBackoffMs;
        log.warn(`Jira call will retry`, { category: classified.category, delay });
        await sleep(delay);
      } else if (classified.shouldRetry && isLastAttempt) {
        log.error(`Jira call failed after max retries`, {
          maxRetries,
          category: classified.category,
        });
        throw new Error(`Jira call failed after ${maxRetries} retries: ${classified.guidance}`);
      } else {
        log.error(`Jira call failed permanently`, { category: classified.category });
        throw error;
      }
    }
  }

  throw lastError || new Error("Jira API call failed without error details");
}

/**
 * Create Jira issue with idempotence (won't create duplicates).
 *
 * @param {Logger} log - Logger instance
 * @param {object} jiraApi - Jira API client
 * @param {object} issueData - Issue data (project, summary, description, etc.)
 * @param {object} options - Configuration
 *   - transactionLog: path to transaction log file (for idempotence)
 *   - maxRetries: max retries (default: 2)
 * @returns {object} - Created issue or null if duplicate
 */
async function createIssueResilient(log, jiraApi, issueData, options = {}) {
  const { transactionLog = ".jira-transactions.json", maxRetries = 2 } = options;

  if (!issueData.key) throw new Error("issueData must have a key for idempotence");

  // Check if already created
  const transaction = loadTransaction(transactionLog);
  if (transaction.created[issueData.key]) {
    log.debug(`Jira issue already created`, { key: issueData.key });
    return transaction.created[issueData.key];
  }

  try {
    // Create issue with retry
    const result = await callJiraResilient(log, jiraApi, () => jiraApi.createIssue(issueData), {
      maxRetries,
      context: "jira-create-issue",
    });

    // Record transaction
    transaction.created[issueData.key] = result;
    saveTransaction(transactionLog, transaction);

    log.info(`Jira issue created`, { key: issueData.key, issueId: result.id });
    return result;
  } catch (e) {
    log.error(`Jira issue creation failed`, { key: issueData.key, error: e.message });
    throw e;
  }
}

/**
 * Link issue to story.
 */
async function linkIssueResilient(log, jiraApi, linkData, options = {}) {
  const { maxRetries = 2 } = options;

  try {
    const result = await callJiraResilient(log, jiraApi, () => jiraApi.issueLink.create(linkData), {
      maxRetries,
      context: "jira-link-issue",
    });

    log.info(`Jira issue linked`, { from: linkData.inwardIssue.key, to: linkData.outwardIssue.key });
    return result;
  } catch (e) {
    log.warn(`Jira linking failed`, { error: e.message });
    // Don't throw — linking is best-effort
    return null;
  }
}

/**
 * Get issue by key.
 */
async function getIssueResilient(log, jiraApi, key, options = {}) {
  const { maxRetries = 2 } = options;

  try {
    return await callJiraResilient(log, jiraApi, () => jiraApi.getIssue(key), {
      maxRetries,
      context: "jira-get-issue",
    });
  } catch (e) {
    log.warn(`Could not fetch issue ${key}`, { error: e.message });
    return null;
  }
}

/**
 * Transaction log management (for idempotence).
 */
function loadTransaction(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      // Ignore parse errors, start fresh
    }
  }

  return {
    timestamp: new Date().toISOString(),
    created: {},
    failed: {},
  };
}

function saveTransaction(filePath, transaction) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(transaction, null, 2), "utf-8");
  } catch (e) {
    // Silently fail — transaction log is best-effort
  }
}

/**
 * Sleep for N milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if Jira is accessible (health check).
 */
async function checkJiraHealth(log, jiraApi) {
  try {
    await callJiraResilient(log, jiraApi, () => jiraApi.getCurrentUser(), { maxRetries: 1 });
    log.info("Jira connectivity verified");
    return true;
  } catch (e) {
    log.error(`Jira unreachable`, { error: e.message });
    return false;
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    callJiraResilient,
    createIssueResilient,
    linkIssueResilient,
    getIssueResilient,
    checkJiraHealth,
  };
}
