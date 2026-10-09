import assert from "node:assert/strict";
import test from "node:test";

import { messages, resolveLocale } from "../../shared/src/i18n.ts";
import { colors, resolveTheme } from "../../shared/src/theme.ts";
import { getMobileConsoleConfig } from "./config.ts";
import { sessionStorageKey } from "./auth/session-keys.ts";
import {
  DEFAULT_NOTICE_DURATION_MS,
  normalizeNoticeDuration,
} from "./notifications/notice.ts";
import type {
  ConsoleName,
  DesktopLanguageMode,
  SocialProviderAvailability,
} from "../../shared/src/contracts.ts";
import {
  classifyApiError,
  parseProblemDetail,
} from "../../shared/src/api.ts";
import {
  isAllowedNativeRedirect,
  parseNativeDeepLink,
  validateAuthorizationCallback,
} from "../../shared/src/auth.ts";
import { createSingleFlight } from "../../shared/src/session.ts";

test("system locale resolves to the device language when supported", () => {
  assert.equal(resolveLocale("system", "tr-TR"), "tr");
  assert.equal(resolveLocale("system", "en-US"), "en");
  assert.equal(resolveLocale("en", "tr-TR"), "en");
});

test("theme resolver returns semantic palettes for every mode", () => {
  assert.equal(resolveTheme("dark", "light"), "dark");
  assert.equal(resolveTheme("system", "dark"), "dark");
  assert.ok(colors.light.primary);
  assert.ok(colors.dark.primary);
  assert.equal(messages.tr.signIn, "Giriş yap");
});

test("native contracts stay platform-neutral", () => {
  const consoleName: ConsoleName = "account";
  const languageMode: DesktopLanguageMode = "system";
  const provider: SocialProviderAvailability = {
    configured: true,
    iconKey: "google",
    provider: "google",
    providerType: "google",
  };

  assert.equal(consoleName, "account");
  assert.equal(languageMode, "system");
  assert.equal(provider.configured, true);
});

test("mobile notices use a bounded auto-dismiss duration", () => {
  assert.equal(normalizeNoticeDuration(), DEFAULT_NOTICE_DURATION_MS);
  assert.equal(normalizeNoticeDuration(500), 1_000);
  assert.equal(normalizeNoticeDuration(60_000), 10_000);
});

test("mobile console contracts isolate account and admin sessions", () => {
  const account = getMobileConsoleConfig("account");
  const admin = getMobileConsoleConfig("admin");

  assert.equal(account.clientId, "mobile-account-console");
  assert.deepEqual(account.scopes, ["openid", "profile", "email", "account-api"]);
  assert.equal(account.redirectUri, "kitezh://oauth/callback");
  assert.equal(admin.clientId, "mobile-admin-console");
  assert.deepEqual(admin.scopes, ["openid", "profile", "email", "admin-api"]);
  assert.equal(admin.redirectUri, "kitezh://admin/oauth/callback");
  assert.notEqual(sessionStorageKey("account"), sessionStorageKey("admin"));
});

test("shared API errors preserve native status semantics without transport details", () => {
  const problem = parseProblemDetail({
    type: "https://kitezh.dev/problems/validation",
    status: 422,
    violations: [{ field: "email", message: "Enter a valid email address." }],
  });
  assert.deepEqual(problem?.violations, [
    { field: "email", message: "Enter a valid email address." },
  ]);
  assert.equal(classifyApiError(401), "unauthorized");
  assert.equal(classifyApiError(403), "forbidden");
  assert.equal(classifyApiError(0, new DOMException("timeout", "AbortError")), "timeout");
  assert.equal(classifyApiError(0, new Error("network")), "offline");
});

test("native OAuth callbacks require the original state and approved scheme", () => {
  assert.deepEqual(
    validateAuthorizationCallback(
      { code: "one-time-code", state: "request-state" },
      "request-state",
    ),
    { code: "one-time-code", state: "request-state" },
  );
  assert.throws(
    () =>
      validateAuthorizationCallback(
        { code: "one-time-code", state: "other-state" },
        "request-state",
      ),
    /authorization_callback_state_mismatch/,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    true,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "https://example.test/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
});

test("native deep links accept only registered routes", () => {
  assert.deepEqual(
    parseNativeDeepLink("kitezh://verify-email/?token=one-time-token"),
    { kind: "verify-email", token: "one-time-token" },
  );
  assert.deepEqual(parseNativeDeepLink("kitezh://oauth/callback"), {
    kind: "oauth-callback",
  });
  assert.equal(
    parseNativeDeepLink("https://kitezh.onrender.com/verify-email?token=secret"),
    null,
  );
  assert.equal(parseNativeDeepLink("kitezh://verify-email/"), null);
});

test("session refresh operations are single-flight and recover after completion", async () => {
  const coordinator = createSingleFlight<number>();
  let executions = 0;
  let resolveOperation: ((value: number) => void) | undefined;
  const operation = () => {
    executions += 1;
    return new Promise<number>((resolve) => {
      resolveOperation = resolve;
    });
  };
  const first = coordinator.run(operation);
  const second = coordinator.run(operation);
  assert.equal(coordinator.pending(), true);
  assert.equal(executions, 1);
  resolveOperation?.(7);
  assert.equal(await first, 7);
  assert.equal(await second, 7);
  assert.equal(coordinator.pending(), false);
  assert.equal(await coordinator.run(async () => 8), 8);
  assert.equal(executions, 1);
});
