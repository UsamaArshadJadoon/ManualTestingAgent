/**
 * Test Utilities - Common functions for all integration tests
 */

class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(level, message, context = {}) {
    this.logs.push({ level, message, context, timestamp: new Date().toISOString() });
  }

  info(message, context = {}) {
    this.log('info', message, context);
  }

  error(message, context = {}) {
    this.log('error', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  debug(message, context = {}) {
    this.log('debug', message, context);
  }

  getLogs(filter = {}) {
    if (!Object.keys(filter).length) return this.logs;
    return this.logs.filter((log) => {
      return Object.entries(filter).every(([key, value]) => {
        if (key === 'message') return log.message.includes(value);
        return log[key] === value;
      });
    });
  }

  clear() {
    this.logs = [];
  }
}

class MockResourceManager {
  constructor() {
    this.resources = new Map();
    this.cleanups = [];
  }

  allocate(id, type = 'file') {
    this.resources.set(id, { type, timestamp: Date.now() });
    return id;
  }

  release(id) {
    this.resources.delete(id);
  }

  registerCleanup(fn) {
    this.cleanups.push(fn);
  }

  async cleanup() {
    const results = [];
    for (const fn of this.cleanups) {
      try {
        await fn();
        results.push({ success: true });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    this.resources.clear();
    this.cleanups = [];
    return results;
  }

  getResourceCount() {
    return this.resources.size;
  }

  getCleanupCount() {
    return this.cleanups.length;
  }
}

class RetrySimulator {
  constructor(maxRetries = 3, backoffMs = 100) {
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
    this.attempts = [];
  }

  async executeWithRetry(fn, shouldRetry = null) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.attempts.push({ attempt, success: true, result });
        return { result, attempts: attempt + 1, success: true };
      } catch (error) {
        lastError = error;
        this.attempts.push({ attempt, success: false, error: error.message });

        if (attempt < this.maxRetries) {
          const isRetryable = shouldRetry ? shouldRetry(error) : error.retryable !== false;
          if (isRetryable) {
            await new Promise((resolve) => setTimeout(resolve, this.backoffMs * (attempt + 1)));
          } else {
            return { result: null, attempts: attempt + 1, success: false, error };
          }
        }
      }
    }
    return { result: null, attempts: this.maxRetries + 1, success: false, error: lastError };
  }

  getAttempts() {
    return this.attempts;
  }

  getAttemptCount() {
    return this.attempts.length;
  }

  getSuccessCount() {
    return this.attempts.filter((a) => a.success).length;
  }
}

class MockHealthChecker {
  constructor() {
    this.checks = new Map();
    this.autoFixFn = null;
  }

  registerCheck(name, fn) {
    this.checks.set(name, fn);
  }

  setAutoFix(fn) {
    this.autoFixFn = fn;
  }

  async runAll() {
    const results = [];
    const startTime = Date.now();

    for (const [name, fn] of this.checks) {
      const checkStart = Date.now();
      try {
        const status = await fn();
        const duration = Date.now() - checkStart;
        results.push({ name, status, duration });
      } catch (error) {
        const duration = Date.now() - checkStart;
        results.push({ name, status: 'fail', duration, error: error.message });
      }
    }

    const totalDuration = Date.now() - startTime;
    const allPassed = results.every((r) => r.status === 'pass');
    const issues = results.filter((r) => r.status === 'fail');

    return {
      checks: results,
      totalDuration,
      allPassed,
      issues,
    };
  }

  async autoFix(issues) {
    if (!this.autoFixFn) return { fixed: 0, failed: 0 };
    const results = await this.autoFixFn(issues);
    return results;
  }
}

class MockProgressTracker {
  constructor() {
    this.stages = [];
    this.currentStage = null;
    this.startTime = Date.now();
  }

  addStage(name, totalSteps = 1) {
    this.stages.push({ name, totalSteps, completedSteps: 0, status: 'pending' });
  }

