module.exports = {
  displayName: 'QA Integration Tests',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'tests/test-utils.js',
    'tests/fixtures.js',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 60,
      lines: 75,
      statements: 75,
    },
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
};
