#!/usr/bin/env node
/**
 * structured-logger.js — QA AZM Digital Agent
 *
 * Structured logging with JSON output, log levels, context tracking, and rotation.
 * Logs to both stdout and rotating log files.
 *
 * Usage (from Node scripts):
 *   const Logger = require('./structured-logger.js');
 *   const log = new Logger('agent-name', { logDir: './logs', level: 'INFO' });
 *
 *   log.info('test started', { caseId: 'TC1', url: '/checkout' });
 *   log.warn('retrying', { attempt: 2, reason: 'timeout' });
 *   log.error('test failed', { error: e, duration: 5000 });
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
};

class StructuredLogger {
  constructor(name, options = {}) {
    this.name = name;
    this.level = LOG_LEVELS[options.level || "INFO"] || LOG_LEVELS.INFO;
    this.logDir = options.logDir || "./logs";
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024;  // 10MB
    this.maxLogs = options.maxLogs || 5;  // Keep 5 log files
    this.useColors = options.useColors !== false && process.stdout.isTTY;
    this.correlationId = options.correlationId || this.generateId(8);
    this.context = options.context || {};

    this.ensureLogDir();
    this.logFile = path.join(this.logDir, `${name}-${Date.now()}.log`);
  }

  generateId(length) {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true, mode: 0o755 });
    }
  }

  getColorCode(level) {
    if (!this.useColors) return "";
    const colors = {
      [LOG_LEVELS.TRACE]: "\x1b[90m",   // Dark gray
      [LOG_LEVELS.DEBUG]: "\x1b[36m",   // Cyan
      [LOG_LEVELS.INFO]: "\x1b[32m",    // Green
      [LOG_LEVELS.WARN]: "\x1b[33m",    // Yellow
      [LOG_LEVELS.ERROR]: "\x1b[31m",   // Red
    };
    return colors[level] || "";
  }

  getLevelName(level) {
    return Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || "UNKNOWN";
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const levelName = this.getLevelName(level);

    const logEntry = {
      timestamp,
      level: levelName,
      logger: this.name,
      correlationId: this.correlationId,
      message,
      ...this.context,
      ...metadata,
    };

    return logEntry;
  }

  writeLog(logEntry) {
    const jsonLine = JSON.stringify(logEntry);

    // Write to file (with rotation)
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.logFile, jsonLine + "\n", "utf8");
    } catch (e) {
      // Silent fail for file write (don't break the application)
      console.error(`Log write failed: ${e.message}`);
    }

    // Write to stdout (with colors)
    if (this.useColors) {
      const color = this.getColorCode(logEntry.level);
      const reset = "\x1b[0m";
      console.log(
        `${color}[${logEntry.timestamp}] [${logEntry.level}] ${logEntry.message}${reset}`,
        logEntry.metadata ? JSON.stringify(logEntry.metadata) : ""
      );
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  rotateIfNeeded() {
    if (!fs.existsSync(this.logFile)) return;

    const stat = fs.statSync(this.logFile);
    if (stat.size > this.maxLogSize) {
      const base = this.logFile.replace(/\.log$/, "");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const newPath = `${base}-${timestamp}.log`;
      fs.renameSync(this.logFile, newPath);

      // Clean up old logs
      this.cleanupOldLogs();
    }
  }

  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(this.name) && f.endsWith(".log"))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (let i = this.maxLogs; i < files.length; i++) {
        fs.unlinkSync(files[i].path);
      }
    } catch (e) {
      // Silent fail
    }
  }

  // Log level methods
  trace(message, metadata) {
    if (this.level <= LOG_LEVELS.TRACE) {
      this.writeLog(this.formatMessage(LOG_LEVELS.TRACE, message, metadata));
    }
  }

  debug(message, metadata) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      this.writeLog(this.formatMessage(LOG_LEVELS.DEBUG, message, metadata));
    }
  }

  info(message, metadata) {
    if (this.level <= LOG_LEVELS.INFO) {
      this.writeLog(this.formatMessage(LOG_LEVELS.INFO, message, metadata));
    }
  }

  warn(message, metadata) {
    if (this.level <= LOG_LEVELS.WARN) {
      this.writeLog(this.formatMessage(LOG_LEVELS.WARN, message, metadata));
    }
  }

  error(message, metadata) {
    if (this.level <= LOG_LEVELS.ERROR) {
      this.writeLog(this.formatMessage(LOG_LEVELS.ERROR, message, metadata));
    }
  }

  // API call logging with automatic timing
  logApiCall(method, url, startTime, status, responseTime, error = null) {
    const duration = Date.now() - startTime;
    const level = status === 0 ? LOG_LEVELS.ERROR : (status >= 500 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO);

    this.writeLog(this.formatMessage(level, `API ${method} ${url}`, {
      method,
      url,
      status,
      duration,
      error: error ? error.message : undefined,
    }));
  }

  // File operation logging
  logFileOp(operation, filePath, size = 0, error = null) {
    const level = error ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;
    this.writeLog(this.formatMessage(level, `File ${operation}: ${path.basename(filePath)}`, {
      operation,
      path: filePath,
      size,
      error: error ? error.message : undefined,
    }));
  }

  // Timing measurements
  time(label) {
    return {
      start: Date.now(),
      label,
      end: () => {
        const duration = Date.now() - this.time.start;
        this.debug(`Timing: ${this.label}`, { duration });
        return duration;
      },
    };
  }

  // Set or update context for all future logs
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  // Get current log file path
  getLogFile() {
    return this.logFile;
  }
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = StructuredLogger;
}
