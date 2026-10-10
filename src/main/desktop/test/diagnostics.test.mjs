import test from "node:test";
import assert from "node:assert/strict";

import {
  appendBoundedDiagnosticLine,
  redactDiagnosticText,
} from "../dist/security/diagnostics.js";

test("bounds diagnostic retention in UTF-8 bytes and keeps complete lines", () => {
  const result = appendBoundedDiagnosticLine(
    "old event\nrecent event\n",
    "new event\n",
    23,
  );

  assert.equal(result, "recent event\nnew event\n");
  assert.equal(Buffer.byteLength(result, "utf8"), 23);
  assert.equal(
    Buffer.byteLength(appendBoundedDiagnosticLine("", "🛡️".repeat(20), 16)),
    0,
  );
});

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

test("redacts headers, cookies, provider identity, and personal profile fields", () => {
  const result = redactDiagnosticText(
    'Authorization: Bearer SECRET api_key=API session_id=SESSION Set-Cookie: auth=COOKIE provider_subject=SUB first_name="Ada" lastName=Lovelace phone=5551212 address="12 Main Street" state=STATE csrf=CSRF',
  );

  for (const sensitiveValue of [
    "SECRET",
    "API",
    "SESSION",
    "COOKIE",
    "SUB",
    "Ada",
    "Lovelace",
    "5551212",
    "12 Main Street",
    "STATE",
    "CSRF",
  ]) {
    assert.equal(result.includes(sensitiveValue), false);
  }
});
