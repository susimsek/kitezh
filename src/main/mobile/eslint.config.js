// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Coverage tests run in the Web Jest harness and use its test-only renderer.
    ignores: ["dist/*", "src/**/*.coverage.test.tsx"],
  },
]);
