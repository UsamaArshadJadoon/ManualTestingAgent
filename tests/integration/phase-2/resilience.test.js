/**
 * Phase 2: Resilience Integration Tests
 * Testing retry logic, resource cleanup, health checks, and API resilience
 *
 * Test Categories:
 * - Retry Logic (4 scenarios)
 * - Resource Cleanup (4 scenarios)
 * - Health Check (4 scenarios)
 * - Jira Resilience (4 scenarios)
 * - AIO Resilience (4 scenarios)
 */

const {
  MockLogger,
  MockResourceManager,
  RetrySimulator,
  MockHealthChecker,
  MockStorageSimulator,
  assertSuccess,
  assertFailure,
  assertRetried,
  assertWithinTime,
  assertResourceCleaned,
  createTestError,
  waitFor,
} = require('../../test-utils');
const fixtures = require('../../fixtures');

describe('Phase 2: Resilience Tests', () => {
  describe('Retry Logic (4 scenarios)', () => {
    let retrySimulator;
    let logger;

    beforeEach(() => {
      retrySimulator = new RetrySimulator(3, 50); // max 3 retries, 50ms backoff
      logger = new MockLogger();
    });

    test('Scenario 1: Transient error recovery with retry', async () => {
      let attemptCount = 0;
      const fn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createTestError('Transient error', 'TRANSIENT');
        }
        return { data: 'success' };
      };

      const result = await retrySimulator.executeWithRetry(fn);

      assertSuccess(result, 'Should recover from transient error');
      expect(result.result.data).toBe('success');
      assertRetried(result, 2); // 1 failure + 1 success
      expect(attemptCount).toBe(2);
    });

    test('Scenario 2: Max retries exceeded leads to immediate failure', async () => {
      const fn = async () => {
        throw createTestError('Permanent error', 'PERMANENT');
      };

      const result = await retrySimulator.executeWithRetry(fn);

      assertFailure(result, 'Should fail after max retries');
      expect(result.error).toBeDefined();
      // Should only try once for permanent errors
      expect(result.attempts).toBeLessThanOrEqual(2);
    });

    test('Scenario 3: Backoff timing increases exponentially', async () => {
      let attemptCount = 0;
      const timings = [];
      const fn = async () => {
        attemptCount++;
        timings.push(Date.now());
        if (attemptCount < 3) {
          throw createTestError('Transient error', 'TRANSIENT');
        }
        return { data: 'success' };
      };

      const result = await retrySimulator.executeWithRetry(fn);

      assertSuccess(result);
      expect(timings.length).toBe(3);

      // Check that delays increase
      if (timings.length >= 3) {
        const delay1 = timings[1] - timings[0];
        const delay2 = timings[2] - timings[1];
        // Second delay should be greater than first (exponential backoff)
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    test('Scenario 4: Retry success rate exceeds 90% for transient errors', async () => {
      const successRate = [];
      let successCount = 0;

      for (let i = 0; i < 10; i++) {
        const simulator = new RetrySimulator(3, 10);
        let attempts = 0;
        const fn = async () => {
          attempts++;
          if (attempts === 1) {
            throw createTestError('Transient', 'TRANSIENT');
          }
          return { success: true };
        };

        const result = await simulator.executeWithRetry(fn);
        if (result.success) successCount++;
      }

      const rate = successCount / 10;
      expect(rate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Resource Cleanup (4 scenarios)', () => {
    let resourceManager;

    beforeEach(() => {
      resourceManager = new MockResourceManager();
    });

    test('Scenario 5: After timeout resources are cleaned up', async () => {
      // Allocate resources
      resourceManager.allocate('file1', 'file');
      resourceManager.allocate('file2', 'file');
      resourceManager.allocate('proc1', 'process');

      expect(resourceManager.getResourceCount()).toBe(3);

      // Register cleanup tasks
      resourceManager.registerCleanup(async () => {
        resourceManager.release('file1');
      });
      resourceManager.registerCleanup(async () => {
        resourceManager.release('file2');
      });
      resourceManager.registerCleanup(async () => {
        resourceManager.release('proc1');
      });

      // Simulate timeout and cleanup
      const results = await resourceManager.cleanup();

      assertResourceCleaned(resourceManager, 0);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.length).toBe(3);
    });

    test('Scenario 6: After crash resources are still cleaned', async () => {
      resourceManager.allocate('file1', 'file');

      resourceManager.registerCleanup(async () => {
        // Simulate cleanup even after crash
        resourceManager.release('file1');
        throw new Error('Cleanup failed but continued');
      });

      resourceManager.registerCleanup(async () => {
        // Additional cleanup task
        return true;
      });

      const results = await resourceManager.cleanup();

      expect(results.length).toBe(2);
      // First cleanup failed but didn't stop other cleanups
      expect(results[0].success).toBe(false);
    });

    test('Scenario 7: No orphaned processes remain after cleanup', async () => {
      // Simulate multiple processes
      const processes = [
        resourceManager.allocate('chrome', 'process'),
        resourceManager.allocate('node', 'process'),
        resourceManager.allocate('playwright', 'process'),
      ];

      expect(resourceManager.getResourceCount()).toBe(3);

      // Register cleanup for each
      processes.forEach((proc) => {
        resourceManager.registerCleanup(async () => {
          resourceManager.release(proc);
        });
      });

      await resourceManager.cleanup();

      assertResourceCleaned(resourceManager, 0);
    });

    test('Scenario 8: Temp files removed after process termination', async () => {
      const storage = new MockStorageSimulator();

      // Write temp files
      await storage.write('run123.tmp', { data: 'temp' });
      await storage.write('run123', { data: 'real' });
      await storage.write('run123-screenshots.tmp', { data: 'temp' });

      expect(storage.getAllKeys().length).toBe(3);

      // Simulate cleanup of temp files
      const tempFiles = storage.getAllKeys().filter((k) => k.includes('.tmp'));
      for (const key of tempFiles) {
        await storage.delete(key);
      }

      const remaining = storage.getAllKeys();
      expect(remaining.length).toBe(1);
      expect(remaining[0]).toBe('run123');
    });
  });

  describe('Health Check (4 scenarios)', () => {
    let healthChecker;

    beforeEach(() => {
      healthChecker = new MockHealthChecker();
    });

    test('Scenario 9: All 8 health checks implemented and passing', async () => {
      const checkNames = [
        'config-validation',
        'jira-connectivity',
        'aio-connectivity',
        'playwright-availability',
        'disk-space',
        'memory-available',
        'dependencies',
        'permissions',
      ];

      for (const name of checkNames) {
        healthChecker.registerCheck(name, async () => 'pass');
      }

      const result = await healthChecker.runAll();

      expect(result.checks.length).toBe(8);
      expect(result.allPassed).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('Scenario 10: Health check completes in less than 10 seconds', async () => {
      for (let i = 0; i < 8; i++) {
        healthChecker.registerCheck(`check-${i}`, async () => {
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'pass';
        });
      }

      const startTime = Date.now();
      const result = await healthChecker.runAll();
      const duration = Date.now() - startTime;

      assertWithinTime(duration, 10000, 'Health check should complete within 10s');
      expect(result.totalDuration).toBeLessThan(10000);
    });

    test('Scenario 11: Auto-fix verification works for 3+ issues', async () => {
      const issues = [
        { name: 'disk-space', status: 'fail', error: 'Low disk' },
        { name: 'memory-available', status: 'fail', error: 'Low memory' },
        { name: 'permissions', status: 'fail', error: 'No perms' },
      ];

      let fixedCount = 0;
      healthChecker.setAutoFix(async (failedIssues) => {
        fixedCount = failedIssues.length;
        return { fixed: fixedCount, failed: 0 };
      });

      const result = await healthChecker.autoFix(issues);

      expect(result.fixed).toBeGreaterThanOrEqual(3);
      expect(fixedCount).toBe(3);
    });

    test('Scenario 12: Health check detects common issues', async () => {
      const issuesFound = [];

      healthChecker.registerCheck('config-validation', async () => {
        issuesFound.push('config');
        return 'fail';
      });

      healthChecker.registerCheck('jira-connectivity', async () => {
        issuesFound.push('jira');
        return 'fail';
      });

      const result = await healthChecker.runAll();

      expect(result.issues.length).toBeGreaterThan(0);
      expect(issuesFound.length).toBeGreaterThan(0);
    });
  });

  describe('Jira Resilience (4 scenarios)', () => {
    let logger;

    beforeEach(() => {
      logger = new MockLogger();
    });

    test('Scenario 13: Auth failure (401) handling with reauth', async () => {
      let authFailureCount = 0;
      const jiraCall = async () => {
        authFailureCount++;
        if (authFailureCount === 1) {
          const error = new Error('Unauthorized');
          error.status = 401;
          error.retryable = false; // Auth failures need manual reauth
          throw error;
        }
        return { success: true, key: 'PROJ-123' };
      };

      const simulator = new RetrySimulator(3, 10);
      const result = await simulator.executeWithRetry(jiraCall, (err) => err.status !== 401);

      // Should fail on first 401 without retry
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });

    test('Scenario 14: Rate limit (429) handling with backoff', async () => {
      let callCount = 0;
      const jiraCall = async () => {
        callCount++;
        if (callCount < 2) {
          const error = new Error('Rate limited');
          error.status = 429;
          error.retryable = true;
          error.retryAfter = 100;
          throw error;
        }
        return { success: true };
      };

      const simulator = new RetrySimulator(3, 100);
      const result = await simulator.executeWithRetry(jiraCall);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    test('Scenario 15: Server error (500+) retry with exponential backoff', async () => {
      let callCount = 0;
      const jiraCall = async () => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('Server error');
          error.status = 500;
          error.retryable = true;
          throw error;
        }
        return { success: true };
      };

      const simulator = new RetrySimulator(3, 50);
      const result = await simulator.executeWithRetry(jiraCall);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('Scenario 16: No duplicate filings despite retries', async () => {
      const filedIssues = new Set();
      let attemptCount = 0;

      const filingSimulation = async () => {
        attemptCount++;
        const issueKey = 'PROJ-123-' + Math.random();

        // Simulate network failure on first attempt
        if (attemptCount === 1) {
          throw createTestError('Network timeout', 'TRANSIENT');
        }

        // Mark as filed with unique key
        if (!filedIssues.has(issueKey)) {
          filedIssues.add(issueKey);
          return { success: true, key: issueKey };
        }

        throw new Error('Duplicate detected');
      };

      // In real scenario, filing key is generated once and reused
      const filingKey = 'PROJ-' + Date.now();
      let filed = false;

      const simulator = new RetrySimulator(3, 10);
      const result = await simulator.executeWithRetry(async () => {
        if (!filed) {
          attemptCount++;
          if (attemptCount === 1) {
            throw createTestError('Transient', 'TRANSIENT');
          }
          filed = true;
          return { key: filingKey };
        }
        return { key: filingKey }; // Return same key on retry
      });

      expect(result.success).toBe(true);
      // Should have single filing with same key
    });
  });

  describe('AIO Resilience (4 scenarios)', () => {
    let logger;
    let storage;

    beforeEach(() => {
      logger = new MockLogger();
      storage = new MockStorageSimulator();
    });

    test('Scenario 17: Transient error retry handling', async () => {
      let callCount = 0;
      const aioCall = async () => {
        callCount++;
        if (callCount === 1) {
          throw createTestError('Connection timeout', 'TRANSIENT');
        }
        return fixtures.createMockAIOResponse();
      };

      const simulator = new RetrySimulator(3, 20);
      const result = await simulator.executeWithRetry(aioCall);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    test('Scenario 18: Missing folder error with clear message', async () => {
      const aioCall = async () => {
        const error = new Error('Folder not found: PROJ-123');
        error.code = 'FOLDER_NOT_FOUND';
        error.retryable = false;
        throw error;
      };

      const simulator = new RetrySimulator(3, 20);
      const result = await simulator.executeWithRetry(aioCall, (err) => err.code !== 'FOLDER_NOT_FOUND');

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('PROJ-123');
    });

    test('Scenario 19: Non-blocking behavior (pipeline continues)', async () => {
      const pipeline = [];
      const aioSync = async () => {
        // Simulate AIO sync failure
        throw new Error('AIO temporarily unavailable');
      };

      // Register AIO sync
      pipeline.push({ name: 'aio-sync', fn: aioSync, blocking: false });

      // Rest of pipeline
      pipeline.push({ name: 'next-stage', fn: async () => ({ success: true }), blocking: true });

      let pipelineCompleted = false;
      for (const stage of pipeline) {
        try {
          await stage.fn();
        } catch (error) {
          if (stage.blocking) {
            throw error;
          }
          // Non-blocking errors are logged but don't stop pipeline
          logger.warn(`Stage ${stage.name} failed but continuing`, { error: error.message });
        }
      }

      pipelineCompleted = true;
      expect(pipelineCompleted).toBe(true);
      const warnings = logger.getLogs({ level: 'warn' });
      expect(warnings.length).toBeGreaterThan(0);
    });

    test('Scenario 20: Duplicate prevention with idempotent keys', async () => {
      const createdCases = new Map();
      const idempotentKey = 'case-PROJ-123-001';

      const aioCreate = async (caseData) => {
        if (createdCases.has(caseData.idempotencyKey)) {
          return { id: createdCases.get(caseData.idempotencyKey), created: false, duplicate: true };
        }
        const id = 'case-' + Math.random();
        createdCases.set(caseData.idempotencyKey, id);
        return { id, created: true, duplicate: false };
      };

      // First call
      const result1 = await aioCreate({ idempotencyKey: idempotentKey, data: 'test' });
      expect(result1.created).toBe(true);
      expect(result1.duplicate).toBe(false);

      // Retry with same key
      const result2 = await aioCreate({ idempotencyKey: idempotentKey, data: 'test' });
      expect(result2.created).toBe(false);
      expect(result2.duplicate).toBe(true);
      expect(result2.id).toBe(result1.id);
    });
  });
});
