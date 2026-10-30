#!/usr/bin/env node
/**
 * orchestrator-wrapper.js — QA AZM Digital Agent
 *
 * Wraps agent dispatches with Phase 1-2 robustness tools:
 * - Structured logging (replaces console.log)
 * - Atomic file writes (validates JSON, creates backups)
 * - Error classification (transient vs permanent)
 * - Automatic retry with exponential backoff
 *
 * Usage:
 *   const wrapper = require('./orchestrator-wrapper.js');
 *   const result = await wrapper.dispatchAgent(agentName, runFolder, options);
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { atomicWrite, readJsonSafe } = require("./tools/atomic-write.js");
const Logger = require("./tools/structured-logger.js");
const { classify, backoffDelay, formatError } = require("./tools/error-classifier.js");

/**
 * Dispatch an agent with automatic retry, error classification, and structured logging.
 *
 * @param {string} agentName - Name of the agent (qa-story, qa-test-writer, etc)
 * @param {string} runFolder - Path to the run folder
 * @param {object} options - Configuration
 *   - maxRetries: max retry attempts (default: 3)
 *   - context: error context string (e.g. 'agent-qa-story')
 *   - logger: Logger instance (default: creates new one)
 *   - taskFunc: function to dispatch the agent (for testing)
 * @returns {Promise<object>} - { success: true, output: {...} } or throws error
 */
async function dispatchAgent(agentName, runFolder, options = {}) {
  const {
    maxRetries = 3,
    context = `agent-${agentName}`,
    logger: incomingLogger = null,
    taskFunc = null,
  } = options;

  // Initialize logger if not provided
  const log = incomingLogger || new Logger(agentName, {
    logDir: path.join(runFolder, "logs"),
    level: process.env.QA_LOG_LEVEL || "INFO",
  });

  const startTime = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Agent dispatch starting`, {
        agent: agentName,
        runFolder,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
      });

      // Simulate or invoke the actual agent dispatch
      // In a real implementation, this would use Claude's Task tool
      // For now, we demonstrate the pattern:
      if (taskFunc) {
        var result = await taskFunc(agentName, runFolder);
      } else {
        // Placeholder: would call Claude's Task tool here
        result = { success: true, agent: agentName };
      }

      log.info(`Agent dispatch succeeded`, {
        agent: agentName,
        attempt: attempt + 1,
        duration: Date.now() - startTime,
      });

      return { success: true, output: result };
    } catch (error) {
      lastError = error;

      // Classify the error to determine if we should retry
      const classified = classify(error, { context, attempt, statusCode: error.statusCode });

      log.warn(`Agent dispatch failed`, {
        agent: agentName,
        attempt: attempt + 1,
        category: classified.category,
        transient: classified.transient,
        guidance: classified.guidance,
      });

      // If it's a permanent error or we've exhausted retries, throw
      if (!classified.transient || attempt >= maxRetries) {
        const formatted = formatError(error, context);
        log.error(`Agent dispatch failed permanently`, {
          agent: agentName,
          category: formatted.category,
          message: formatted.displayMessage,
        });
        throw error;
      }

      // Calculate backoff delay and retry
      const delayMs = backoffDelay(attempt);
      log.info(`Retrying after backoff`, {
        agent: agentName,
        nextAttempt: attempt + 2,
        delayMs,
        nextBackoffMs: classified.nextBackoffMs,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Exhausted retries
  throw lastError || new Error(`Failed to dispatch ${agentName} after ${maxRetries} retries`);
}

/**
 * Safe JSON file write with validation, backup, and logging.
 *
 * @param {string} filePath - Target file path
 * @param {object} jsonData - Data to write
 * @param {object} options - Write options
 *   - logger: Logger instance (required for logging)
 *   - backups: number of backups to keep (default: 3)
 *   - validate: validate JSON (default: true)
 * @returns {Promise<object>} - { path, size, hash, backupPath, timestamp }
 */
async function writeJsonSafe(filePath, jsonData, options = {}) {
  const { logger = null, backups = 3, validate = true } = options;

  if (!logger) {
    throw new Error("logger is required for writeJsonSafe");
  }

  const operation = path.basename(filePath);

  try {
    logger.debug(`Writing JSON file`, { file: operation, size: JSON.stringify(jsonData).length });

    const result = await atomicWrite(filePath, jsonData, {
      backups,
      validate,
      indent: 2,
    });

    logger.info(`JSON file written successfully`, {
      file: operation,
      size: result.size,
      hash: result.hash.substring(0, 8),
      backup: result.backupPath ? "created" : "none",
    });

    return result;
  } catch (error) {
    const classified = classify(error, { context: "file-io" });
    logger.error(`JSON file write failed`, {
      file: operation,
      error: error.message,
      category: classified.category,
      guidance: classified.guidance,
    });
    throw error;
  }
}

/**
 * Safe JSON file read with automatic backup restoration on corruption.
 *
 * @param {string} filePath - File path to read
 * @param {object} options - Read options
 *   - logger: Logger instance (optional)
 * @returns {Promise<object>} - Parsed JSON data
 */
async function readJsonSafeAsync(filePath, options = {}) {
  const { logger = null } = options;

  const filename = path.basename(filePath);

  try {
    logger?.debug(`Reading JSON file`, { file: filename });

    const result = readJsonSafe(filePath);

    logger?.info(`JSON file read successfully`, {
      file: filename,
      source: result.source,
    });

    return result.data;
  } catch (error) {
    const classified = classify(error, { context: "file-io" });
    logger?.error(`JSON file read failed`, {
      file: filename,
      error: error.message,
      category: classified.category,
      guidance: classified.guidance,
    });
    throw error;
  }
}

/**
 * Setup logging and health checks at orchestrator startup.
 *
 * @param {string} runFolder - Run folder path
 * @param {object} options - Setup options
 *   - logLevel: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
 *   - correlationId: unique ID for this run
 * @returns {Logger} - Initialized logger
 */
function setupOrchestrator(runFolder, options = {}) {
  const { logLevel = "INFO", correlationId = `run-${Date.now()}` } = options;

  // Ensure log directory exists
  const logDir = path.join(runFolder, "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
  }

  const log = new Logger("qa-orchestrator", {
    logDir,
    level: logLevel,
    correlationId,
    context: {
      runFolder,
      startTime: new Date().toISOString(),
    },
  });

  log.info("Orchestrator initialized", {
    runFolder,
    correlationId,
    nodeVersion: process.version,
    platform: process.platform,
  });

  return log;
}

/**
 * Cleanup resources on orchestrator exit.
 *
 * @param {Logger} log - Logger instance
 * @param {string} runFolder - Run folder path
 * @param {object} options - Cleanup options
 *   - timeout: cleanup timeout in ms (default: 30000)
 * @returns {Promise<object>} - Cleanup summary
 */
async function cleanupOnExit(log, runFolder, options = {}) {
  const { timeout = 30000 } = options;

  log.info("Cleanup starting", { runFolder });

  try {
    // Placeholder: real implementation would kill processes, delete temp files
    // For now, just log the cleanup intent
    const summary = {
      timestamp: new Date().toISOString(),
      runFolder,
      cleaned: [],
    };

    log.info("Cleanup complete", summary);
    return summary;
  } catch (error) {
    log.error("Cleanup failed", { error: error.message });
    throw error;
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    dispatchAgent,
    writeJsonSafe,
    readJsonSafeAsync,
    setupOrchestrator,
    cleanupOnExit,
  };
}
