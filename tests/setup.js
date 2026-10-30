/**
 * Jest Test Setup
 * Runs before all tests
 */

// Extend timeout for integration tests
jest.setTimeout(30000);

// Mock console if needed
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testHelpers = {
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  uuid: () => Math.random().toString(36).substr(2, 9),
};

// Suppress console output during tests
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

console.log(`

  ╔════════════════════════════════════════════╗
  ║   QA Integration Test Suite - Starting     ║
  ║   Phases 2, 3, 4: Resilience/Obs/Advanced ║
  ╚════════════════════════════════════════════╝

`);
