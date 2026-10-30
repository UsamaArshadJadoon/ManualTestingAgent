#!/usr/bin/env node
/**
 * aio-resilience-wrapper.js — QA AZM Digital Agent
 *
 * Wraps AIO API calls with resilience:
 * - Automatic retry on transient errors
 * - Non-blocking (failures don't stop pipeline)
 * - Rate limit handling
 * - Duplicate prevention (idempotent)
 * - Clear error messages
 *
 * Usage (in qa-test-sync):
 *   const { syncCaseToAioResilient } = require('./aio-resilience-wrapper.js');
 *   const result = await syncCaseToAioResilient(log, aioApi, caseData);
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { classify } = require("./error-classifier.js");

/**
 * Call AIO API with retries and error handling.
 * Non-blocking: errors are logged but don't throw.
 *
 * @param {Logger} log - Logger instance
 * @param {object} aioApi - AIO API client
 * @param {Function} apiCall - Function to call
 * @param {object} options - Configuration
 *   - maxRetries: max retries (default: 3)
 *   - blocking: throw on error (default: false, i.e., non-blocking)
 *   - context: error context
 * @returns {object} - API result or null on error
 */
async function callAioResilient(log, aioApi, apiCall, options = {}) {
  const { maxRetries = 3, blocking = false, context = "aio-api" } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`AIO API call (attempt ${attempt + 1})`, { context });
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Check for rate limiting (429)
      if (error.statusCode === 429) {
        const retryAfter = parseInt(error.headers?.["retry-after"] || "60", 10);
        log.warn("AIO rate limited", { retryAfter, attempt });
        await sleep(retryAfter * 1000);
        continue;
      }

      // Classify error
      const classified = classify(error, { context, attempt, statusCode: error.statusCode });

      const isLastAttempt = attempt === maxRetries;

      if (classified.shouldRetry && !isLastAttempt) {
        const delay = classified.nextBackoffMs;
        log.warn(`AIO call will retry`, { category: classified.category, delay, attempt });
        await sleep(delay);
      } else if (classified.shouldRetry && isLastAttempt) {
        const msg = `AIO call failed after ${maxRetries} retries: ${classified.guidance}`;
        if (blocking) throw new Error(msg);
        log.warn(msg);
        return null;
      } else {
        // Permanent error
        const msg = `AIO call failed: ${classified.guidance}`;
        if (blocking) throw new Error(msg);
        log.warn(msg);
        return null;
      }
    }
  }

  // Max retries exceeded
  if (blocking) throw lastError || new Error("AIO call failed");
  log.error(`AIO call failed after ${maxRetries} retries`);
  return null;
}

/**
 * Sync test case to AIO (idempotent).
 *
 * @param {Logger} log - Logger instance
 * @param {object} aioApi - AIO API client
 * @param {object} caseData - Case data to sync
 * @param {object} options - Configuration
 *   - syncLog: path to sync log (for idempotence)
 *   - maxRetries: max retries (default: 3)
 * @returns {object} - Sync result or null on error
 */
async function syncCaseToAioResilient(log, aioApi, caseData, options = {}) {
  const { syncLog = ".aio-sync.json", maxRetries = 3 } = options;

  if (!caseData.title) throw new Error("Case must have title");
  if (!caseData.folderId) throw new Error("Case must have folderId");

  // Generate idempotence key
  const idempotenceKey = crypto
    .createHash("sha256")
    .update(`${caseData.folderId}:${caseData.title}`)
    .digest("hex");

  // Check if already synced
  const syncRecord = loadSyncRecord(syncLog);
  if (syncRecord.synced[idempotenceKey]) {
    const existing = syncRecord.synced[idempotenceKey];
    log.debug(`Case already synced to AIO`, { title: caseData.title, aioKey: existing.aioKey });
    return existing;
  }

  try {
    const result = await callAioResilient(log, aioApi, () => aioApi.createTestCase(caseData), {
      maxRetries,
      blocking: false, // Non-blocking
      context: "aio-create-case",
    });

    if (result) {
      // Record sync
      syncRecord.synced[idempotenceKey] = {
        aioKey: result.id,
        title: caseData.title,
        synced_at: new Date().toISOString(),
      };
      saveSyncRecord(syncLog, syncRecord);

      log.info(`Case synced to AIO`, { title: caseData.title, aioKey: result.id });
    } else {
      log.warn(`Case sync to AIO failed`, { title: caseData.title });
      syncRecord.failed[idempotenceKey] = {
        title: caseData.title,
        attempt: new Date().toISOString(),
      };
      saveSyncRecord(syncLog, syncRecord);
    }

    return result;
  } catch (e) {
    log.error(`Case sync failed with error`, { title: caseData.title, error: e.message });
    return null;
  }
}

/**
 * Link case to Jira story in AIO.
 */
async function linkCaseToStoryResilient(log, aioApi, caseId, storyKey, options = {}) {
  const { maxRetries = 3 } = options;

  try {
    const result = await callAioResilient(
      log,
      aioApi,
      () => aioApi.linkCaseToJira(caseId, storyKey),
      { maxRetries, blocking: false, context: "aio-link-case" }
    );

    if (result) {
      log.info(`Case linked to story`, { caseId, storyKey });
    }

    return result;
  } catch (e) {
    // Non-blocking: log and continue
    log.warn(`Case linking failed`, { caseId, storyKey, error: e.message });
    return null;
  }
}

/**
 * Get case from AIO.
 */
async function getCaseResilient(log, aioApi, caseId, options = {}) {
  const { maxRetries = 2 } = options;

  return callAioResilient(log, aioApi, () => aioApi.getTestCase(caseId), {
    maxRetries,
    blocking: false,
    context: "aio-get-case",
  });
}

/**
 * Sync record management (for idempotence).
 */
function loadSyncRecord(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      // Ignore parse errors, start fresh
    }
  }

  return {
    timestamp: new Date().toISOString(),
    synced: {},
    failed: {},
  };
}

function saveSyncRecord(filePath, record) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
  } catch (e) {
    // Silently fail — sync record is best-effort
  }
}

/**
 * Check if AIO is accessible (health check).
 */
async function checkAioHealth(log, aioApi, projectKey) {
  try {
    await callAioResilient(log, aioApi, () => aioApi.getProject(projectKey), {
      maxRetries: 1,
      blocking: true,
      context: "aio-health",
    });
    log.info("AIO connectivity verified");
    return true;
  } catch (e) {
    log.error(`AIO unreachable`, { error: e.message });
    return false;
  }
}

/**
 * Sleep for N milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    callAioResilient,
    syncCaseToAioResilient,
    linkCaseToStoryResilient,
    getCaseResilient,
    checkAioHealth,
  };
}
