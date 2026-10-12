import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("loads shared theme tokens from the Electron main process runtime", () => {
  const { colors, controlSizes, radii, spacing, typography } = require(
    "@kitezh/shared/theme/runtime",
  );

  assert.equal(colors.light.background, "#f8f9fa");
  assert.equal(colors.dark.background, "#212529");
  assert.equal(controlSizes.desktopDefault, 44);
  assert.equal(radii.md, 14);
  assert.equal(spacing.md, 16);
  assert.equal(typography.pageTitle, 28);
});
