module.exports = {
  testEnvironment: "node",
  testMatch: ["**/services/*/tests/**/*.test.js"],
  collectCoverageFrom: [
    "services/*/src/**/*.js"
  ],
  coverageDirectory: "coverage",
  verbose: true
};
