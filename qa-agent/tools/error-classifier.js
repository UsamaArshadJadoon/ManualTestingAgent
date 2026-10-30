#!/usr/bin/env node
/**
 * error-classifier.js — QA AZM Digital Agent
 *
 * Categorizes errors as transient (retry-worthy) vs permanent (fail-fast).
 * Provides context-specific guidance for users.
 *
 * Usage (from Node scripts):
 *   const { classify } = require('./error-classifier.js');
 *
 *   const result = classify(error, { context: 'jira-filing', attempt: 1 });
 *   if (result.transient) {
 *     // Retry with backoff
 *   } else {
 *     // Stop and report to user
 *   }
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const ERROR_CATEGORIES = {
  // Transient errors (safe to retry)
  NETWORK_TIMEOUT: { transient: true, retryable: true, maxRetries: 3, backoffMs: 1000 },
  NETWORK_ERROR: { transient: true, retryable: true, maxRetries: 3, backoffMs: 1000 },
  SERVICE_UNAVAILABLE: { transient: true, retryable: true, maxRetries: 5, backoffMs: 2000 },
  RATE_LIMITED: { transient: true, retryable: true, maxRetries: 5, backoffMs: 5000 },
  TEMPORARY_FAILURE: { transient: true, retryable: true, maxRetries: 3, backoffMs: 1000 },
  BROWSER_CRASH: { transient: true, retryable: true, maxRetries: 2, backoffMs: 3000 },
  RESOURCE_EXHAUSTED: { transient: true, retryable: true, maxRetries: 2, backoffMs: 5000 },

  // Permanent errors (don't retry)
  AUTHENTICATION_FAILED: { transient: false, retryable: false },
  AUTHORIZATION_FAILED: { transient: false, retryable: false },
  INVALID_INPUT: { transient: false, retryable: false },
  NOT_FOUND: { transient: false, retryable: false },
  CONFIGURATION_ERROR: { transient: false, retryable: false },
  DATA_CORRUPTION: { transient: false, retryable: false },
  UNSUPPORTED_OPERATION: { transient: false, retryable: false },
};

/**
 * Classify an error and provide retry guidance.
 *
 * @param {Error|string} error - The error to classify
 * @param {object} options - Context options
 *   - context: 'playwright' | 'jira' | 'aio' | 'config' | 'file-io' | 'general'
 *   - attempt: current retry attempt number (0-based)
 *   - statusCode: HTTP status code (if applicable)
 *   - errorCode: Node error code like 'ECONNREFUSED', 'ETIMEDOUT' (if applicable)
 * @returns {object} - { category, transient, retryable, maxRetries, backoffMs, guidance, nextAction }
 */
