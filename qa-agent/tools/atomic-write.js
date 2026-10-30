#!/usr/bin/env node
/**
 * atomic-write.js — QA AZM Digital Agent
 *
 * Atomic file writes: write to temp file, validate JSON, then atomic rename.
 * Prevents corruption if process crashes mid-write.
 * Also maintains backup versions for recovery.
 *
 * Usage (from Node scripts):
 *   const atomicWrite = require('./atomic-write.js');
 *   await atomicWrite(filePath, dataObj, { backups: 3, validate: true });
 *
 * Developed by Usama Arshad Jadoon · QC Lead · AZM Digital
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class AtomicWriteError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = "AtomicWriteError";
    this.originalError = originalError;
  }
}

/**
 * Write JSON data to file atomically.
 *
 * @param {string} filePath - Target file path (absolute or relative)
 * @param {object} data - Data object to write as JSON
 * @param {object} options - Configuration options
 *   - backups: number of previous versions to keep (default: 3)
 *   - validate: validate JSON after write (default: true)
 *   - backup: create backup before write (default: true)
 *   - indent: JSON indent (default: 2)
 * @returns {object} - { path, size, hash, backupPath }
 * @throws {AtomicWriteError}
 */
async function atomicWrite(filePath, data, options = {}) {
  const {
    backups = 3,
    validate = true,
    backup = true,
    indent = 2,
  } = options;

  if (!filePath) throw new AtomicWriteError("filePath is required");
  if (data === null || data === undefined) throw new AtomicWriteError("data cannot be null or undefined");

  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);
  const filename = path.basename(resolvedPath);
  const tempPath = path.join(dir, `.${filename}.tmp.${process.pid}.${Date.now()}`);
  const backupPath = backup && fs.existsSync(resolvedPath)
    ? path.join(dir, `.${filename}.backup`)
    : null;

  try {
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }

    // Serialize JSON
    let jsonStr;
    try {
      jsonStr = JSON.stringify(data, null, indent);
    } catch (e) {
      throw new AtomicWriteError(`Data is not JSON-serializable: ${e.message}`, e);
    }

    // Validate JSON before writing (catch issues early)
    if (validate) {
      try {
        JSON.parse(jsonStr);
      } catch (e) {
        throw new AtomicWriteError(`Generated JSON is invalid: ${e.message}`, e);
      }
    }

    // Write to temp file
    try {
      fs.writeFileSync(tempPath, jsonStr, "utf8");
    } catch (e) {
      throw new AtomicWriteError(`Failed to write temp file ${tempPath}: ${e.message}`, e);
    }

    // Validate temp file if requested
    if (validate) {
      try {
        const tempContent = fs.readFileSync(tempPath, "utf8");
        JSON.parse(tempContent);
      } catch (e) {
        fs.unlinkSync(tempPath);  // Clean up temp file
        throw new AtomicWriteError(`Temp file validation failed: ${e.message}`, e);
      }
    }

    // Create backup of current file (before overwriting)
    let backupPathUsed = null;
    if (backupPath && fs.existsSync(resolvedPath)) {
      try {
        fs.copyFileSync(resolvedPath, backupPath);
        backupPathUsed = backupPath;
      } catch (e) {
        // Backup failure is not fatal, but warn
        console.warn(`Warning: backup creation failed: ${e.message}`);
      }
    }

    // Atomic rename: temp file → target file
    try {
      fs.renameSync(tempPath, resolvedPath);
    } catch (e) {
      // Cleanup on rename failure
      try { fs.unlinkSync(tempPath); } catch (_) {}
      throw new AtomicWriteError(`Failed to rename temp file to ${resolvedPath}: ${e.message}`, e);
    }

    // Calculate hash for integrity verification
    const content = fs.readFileSync(resolvedPath, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const size = Buffer.byteLength(content, "utf8");

    // Cleanup old backups (keep only N most recent)
    if (backup && backups > 0) {
      cleanupOldBackups(dir, filename, backups);
    }

    return {
      path: resolvedPath,
      size,
      hash,
      backupPath: backupPathUsed,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    // Cleanup on any failure
    try { fs.unlinkSync(tempPath); } catch (_) {}
    if (e instanceof AtomicWriteError) throw e;
    throw new AtomicWriteError(`Atomic write failed: ${e.message}`, e);
  }
}

/**
 * Remove old backup files, keeping only the N most recent.
 * Backup filenames: `.filename.backup.1`, `.filename.backup.2`, etc.
 */
function cleanupOldBackups(dir, filename, keepCount) {
  const backupPattern = `.${filename}.backup`;
  try {
    const files = fs.readdirSync(dir);
    const backups = files
      .filter(f => f.startsWith(backupPattern))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);  // Newest first

    // Delete files beyond the keep count
    for (let i = keepCount; i < backups.length; i++) {
      try {
        fs.unlinkSync(backups[i].path);
      } catch (e) {
        console.warn(`Warning: failed to delete old backup ${backups[i].name}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`Warning: backup cleanup failed: ${e.message}`);
  }
}

/**
 * Read and validate JSON file.
 * If current file is corrupted, attempt to restore from backup.
 */
function readJsonSafe(filePath) {
  const resolvedPath = path.resolve(filePath);

  try {
    const content = fs.readFileSync(resolvedPath, "utf8");
    return { data: JSON.parse(content), source: "current" };
  } catch (e) {
    console.warn(`Warning: current file unreadable: ${e.message}`);

    // Try to restore from backup
    const dir = path.dirname(resolvedPath);
    const filename = path.basename(resolvedPath);
    const backupPath = path.join(dir, `.${filename}.backup`);

    if (fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, "utf8");
        const data = JSON.parse(backupContent);
        console.warn(`Restored from backup: ${backupPath}`);
        return { data, source: "backup" };
      } catch (backupError) {
        throw new AtomicWriteError(`Backup also corrupted: ${backupError.message}`, backupError);
      }
    }

    throw new AtomicWriteError(`File corrupted and no backup available: ${e.message}`, e);
  }
}

// ---- export for use in Node scripts ----
if (typeof module !== "undefined" && module.exports) {
  module.exports = { atomicWrite, readJsonSafe, AtomicWriteError };
}
