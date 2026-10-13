import assert from "node:assert/strict";
import test from "node:test";

import { isValidEmail } from "./email.ts";

test("email validation accepts a basic address with a dotted domain", () => {
  assert.equal(isValidEmail("user@example.com"), true);
});

test("email validation rejects missing parts and whitespace", () => {
  for (const value of [
    "",
    "@example.com",
    "user@.com",
    "user@example.",
    "user @example.com",
  ]) {
    assert.equal(isValidEmail(value), false, value);
  }
});
