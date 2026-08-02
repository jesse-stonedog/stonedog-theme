/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: [
    "<rootDir>/src/**/__test__/**/*.test.ts",
    "<rootDir>/test/integration/**/*.test.ts",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/\\.claude/"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
  // No moduleNameMapper. The version of this file inside HopperGuard mapped
  // hopper-logger, hopper-dal, hopper-db and hopper-types to sibling checkouts;
  // none of them are imported any more, which is the point of the extraction.
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
