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
  moduleNameMapper: {
    // The token contract, read from the sibling stonedog-style checkout.
    //
    // Deliberately NOT an npm dependency. `semantic-variables.ts` imports
    // nothing, so this pulls in the 44-property list without dragging
    // @pandacss/dev or the component tree into a package that has zero runtime
    // dependencies. Same arrangement stonedog-icons uses to reach the same
    // sibling. CI must check stonedog-style out beside this repo.
    //
    // The alternative — copying the list in here — is what this test exists to
    // prevent: two copies of a contract drift, silently, and the drift renders
    // as invisible elements rather than an error.
    "^stonedog-style/contract$":
      "<rootDir>/../stonedog-style/src/preset/semantic-variables.ts",
  },
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