  startStage(name) {
    const stage = this.stages.find((s) => s.name === name);
    if (stage) {
      stage.status = 'in-progress';
      stage.startTime = Date.now();
      this.currentStage = name;
    }
  }

  completeStep(stageName) {
    const stage = this.stages.find((s) => s.name === stageName);
    if (stage) {
      stage.completedSteps = Math.min(stage.completedSteps + 1, stage.totalSteps);
      if (stage.completedSteps === stage.totalSteps) {
        stage.status = 'completed';
        stage.endTime = Date.now();
      }
    }
  }

  getProgress() {
    const totalSteps = this.stages.reduce((sum, s) => sum + s.totalSteps, 0);
    const completedSteps = this.stages.reduce((sum, s) => sum + s.completedSteps, 0);
    const percentage = totalSteps > 0 ? Math.floor((completedSteps / totalSteps) * 100) : 0;

    const timeElapsed = Math.max((Date.now() - this.startTime) / 1000, 0.1); // seconds, minimum 0.1s
    const avgTimePerStep = completedSteps > 0 ? timeElapsed / completedSteps : 0;
    const remainingSteps = totalSteps - completedSteps;
    const estimatedRemaining = Math.max(remainingSteps * avgTimePerStep, 0);

    return {
      percentage,
      completedSteps,
      totalSteps,
      timeElapsed,
      estimatedRemaining,
      stages: this.stages,
    };
  }
}

class MockStorageSimulator {
  constructor() {
    this.storage = new Map();
    this.writes = [];
    this.reads = [];
  }

  async write(key, data, atomic = false) {
    if (atomic) {
      // Simulate atomic write with temp file
      const tempKey = `${key}.tmp`;
      this.storage.set(tempKey, data);
      this.storage.set(key, data);
      this.storage.delete(tempKey);
    } else {
      this.storage.set(key, data);
    }
    this.writes.push({ key, timestamp: Date.now(), size: JSON.stringify(data).length });
  }

  async read(key) {
    const data = this.storage.get(key);
    this.reads.push({ key, timestamp: Date.now(), found: !!data });
    return data;
  }

  async delete(key) {
    this.storage.delete(key);
  }

  getWriteCount() {
    return this.writes.length;
  }

  getReadCount() {
    return this.reads.length;
  }

  getAllKeys() {
    return Array.from(this.storage.keys());
  }

  getTotalSize() {
    let total = 0;
    for (const data of this.storage.values()) {
      total += JSON.stringify(data).length;
    }
    return total;
  }
}

exports.MockLogger = MockLogger;
exports.MockResourceManager = MockResourceManager;
exports.RetrySimulator = RetrySimulator;
exports.MockHealthChecker = MockHealthChecker;
exports.MockProgressTracker = MockProgressTracker;
exports.MockStorageSimulator = MockStorageSimulator;

// Common test assertions
exports.assertSuccess = (result, message = 'Operation should succeed') => {
  expect(result.success).toBe(true);
  expect(result.error).toBeUndefined();
};

exports.assertFailure = (result, message = 'Operation should fail') => {
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
};

exports.assertRetried = (result, expectedAttempts) => {
  expect(result.attempts).toBe(expectedAttempts);
};

exports.assertWithinTime = (duration, maxDuration, message) => {
  expect(duration).toBeLessThanOrEqual(maxDuration);
};

exports.assertResourceCleaned = (manager, expectedCount = 0) => {
  expect(manager.getResourceCount()).toBe(expectedCount);
};

// Wait with timeout
exports.waitFor = async (condition, maxWait = 5000, checkInterval = 100) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }
  return false;
};

// Create a mock error with specific properties
exports.createTestError = (message, type = 'TRANSIENT', code = 'TEST_ERROR') => {
  const error = new Error(message);
  error.type = type;
  error.code = code;
  error.retryable = type === 'TRANSIENT';
  return error;
};
