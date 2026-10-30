/**
 * Test Fixtures - Shared data for all integration tests
 */

const { v4: uuidv4 } = require('uuid');

exports.createMockStoryContext = () => ({
  storyKey: 'PROJ-123',
  summary: 'Test Story',
  description: 'Test Story Description',
  acceptanceCriteria: [
    { id: '1', text: 'AC 1: User can login' },
    { id: '2', text: 'AC 2: User can view dashboard' },
  ],
  components: ['Frontend', 'Backend'],
  status: 'IN_PROGRESS',
});

exports.createMockTestCase = (override = {}) => ({
  id: uuidv4(),
  caseId: 'CASE-001',
  title: 'Happy path test',
  type: 'happy',
  steps: [
    { step: 1, action: 'Navigate to login', expected: 'Login page loads' },
    { step: 2, action: 'Enter credentials', expected: 'Authenticated' },
  ],
  linkedAC: '1',
  ...override,
});

exports.createMockRunContext = () => ({
  runId: uuidv4(),
  storyKey: 'PROJ-123',
  startTime: new Date().toISOString(),
  stage: 'qa-story',
  status: 'in-progress',
  results: [],
  errors: [],
  metrics: {
    retryCount: 0,
    totalAttempts: 0,
    resourceUsage: {
      memory: 0,
      disk: 0,
    },
  },
});

exports.createMockTestResult = (override = {}) => ({
  caseId: 'CASE-001',
  status: 'passed',
  duration: 5000,
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 5000).toISOString(),
  evidence: {
    screenshots: ['screenshot1.png'],
    logs: ['log entry 1'],
    consoleErrors: [],
  },
  retries: 0,
  ...override,
});

exports.createMockError = (type = 'TRANSIENT', message = 'Test error') => ({
  type,
  message,
  code: 'TEST_ERROR',
  timestamp: new Date().toISOString(),
  stack: new Error().stack,
  retryable: type === 'TRANSIENT',
});

exports.createMockJiraResponse = (override = {}) => ({
  key: 'PROJ-123',
  id: '12345',
  fields: {
    summary: 'Test Story',
    status: { name: 'In Progress' },
    customfield_10000: [
      { value: 'AC 1: Test' },
      { value: 'AC 2: Test' },
    ],
  },
  ...override,
});

exports.createMockAIOResponse = (override = {}) => ({
  id: uuidv4(),
  name: 'Test Case',
  status: 'created',
  linkedStory: 'PROJ-123',
  results: {
    passed: 0,
    failed: 0,
    blocked: 0,
  },
  ...override,
});

exports.createMockProgressData = (stage = 'qa-story', percentage = 25) => ({
  storyKey: 'PROJ-123',
  runId: uuidv4(),
  currentStage: stage,
  percentage,
  timeElapsed: 120,
  estimatedRemaining: 360,
  stageTiming: {
    'qa-story': { start: Date.now() - 120000, end: Date.now() },
  },
  stages: [
    { name: 'qa-story', status: 'completed', duration: 120 },
    { name: 'qa-test-writer', status: 'in-progress', duration: 0 },
    { name: 'qa-test-executor', status: 'pending', duration: 0 },
  ],
});

exports.createMockLogEntry = (level = 'info', message = 'Test log') => ({
  timestamp: new Date().toISOString(),
  level,
  message,
  context: {
    storyKey: 'PROJ-123',
    stage: 'qa-story',
    runId: uuidv4(),
  },
  metadata: {
    duration: 100,
    retries: 0,
  },
});

exports.createMockBugDraft = (override = {}) => ({
  id: uuidv4(),
  summary: 'Login button not working',
  description: 'When user clicks login, nothing happens',
  severity: 'HIGH',
  linkedAC: '1',
  linkedCase: 'CASE-001',
  evidence: {
    screenshots: ['bug1.png'],
    steps: 'Reproduce: 1. Go to login 2. Click button',
  },
  timestamp: new Date().toISOString(),
  ...override,
});

exports.mockTaskCall = async (agent, params) => {
  // Simulate async task call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        output: `Mock output from ${agent}`,
        timestamp: new Date().toISOString(),
      });
    }, 100);
  });
};

exports.mockHealthCheckResult = () => ({
  timestamp: new Date().toISOString(),
  checks: [
    { name: 'config-validation', status: 'pass', duration: 150 },
    { name: 'jira-connectivity', status: 'pass', duration: 250 },
    { name: 'aio-connectivity', status: 'pass', duration: 200 },
    { name: 'playwright-availability', status: 'pass', duration: 300 },
    { name: 'disk-space', status: 'pass', duration: 50 },
    { name: 'memory-available', status: 'pass', duration: 50 },
    { name: 'dependencies', status: 'pass', duration: 100 },
    { name: 'permissions', status: 'pass', duration: 75 },
  ],
  totalDuration: 1175,
  allPassed: true,
  issues: [],
});

exports.mockFlakyTestData = () => ({
  caseId: 'CASE-001',
  runs: [
    { runId: '1', status: 'passed', timestamp: Date.now() - 300000 },
    { runId: '2', status: 'failed', timestamp: Date.now() - 200000 },
    { runId: '3', status: 'passed', timestamp: Date.now() - 100000 },
    { runId: '4', status: 'passed', timestamp: Date.now() },
  ],
  successRate: 0.75,
  failureRate: 0.25,
  isFlaky: true,
  confidence: 0.9,
});

exports.mockResourceMetrics = () => ({
  timestamp: new Date().toISOString(),
  memory: {
    used: 512, // MB
    available: 8192,
    percentage: 6.25,
  },
  disk: {
    used: 50000, // MB
    available: 500000,
    percentage: 9.1,
  },
  processes: [
    { pid: 1234, name: 'chrome', memory: 256 },
    { pid: 5678, name: 'node', memory: 128 },
  ],
});
