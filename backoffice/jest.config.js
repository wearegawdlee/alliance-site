module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-env.js'],
  verbose: true,
};
