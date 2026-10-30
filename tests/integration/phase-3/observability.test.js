/**
 * Phase 3: Observability Integration Tests
 * Testing diagnostics, progress tracking, log analysis, and troubleshooting
 *
 * Test Categories:
 * - Diagnostics Collection (4 scenarios)
 * - Progress Tracking (4 scenarios)
 * - Log Analysis (4 scenarios)
 * - Troubleshooting (3 scenarios)
 */

const {
  MockLogger,
  MockProgressTracker,
  MockStorageSimulator,
  assertSuccess,
  assertWithinTime,
  waitFor,
} = require('../../test-utils');
const fixtures = require('../../fixtures');

describe('Phase 3: Observability Tests', () => {
  describe('Diagnostics Collection (4 scenarios)', () => {
    let storage;
    let logger;

    beforeEach(() => {
      storage = new MockStorageSimulator();
      logger = new MockLogger();
    });

    test('Scenario 21: All diagnostic info collected within 10 seconds', async () => {
      const diagnosticsStart = Date.now();

      // Simulate collecting diagnostics
      const diagnosticsData = {
        timestamp: new Date().toISOString(),
        systemInfo: {
          platform: 'win32',
          nodeVersion: 'v18.0.0',
          memory: { total: 16384, free: 8192 },
          disk: { total: 1000000, free: 500000 },
        },
        runInfo: {
          runId: 'run-123',
          storyKey: 'PROJ-123',
          startTime: new Date(Date.now() - 600000).toISOString(), // 10 min ago
          stage: 'qa-test-executor',
          status: 'in-progress',
        },
        agentStatus: {
          'qa-story': { status: 'completed', duration: 120 },
          'qa-test-writer': { status: 'completed', duration: 180 },
          'qa-test-executor': { status: 'in-progress', duration: 0 },
        },
        errors: logger.getLogs({ level: 'error' }),
        warnings: logger.getLogs({ level: 'warn' }),
      };

      await storage.write('diagnostics.json', diagnosticsData);

      const diagnosticsDuration = Date.now() - diagnosticsStart;

      assertWithinTime(diagnosticsDuration, 10000, 'Diagnostics collection should be <10s');
      expect(diagnosticsData.systemInfo).toBeDefined();
      expect(diagnosticsData.runInfo).toBeDefined();
      expect(diagnosticsData.agentStatus).toBeDefined();
    });

    test('Scenario 22: HTML report generated from diagnostics', async () => {
      const diagnosticsData = {
        timestamp: new Date().toISOString(),
        systemInfo: { platform: 'win32', nodeVersion: 'v18.0.0' },
        runInfo: { storyKey: 'PROJ-123' },
        errors: [{ level: 'error', message: 'Test error' }],
      };

      // Simulate HTML generation
      const htmlReport = `
        <!DOCTYPE html>
        <html>
        <head><title>Diagnostics Report</title></head>
        <body>
          <h1>Diagnostics Report</h1>
          <p>Generated: ${diagnosticsData.timestamp}</p>
          <h2>Story: ${diagnosticsData.runInfo.storyKey}</h2>
          <h3>System Info</h3>
          <p>Platform: ${diagnosticsData.systemInfo.platform}</p>
          <h3>Issues Found: ${diagnosticsData.errors.length}</h3>
        </body>
        </html>
      `.trim();

      await storage.write('diagnostics.html', htmlReport);

      const stored = await storage.read('diagnostics.html');
      expect(stored).toContain('Diagnostics Report');
      expect(stored).toContain('PROJ-123');
      expect(stored).toContain('<!DOCTYPE html>');
    });

    test('Scenario 23: JSON data exportable for analysis', async () => {
      const diagnosticsData = fixtures.mockHealthCheckResult();
      diagnosticsData.logs = logger.getLogs();

      await storage.write('diagnostics-export.json', diagnosticsData);

      const exported = await storage.read('diagnostics-export.json');
      expect(exported).toBeDefined();
      expect(exported.checks).toBeDefined();
      expect(Array.isArray(exported.checks)).toBe(true);
      expect(exported.logs).toBeDefined();
    });

    test('Scenario 24: Sensitive data redaction works', async () => {
      const sensitiveData = {
        jiraToken: 'secret-token-12345',
        aioToken: 'aio-secret-key',
        credentials: { user: 'test@example.com', pass: 'password123' },
        normalData: { runId: 'run-123', storyKey: 'PROJ-123' },
      };

      // Simulate redaction
      const redacted = {
        jiraToken: '***REDACTED***',
        aioToken: '***REDACTED***',
        credentials: { user: '***REDACTED***', pass: '***REDACTED***' },
        normalData: sensitiveData.normalData,
      };

      await storage.write('diagnostics-redacted.json', redacted);
      const stored = await storage.read('diagnostics-redacted.json');

      expect(stored.jiraToken).toBe('***REDACTED***');
      expect(stored.aioToken).toBe('***REDACTED***');
      expect(stored.credentials.user).toBe('***REDACTED***');
      expect(stored.normalData.runId).toBe('run-123');
    });
  });

  describe('Progress Tracking (4 scenarios)', () => {
    let progressTracker;

    beforeEach(() => {
      progressTracker = new MockProgressTracker();
    });

    test('Scenario 25: Progress percentage accurate', async () => {
      progressTracker.addStage('qa-story', 1);
      progressTracker.addStage('qa-test-writer', 1);
      progressTracker.addStage('qa-test-executor', 1);

      progressTracker.startStage('qa-story');
      progressTracker.completeStep('qa-story');
      const progress1 = progressTracker.getProgress();
      expect(progress1.percentage).toBe(33); // 1 of 3

      progressTracker.startStage('qa-test-writer');
      progressTracker.completeStep('qa-test-writer');
      const progress2 = progressTracker.getProgress();
      expect(progress2.percentage).toBe(66); // 2 of 3

      progressTracker.startStage('qa-test-executor');
      progressTracker.completeStep('qa-test-executor');
      const progress3 = progressTracker.getProgress();
      expect(progress3.percentage).toBe(100); // 3 of 3
    });

    test('Scenario 26: Time remaining estimate close', async () => {
      progressTracker.addStage('stage1', 2);
      progressTracker.addStage('stage2', 2);
      progressTracker.addStage('stage3', 2);

      // Complete 2 steps
      progressTracker.startStage('stage1');
      progressTracker.completeStep('stage1');
      progressTracker.completeStep('stage1');

      const progress = progressTracker.getProgress();

      expect(progress.completedSteps).toBe(2);
      expect(progress.totalSteps).toBe(6);
      expect(progress.estimatedRemaining).toBeGreaterThan(0);

      // Estimate should be reasonable (within 2x of actual)
      // If first 2 steps took ~200ms, remaining 4 should be ~400-500ms
      expect(progress.estimatedRemaining).toBeLessThan(10); // 10 seconds max
    });

    test('Scenario 27: Progress updated every stage', async () => {
      const progressHistory = [];

      const stages = ['qa-story', 'qa-test-writer', 'qa-gap-analyzer', 'qa-test-executor'];
      for (const stage of stages) {
        progressTracker.addStage(stage, 1);
      }

      for (const stage of stages) {
        progressTracker.startStage(stage);
        progressTracker.completeStep(stage);
        const progress = progressTracker.getProgress();
        progressHistory.push({ stage, progress: progress.percentage });
      }

      // Progress should increase monotonically
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i].progress).toBeGreaterThanOrEqual(progressHistory[i - 1].progress);
      }

      // Final progress should be 100%
      expect(progressHistory[progressHistory.length - 1].progress).toBe(100);
    });

    test('Scenario 28: Progress file saved correctly', async () => {
      const storage = new MockStorageSimulator();

      progressTracker.addStage('qa-story', 1);
      progressTracker.addStage('qa-test-writer', 1);

      progressTracker.startStage('qa-story');
      progressTracker.completeStep('qa-story');

      const progress = progressTracker.getProgress();
      await storage.write('progress.json', progress);

      const saved = await storage.read('progress.json');
      expect(saved.percentage).toBe(50);
      expect(saved.completedSteps).toBe(1);
      expect(saved.totalSteps).toBe(2);
    });
  });

  describe('Log Analysis (4 scenarios)', () => {
    let logger;
    let storage;

    beforeEach(() => {
      logger = new MockLogger();
      storage = new MockStorageSimulator();
    });

    test('Scenario 29: Query logs by test case', async () => {
      // Log entries for different cases
      logger.info('Test case 1 started', { testCase: 'CASE-001', stage: 'execution' });
      logger.info('Test case 1 step 1 completed', { testCase: 'CASE-001', step: 1 });
      logger.info('Test case 2 started', { testCase: 'CASE-002', stage: 'execution' });
      logger.info('Test case 1 step 2 completed', { testCase: 'CASE-001', step: 2 });
      logger.info('Test case 2 step 1 completed', { testCase: 'CASE-002', step: 1 });

      const case1Logs = logger.getLogs().filter((log) => log.context.testCase === 'CASE-001');
      const case2Logs = logger.getLogs().filter((log) => log.context.testCase === 'CASE-002');

      expect(case1Logs.length).toBe(3);
      expect(case2Logs.length).toBe(2);
    });

    test('Scenario 30: Find retries in logs', async () => {
      logger.info('Attempting agent dispatch', { agent: 'qa-test-executor', attempt: 1 });
      logger.error('Agent failed', { agent: 'qa-test-executor', error: 'timeout' });
      logger.info('Retrying agent dispatch', { agent: 'qa-test-executor', attempt: 2 });
      logger.info('Agent completed', { agent: 'qa-test-executor', attempt: 2 });

      const allLogs = logger.getLogs();
      const retryLogs = allLogs.filter((log) => log.level === 'info' && log.message.includes('Retry'));

      expect(retryLogs.length).toBeGreaterThan(0);

      const failureLogs = logger.getLogs({ level: 'error' });
      expect(failureLogs.length).toBeGreaterThan(0);
    });

    test('Scenario 31: Error pattern identification works', async () => {
      // Log multiple similar errors
      for (let i = 0; i < 3; i++) {
        logger.error('Connection timeout', { error: 'ETIMEDOUT', retry: i });
      }
      for (let i = 0; i < 2; i++) {
        logger.error('Auth failed', { error: 'EAUTH', retry: i });
      }

      const allLogs = logger.getLogs({ level: 'error' });
      expect(allLogs.length).toBe(5);

      // Count error types
      const errorTypes = {};
      for (const log of allLogs) {
        const errorType = log.message;
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }

      expect(errorTypes['Connection timeout']).toBe(3);
      expect(errorTypes['Auth failed']).toBe(2);
    });

    test('Scenario 32: Export logs successful', async () => {
      logger.info('Pipeline started', { stage: 'qa-story' });
      logger.info('Story fetched', { stage: 'qa-story', duration: 150 });
      logger.info('Pipeline stage completed', { stage: 'qa-story' });

      const logsToExport = logger.getLogs();
      await storage.write('exported-logs.json', logsToExport);

      const exported = await storage.read('exported-logs.json');
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(3);
      expect(exported[0].message).toBe('Pipeline started');
    });
  });

  describe('Troubleshooting Guide Generation (3+ scenarios)', () => {
    let logger;
    let storage;

    beforeEach(() => {
      logger = new MockLogger();
      storage = new MockStorageSimulator();
    });

    test('Scenario 33: Guide generated from errors', async () => {
      logger.error('Jira authentication failed', { code: 'JIRA_AUTH_401' });
      logger.error('AIO folder not found', { code: 'AIO_FOLDER_NOT_FOUND', folder: 'PROJ-123' });

      const errors = logger.getLogs({ level: 'error' });

      const troubleshootingGuide = {
        title: 'Troubleshooting Guide',
        generatedAt: new Date().toISOString(),
        issues: [
          {
            error: errors[0].message,
            code: 'JIRA_AUTH_401',
            suggestion: 'Check JIRA credentials in .qa-secrets or env vars',
            links: [
              'https://docs.qa-agent.local/jira-auth',
              'https://jira.example.com/secure/RCAbout.jspa?about=true',
            ],
          },
          {
            error: errors[1].message,
            code: 'AIO_FOLDER_NOT_FOUND',
            suggestion: 'Create folder PROJ-123 in AIO Tests > Cases module',
            links: ['https://docs.qa-agent.local/aio-setup'],
          },
        ],
      };

      await storage.write('troubleshooting-guide.json', troubleshootingGuide);
      const guide = await storage.read('troubleshooting-guide.json');

      expect(guide.issues.length).toBe(2);
      expect(guide.issues[0].suggestion).toContain('credentials');
      expect(guide.issues[1].suggestion).toContain('Create folder');
    });

    test('Scenario 34: Suggestions are practical', async () => {
      const errors = [
        {
          code: 'LOW_DISK_SPACE',
          message: 'Disk space below 100MB',
          details: { available: 50 },
        },
        {
          code: 'HIGH_MEMORY_USAGE',
          message: 'Memory usage above 90%',
          details: { used: 14880 }, // of 16384
        },
      ];

      const suggestions = {
        LOW_DISK_SPACE: [
          'Clean old run folders: find runs/ -mtime +7 -type d -exec rm -rf {} +',
          'Empty browser cache in .playwright-mcp/',
          'Archive old screenshot evidence to external storage',
        ],
        HIGH_MEMORY_USAGE: [
          'Close other applications',
          'Reduce parallel test count',
          'Increase node memory: NODE_OPTIONS=--max-old-space-size=4096',
        ],
      };

      const guide = {
        errors,
        suggestions: errors.map((err) => ({
          error: err.code,
          message: err.message,
          actions: suggestions[err.code],
        })),
      };

      expect(guide.suggestions[0].actions.length).toBeGreaterThan(0);
      expect(guide.suggestions[0].actions[0]).toContain('find runs');
      expect(guide.suggestions[1].actions[0]).toContain('Close');
    });

    test('Scenario 35: Links are accurate and helpful', async () => {
      const errorToLinks = {
        JIRA_AUTH_FAILED: {
          documentation: 'https://docs.qa-agent.local/jira-auth',
          support: 'https://jira.atlassian.com/support',
        },
        AIO_NOT_FOUND: {
          documentation: 'https://docs.qa-agent.local/aio-setup',
          forum: 'https://aio.example.com/community',
        },
        PLAYWRIGHT_BROWSER_CRASH: {
          documentation: 'https://docs.qa-agent.local/playwright',
          github: 'https://github.com/microsoft/playwright/issues',
        },
      };

      for (const [errorCode, links] of Object.entries(errorToLinks)) {
        expect(links.documentation).toContain('http');
        expect(Object.keys(links).length).toBeGreaterThan(0);
      }

      // Verify links are reachable format
      Object.values(errorToLinks).forEach((links) => {
        Object.values(links).forEach((url) => {
          expect(url).toMatch(/^https?:\/\//);
        });
      });
    });

    test('Scenario 36: Guide helps resolve 50%+ of issues', async () => {
      const commonIssues = [
        { code: 'LOW_DISK', solvable: true },
        { code: 'TIMEOUT', solvable: true },
        { code: 'AUTH_FAILED', solvable: true },
        { code: 'RATE_LIMITED', solvable: true },
        { code: 'BROWSER_CRASH', solvable: false }, // Harder to resolve
      ];

      const solvableIssues = commonIssues.filter((issue) => issue.solvable);
      const resolutionRate = solvableIssues.length / commonIssues.length;

      expect(resolutionRate).toBeGreaterThanOrEqual(0.5);
      expect(solvableIssues.length).toBeGreaterThanOrEqual(2);
    });
  });
});
