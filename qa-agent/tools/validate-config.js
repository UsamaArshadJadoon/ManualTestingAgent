#!/usr/bin/env node
/**
 * validate-config.js — QA AZM Digital Agent
 *
 * Validates .qa-config.json against schema with detailed error messages.
 * Reports all issues, not just the first one, so users can fix everything at once.
 *
 * Usage:
 *   node validate-config.js [<config-path>]
 *
 * Exit codes:
 *   0 = valid
 *   1 = invalid config
 *   2 = file not found
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

// ---- config validation schema ----

const SCHEMA = {
  jira: {
    type: "object",
    required: true,
    fields: {
      projectKey: { type: "string", required: true, pattern: /^[A-Z][A-Z0-9]*$/, minLength: 1, maxLength: 10 },
      defaultBugType: { type: "string", required: false, default: "Bug" },
      defaultBugPriority: { type: "string", required: false, default: "High" },
    },
  },
  app: {
    type: "object",
    required: true,
    fields: {
      baseUrl: { type: "string", required: true, isUrl: true },
      login: {
        type: "object",
        required: false,
        fields: {
          userField: { type: "string", required: false },
          passField: { type: "string", required: false },
          submitButton: { type: "string", required: false },
          notes: { type: "string", required: false, maxLength: 500 },
        },
      },
    },
  },
  safety: {
    type: "object",
    required: false,
    fields: {
      allowProduction: { type: "boolean", required: false, default: false },
      prodUrlPatterns: { type: "array", required: false, itemType: "string" },
      maskPatterns: { type: "array", required: false, itemType: "string", validate: "regex" },
      destructiveActions: { type: "boolean", required: false, default: false },
      cleanupCreatedData: { type: "boolean", required: false, default: true },
    },
  },
  severityMap: {
    type: "object",
    required: false,
    description: "Map of severity levels to Jira issue severity names",
  },
  aio: {
    type: "object",
    required: false,
    fields: {
      enabled: { type: "boolean", required: false, default: false },
      baseUrl: { type: "string", required: false, isUrl: true },
      projectKey: { type: "string", required: false, pattern: /^[A-Z][A-Z0-9]*$/ },
      tokenEnv: { type: "string", required: false, default: "AIO_TOKEN" },
      scriptTypeId: { type: "number", required: false, min: 1 },
    },
  },
  execution: {
    type: "object",
    required: false,
    fields: {
      maxRunMinutes: { type: "number", required: false, default: 60, min: 5, max: 1440 },
      headless: { type: "boolean", required: false, default: true },
      slowMo: { type: "number", required: false, default: 0, min: 0 },
    },
  },
  outputDir: {
    type: "string",
    required: false,
    default: "qa-runs",
    description: "Directory for run outputs (relative to project root)",
  },
};

// ---- validation functions ----

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

function validateValue(fieldName, value, schema, path = "") {
  const errors = [];
  const fullPath = path ? `${path}.${fieldName}` : fieldName;

  if (value === undefined || value === null) {
    if (schema.required) {
      errors.push(`  ✗ ${fullPath} is required but missing`);
    }
    return errors;
  }

  // Type checking
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (schema.type && actualType !== schema.type) {
    errors.push(`  ✗ ${fullPath} must be ${schema.type}, got ${actualType}`);
    return errors;
  }

  // String validations
  if (schema.type === "string") {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`  ✗ ${fullPath} must be at least ${schema.minLength} characters`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`  ✗ ${fullPath} must be at most ${schema.maxLength} characters`);
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push(`  ✗ ${fullPath} format invalid (expected pattern: ${schema.pattern})`);
    }
    if (schema.isUrl && !isValidUrl(value)) {
      errors.push(`  ✗ ${fullPath} must be a valid HTTP(S) URL, got: ${value}`);
    }
  }

  // Number validations
  if (schema.type === "number") {
    if (schema.min !== undefined && value < schema.min) {
      errors.push(`  ✗ ${fullPath} must be >= ${schema.min}, got ${value}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push(`  ✗ ${fullPath} must be <= ${schema.max}, got ${value}`);
    }
  }

  // Array validations
  if (schema.type === "array") {
    if (schema.itemType === "string") {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== "string") {
          errors.push(`  ✗ ${fullPath}[${i}] must be string, got ${typeof value[i]}`);
        }
      }
    }
    if (schema.validate === "regex") {
      for (let i = 0; i < value.length; i++) {
        try {
          const pattern = value[i].startsWith("(?i)") ? value[i].slice(4) : value[i];
          const flags = value[i].startsWith("(?i)") ? "i" : "";
          new RegExp(pattern, flags);
        } catch (e) {
          errors.push(`  ✗ ${fullPath}[${i}] is not a valid regex: ${e.message}`);
        }
      }
    }
  }

  // Object validations
  if (schema.type === "object" && schema.fields) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const fieldErrors = validateValue(fieldName, value[fieldName], fieldSchema, fullPath);
      errors.push(...fieldErrors);
    }
  }

  return errors;
}

function validateConfig(config) {
  const errors = [];

  // Top-level validations
  for (const [fieldName, fieldSchema] of Object.entries(SCHEMA)) {
    const fieldErrors = validateValue(fieldName, config[fieldName], fieldSchema);
    errors.push(...fieldErrors);
  }

  // Cross-field validations
  if (config.aio && config.aio.enabled) {
    if (!config.aio.projectKey) {
      errors.push(`  ✗ aio.projectKey is required when aio.enabled is true`);
    }
    if (!config.jira || !config.jira.projectKey) {
      errors.push(`  ✗ jira.projectKey is required when aio.enabled is true`);
    }
  }

  if (config.safety && config.safety.prodUrlPatterns && Array.isArray(config.safety.prodUrlPatterns)) {
    for (let i = 0; i < config.safety.prodUrlPatterns.length; i++) {
      try {
        new RegExp(config.safety.prodUrlPatterns[i]);
      } catch (e) {
        errors.push(`  ✗ safety.prodUrlPatterns[${i}] is not a valid regex: ${e.message}`);
      }
    }
  }

  return errors;
}

// ---- main ----

const configPath = process.argv[2] || ".qa-config.json";
const resolvedPath = path.resolve(configPath);

if (!fs.existsSync(resolvedPath)) {
  die(`validate-config: config file not found: ${resolvedPath}`, 2);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
} catch (e) {
  die(`validate-config: ${resolvedPath} is not valid JSON\n  ${e.message}`, 1);
}

const errors = validateConfig(config);

if (errors.length === 0) {
  console.log(`✓ ${resolvedPath} is valid`);
  process.exit(0);
} else {
  console.error(`✗ ${resolvedPath} has ${errors.length} validation error(s):\n`);
  console.error(errors.join("\n"));
  console.error(`\nFix these issues and re-run to continue.`);
  process.exit(1);
}
