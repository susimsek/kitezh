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
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "i18n/**/*.{ts,tsx}",
    "lib/**/*.ts",
    "routing/**/*.{ts,tsx}",
    "store/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    // Type-only contracts emit no runtime behavior to exercise.
    "!lib/api-types.ts",
    "!lib/console-auth-types.ts",
  ],
  coverageThreshold:
    process.env.SONAR_COVERAGE_REPORT === "true"
      ? undefined
      : { global: { lines: 95, functions: 95, statements: 95, branches: 90 } },
};

export default createJestConfig(config);
