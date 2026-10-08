import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "lib/**/*.ts",
    "!**/*.test.{ts,tsx}",
    // Type-only contracts emit no runtime behavior to exercise.
    "!lib/api-types.ts",
    "!lib/console-auth-types.ts",
  ],
  coverageThreshold: {
    global: { lines: 95, functions: 95, statements: 95, branches: 90 },
  },
};

export default createJestConfig(config);