function classify(error, options = {}) {
  const { context = "general", attempt = 0, statusCode = null, errorCode = null } = options;

  const message = (error && error.message) ? error.message.toLowerCase() : String(error).toLowerCase();
  const stack = (error && error.stack) ? error.stack : "";

  let category = null;
  let guidance = "";
  let nextAction = "";

  // HTTP status code classification
  if (statusCode) {
    if (statusCode === 401) {
      category = "AUTHENTICATION_FAILED";
      guidance = "Your credentials are invalid or have expired. Check your token/password in .qa-secrets.";
      nextAction = "Provide fresh credentials and retry.";
    } else if (statusCode === 403) {
      category = "AUTHORIZATION_FAILED";
      guidance = "You lack permissions for this action. Check your account roles in Jira/AIO.";
      nextAction = "Contact administrator to grant permissions.";
    } else if (statusCode === 404) {
      category = "NOT_FOUND";
      guidance = `The resource does not exist on the server (HTTP 404).`;
      nextAction = "Verify the resource exists and the URL is correct.";
    } else if (statusCode === 429) {
      category = "RATE_LIMITED";
      guidance = "The API rate limit has been exceeded. Waiting before retry.";
      nextAction = "Retry after backoff period.";
    } else if (statusCode >= 500) {
      category = "SERVICE_UNAVAILABLE";
      guidance = `The service returned a server error (HTTP ${statusCode}). This is temporary.`;
      nextAction = "Retry after a short delay.";
    }
  }

  // Node error code classification
  if (!category && errorCode) {
    if (errorCode === "ECONNREFUSED") {
      category = "NETWORK_ERROR";
      guidance = "Connection refused. The service may be offline or not listening on that port.";
      nextAction = "Verify the service is running and accessible.";
    } else if (errorCode === "ETIMEDOUT") {
      category = "NETWORK_TIMEOUT";
      guidance = "Connection timed out. The network may be slow or the service unresponsive.";
      nextAction = "Retry; if persistent, check network connectivity.";
    } else if (errorCode === "ENOTFOUND") {
      category = "NETWORK_ERROR";
      guidance = `DNS resolution failed. Check the hostname is correct and network is available.`;
      nextAction = "Verify hostname and network connectivity.";
    } else if (errorCode === "EMFILE") {
      category = "RESOURCE_EXHAUSTED";
      guidance = "Too many open files. The system has run out of file descriptors.";
      nextAction = "Close some processes and retry.";
    }
  }

  // Message pattern classification
  if (!category) {
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("took too long")
    ) {
      category = "NETWORK_TIMEOUT";
      guidance = "The operation took too long to complete. Network or server may be slow.";
      nextAction = "Retry with longer timeout if possible.";
    } else if (
      message.includes("connection") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    ) {
      category = "NETWORK_ERROR";
      guidance = "Network communication failed. Check connectivity and server availability.";
      nextAction = "Verify network and retry.";
    } else if (
      message.includes("401") ||
      message.includes("authentication") ||
      message.includes("unauthorized") ||
      message.includes("invalid token") ||
      message.includes("invalid credentials")
    ) {
      category = "AUTHENTICATION_FAILED";
      guidance = "Authentication failed. Check your credentials.";
      nextAction = "Provide fresh credentials.";
    } else if (
      message.includes("403") ||
      message.includes("forbidden") ||
      message.includes("access denied") ||
      message.includes("permission")
    ) {
      category = "AUTHORIZATION_FAILED";
      guidance = "You lack permissions for this operation.";
      nextAction = "Contact administrator for access.";
    } else if (
      message.includes("404") ||
      message.includes("not found")
    ) {
      category = "NOT_FOUND";
      guidance = "The resource does not exist.";
      nextAction = "Verify the resource exists.";
    } else if (
      message.includes("json") ||
      message.includes("parse") ||
      message.includes("syntax")
    ) {
      if (message.includes("parse") || message.includes("syntax")) {
        category = "DATA_CORRUPTION";
        guidance = "JSON data is malformed. A file may be corrupted.";
        nextAction = "Check the file and restore from backup if available.";
      }
    } else if (
      message.includes("browser") ||
      message.includes("crashed") ||
      message.includes("playwright")
    ) {
      category = "BROWSER_CRASH";
      guidance = "The browser process crashed. This can happen under high load.";
      nextAction = "Retry; the framework will restart the browser.";
    } else if (
      message.includes("memory") ||
      message.includes("oom") ||
      message.includes("out of memory")
    ) {
      category = "RESOURCE_EXHAUSTED";
      guidance = "Out of memory. Close other applications or reduce batch size.";
      nextAction = "Free memory and retry.";
    } else if (
      message.includes("invalid") ||
      message.includes("bad") ||
      message.includes("malformed") ||
      message.includes("schema")
    ) {
      category = "INVALID_INPUT";
      guidance = "The input data is malformed or invalid.";
      nextAction = "Fix the input data.";
    } else if (
      message.includes("config") ||
      message.includes("configuration")
    ) {
      category = "CONFIGURATION_ERROR";
      guidance = "There is a configuration problem.";
      nextAction = "Check .qa-config.json and fix any errors.";
    }
  }

  // Fallback classification
  if (!category) {
    category = "TEMPORARY_FAILURE";
    guidance = `An unexpected error occurred: ${message || "unknown"}`;
    nextAction = "Review the error message and retry if it seems transient.";
  }

  const categoryInfo = ERROR_CATEGORIES[category] || { transient: false, retryable: false };

  return {
    category,
    transient: categoryInfo.transient,
    retryable: categoryInfo.retryable,
    maxRetries: categoryInfo.maxRetries || 0,
    backoffMs: categoryInfo.backoffMs || 0,
    shouldRetry: categoryInfo.retryable && attempt < (categoryInfo.maxRetries || 0),
    guidance,
    nextAction,
    nextBackoffMs: categoryInfo.backoffMs ? categoryInfo.backoffMs * Math.pow(2, attempt) : 0,
  };
}

/**
 * Calculate exponential backoff with jitter.
 * Prevents thundering herd when multiple retries happen.
 */
function backoffDelay(attempt, baseMs = 1000, maxMs = 30000) {
  const exponential = baseMs * Math.pow(2, Math.min(attempt, 5));
  const jitter = Math.random() * exponential * 0.1;  // Add ±10% jitter
  return Math.min(exponential + jitter, maxMs);
}

/**
 * Format error for logging and reporting.
 */
function formatError(error, context = "") {
  const classified = classify(error, { context });
  const contextStr = context ? ` [${context}]` : "";

  return {
    category: classified.category,
    message: error && error.message ? error.message : String(error),
    guidance: classified.guidance,
    nextAction: classified.nextAction,
    shouldRetry: classified.shouldRetry,
    nextBackoffMs: classified.nextBackoffMs,
    displayMessage: `${classified.category}${contextStr}: ${classified.guidance}`,
  };
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { classify, backoffDelay, formatError, ERROR_CATEGORIES };
}
