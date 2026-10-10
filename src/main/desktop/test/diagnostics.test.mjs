import test from "node:test";
import assert from "node:assert/strict";

import { redactDiagnosticText } from "../dist/security/diagnostics.js";

test("redacts diagnostic credentials, personal data, URL details, and user paths", () => {
  const result = redactDiagnosticText(
    "access_token=ACCESS refresh_token=REFRESH code=AUTH email=person@example.test username=person Bearer bearer-secret https://user:pass@identity.example.test/private/path?code=URL-CODE C:\\Users\\person\\profile",
  );

  for (const sensitiveValue of [
    "ACCESS",
    "REFRESH",
    "AUTH",
    "person@example.test",
    "username=person",
    "bearer-secret",
    "URL-CODE",
    "private/path",
    "C:\\Users\\person",
  ]) {
    assert.equal(result.includes(sensitiveValue), false);
  }
  assert.match(result, /email=\[redacted\]/);
  assert.match(result, /\[redacted-url\]/);
  assert.match(result, /\[user-path\]/);
});

test("redacts sensitive JSON fields and bounds diagnostic text", () => {
  const result = redactDiagnosticText(
    '{"refresh_token":"REFRESH","email":"person@example.test","password":"PASSWORD"}',
  );

  assert.equal(result.includes("REFRESH"), false);
  assert.equal(result.includes("person@example.test"), false);
  assert.equal(result.includes("PASSWORD"), false);
  assert.equal(redactDiagnosticText("x".repeat(600)).length, 500);
});
