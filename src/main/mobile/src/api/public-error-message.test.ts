import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "@kitezh/shared/i18n";

import { publicErrorMessage } from "./public-error-message.ts";

test("maps public API transport and authorization failures to localized copy", () => {
  const cases = [
    ["offline", messages.en.apiOffline],
    ["timeout", messages.en.apiTimeout],
    ["unauthorized", messages.en.apiUnauthorized],
    ["forbidden", messages.en.apiForbidden],
    ["validation", messages.en.apiValidation],
    ["cancelled", messages.en.apiCancelled],
    ["conflict", messages.en.apiConflict],
    ["rate-limited", messages.en.apiRateLimited],
    ["unavailable", messages.en.apiUnavailable],
    ["server", messages.en.apiServer],
    ["http", messages.en.apiHttp],
  ] as const;

  for (const [kind, expected] of cases) {
    assert.equal(
      publicErrorMessage(kind, messages.en, "registrationError"),
      expected,
    );
  }
});

test("maps the same public failures to Turkish copy", () => {
  const cases = [
    ["offline", messages.tr.apiOffline],
    ["timeout", messages.tr.apiTimeout],
    ["unauthorized", messages.tr.apiUnauthorized],
    ["forbidden", messages.tr.apiForbidden],
    ["validation", messages.tr.apiValidation],
    ["cancelled", messages.tr.apiCancelled],
    ["conflict", messages.tr.apiConflict],
    ["rate-limited", messages.tr.apiRateLimited],
    ["unavailable", messages.tr.apiUnavailable],
    ["server", messages.tr.apiServer],
    ["http", messages.tr.apiHttp],
  ] as const;

  for (const [kind, expected] of cases) {
    assert.equal(
      publicErrorMessage(kind, messages.tr, "registrationError"),
      expected,
    );
  }
});

test("uses the screen fallback for update errors and unexpected exceptions", () => {
  assert.equal(
    publicErrorMessage("update", messages.en, "forgotError"),
    messages.en.forgotError,
  );
  assert.equal(
    publicErrorMessage(
      undefined,
      messages.en,
      "resetError",
    ),
    messages.en.resetError,
  );
});
