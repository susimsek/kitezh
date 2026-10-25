import assert from "node:assert/strict";
import test from "node:test";

import { withTimeout } from "./timeout.ts";

test("operation timeout returns a stable error code", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 1, "authorization_timeout"),
    { message: "authorization_timeout" },
  );
});

test("operation timeout preserves completion and clears its timer", async () => {
  assert.equal(
    await withTimeout(Promise.resolve("complete"), 10, "timeout"),
    "complete",
  );
});
