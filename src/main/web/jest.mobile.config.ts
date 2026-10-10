import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "../mobile" });

const config: Config = {
  rootDir: "../mobile",
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.coverage.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react$": "<rootDir>/../web/node_modules/react",
    "^react-dom$": "<rootDir>/../web/node_modules/react-dom",
    "^react-dom/(.*)$": "<rootDir>/../web/node_modules/react-dom/$1",
    "^react-native$": "<rootDir>/node_modules/react-native-web",
    "^@testing-library/react$": "<rootDir>/../web/node_modules/@testing-library/react",
    "^@testing-library/jest-dom$": "<rootDir>/../web/node_modules/@testing-library/jest-dom",
  },
  setupFilesAfterEnv: ["<rootDir>/../web/test/jest.mobile.setup.ts"],
  collectCoverageFrom: [
    "<rootDir>/src/app/admin.tsx",
    "<rootDir>/src/app/account.tsx",
    "<rootDir>/src/app/applications.tsx",
    "<rootDir>/src/app/security.tsx",
    "<rootDir>/src/app/mfa.tsx",
    "<rootDir>/src/app/social-links.tsx",
    "<rootDir>/src/app/register.tsx",
    "<rootDir>/src/app/reset-password.tsx",
    "<rootDir>/src/app/forgot-password.tsx",
    "<rootDir>/src/auth/MobileAuthProvider.tsx",
    "<rootDir>/src/components/AdminResourceEditor.tsx",
    "<rootDir>/src/components/AuthCallbackScreen.tsx",
  ],
  coverageDirectory: "<rootDir>/coverage/ui",
  coverageReporters: ["lcov", "text"],
};

export default createJestConfig(config);
