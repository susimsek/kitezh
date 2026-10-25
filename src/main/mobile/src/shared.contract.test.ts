import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { messages, resolveLocale } from "@kitezh/shared/i18n";
import { createClientMetadataHeaders } from "@kitezh/shared/client-metadata";
import { colors, controlSizes, resolveTheme } from "../../shared/src/theme.ts";
import {
  DEFAULT_AUTHORIZATION_SERVER_ISSUER,
  getMobileConsoleConfig,
  resolveAuthorizationServerIssuer,
} from "./config.ts";
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
  parseRetryAfterMs,
  problemFieldErrors,
  readRetryAfterHeader,
} from "../../shared/src/api.ts";
import {
  isAllowedNativeRedirect,
  parseNativeDeepLink,
  resolveNativeIntentPath,
  validateNativeAuthorizationConfig,
  validateAuthorizationCallback,
} from "../../shared/src/auth.ts";
import {
  createSingleFlight,
  NATIVE_REFRESH_EXPIRY_SKEW_MS,
} from "../../shared/src/session.ts";
import { isValidEmailAddress } from "./utils/email.ts";
import * as mobileThemeTokens from "./theme/tokens.ts";

test("native token exports expose the platform-neutral design values", () => {
  assert.ok(Object.keys(mobileThemeTokens.colors).length > 0);
  assert.ok(Object.keys(mobileThemeTokens.typography).length > 0);
  assert.ok(Object.keys(mobileThemeTokens.controlSizes).length > 0);
  assert.ok(Object.keys(mobileThemeTokens.spacing).length > 0);
  assert.ok(Object.keys(mobileThemeTokens.radii).length > 0);
});

test("client metadata follows the Kitezh app header contract", () => {
  assert.deepEqual(
    createClientMetadataHeaders({
      appVersion: "v0.1.4",
      clientPlatform: "ios",
      os: "ios",
    }),
    {
      "App-Name": "Kitezh",
      "App-Version": "v0.1.4",
      "Client-Platform": "ios",
      OS: "ios",
    },
  );
});

test("email shape validation rejects ambiguous and malformed addresses", () => {
  assert.equal(isValidEmailAddress("person@example.com"), true);
  assert.equal(isValidEmailAddress("person+tag@example.co.uk"), true);
  assert.equal(isValidEmailAddress("person@@example.com"), false);
  assert.equal(isValidEmailAddress("person@.example.com"), false);
  assert.equal(isValidEmailAddress("person@example."), false);
  assert.equal(isValidEmailAddress("person name@example.com"), false);
});

test("system locale resolves to the device language when supported", () => {
  assert.equal(resolveLocale("system", "tr-TR"), "tr");
  assert.equal(resolveLocale("system", "en-US"), "en");
  assert.equal(resolveLocale("en", "tr-TR"), "en");
});

test("English and Turkish native message catalogs remain in sync", () => {
  const englishKeys = Object.keys(messages.en).sort();
  const turkishKeys = Object.keys(messages.tr).sort();
  assert.deepEqual(turkishKeys, englishKeys);
  assert.ok(
    englishKeys.every((key) => messages.en[key as keyof typeof messages.en]),
  );
  assert.ok(
    turkishKeys.every((key) => messages.tr[key as keyof typeof messages.tr]),
  );
});

test("theme resolver returns semantic palettes for every mode", () => {
  assert.equal(resolveTheme("dark", "light"), "dark");
  assert.equal(resolveTheme("system", "dark"), "dark");
  for (const palette of [colors.light, colors.dark]) {
    assert.ok(palette.background);
    assert.ok(palette.surface);
    assert.ok(palette.surfaceHover);
    assert.ok(palette.text);
    assert.ok(palette.primary);
  }
  assert.ok(controlSizes.mobile >= 48);
  assert.ok(controlSizes.mobileIconTarget >= 44);
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
  assert.deepEqual(account.scopes, [
    "openid",
    "profile",
    "email",
    "account-api",
  ]);
  assert.equal(account.redirectUri, "kitezh://oauth/callback");
  assert.equal(admin.clientId, "mobile-admin-console");
  assert.deepEqual(admin.scopes, ["openid", "profile", "email", "admin-api"]);
  assert.equal(admin.redirectUri, "kitezh://admin/oauth/callback");
  assert.notEqual(sessionStorageKey("account"), sessionStorageKey("admin"));
});

test("mobile issuer overrides are limited to local development servers", () => {
  assert.equal(
    resolveAuthorizationServerIssuer(undefined, false),
    DEFAULT_AUTHORIZATION_SERVER_ISSUER,
  );
  assert.equal(
    resolveAuthorizationServerIssuer("http://localhost:9090/", true),
    "http://localhost:9090",
  );
  assert.equal(
    resolveAuthorizationServerIssuer("http://10.0.2.2:8080", true),
    "http://10.0.2.2:8080",
  );
  assert.equal(
    resolveAuthorizationServerIssuer("http://10.0.2.2:8082", true),
    "http://10.0.2.2:8082",
  );
  assert.equal(
    resolveAuthorizationServerIssuer(
      DEFAULT_AUTHORIZATION_SERVER_ISSUER,
      false,
    ),
    DEFAULT_AUTHORIZATION_SERVER_ISSUER,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("https://unapproved.example", false),
    /authorization_server_issuer_override_not_allowed/,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("https://unapproved.example", true),
    /authorization_server_issuer_invalid/,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("http://localhost:9090/path", true),
    /authorization_server_issuer_invalid/,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("http://10.0.2.3:8080", true),
    /authorization_server_issuer_invalid/,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("http://10.0.2.2:8100", true),
    /authorization_server_issuer_invalid/,
  );
  assert.throws(
    () => resolveAuthorizationServerIssuer("not a URL", true),
    /authorization_server_issuer_invalid/,
  );
});

test("production config fails closed when an unapproved issuer is configured", () => {
  const mobileRoot = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      "await import('./src/config.ts')",
    ],
    {
      cwd: path.resolve(mobileRoot),
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER: "https://unapproved.example",
        NODE_ENV: "production",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /authorization_server_issuer_override_not_allowed/,
  );
  assert.doesNotMatch(result.stderr, /unapproved\.example/);
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
  assert.deepEqual(problemFieldErrors({ problem }), {
    email: "Enter a valid email address.",
  });
  assert.equal(classifyApiError(401), "unauthorized");
  assert.equal(classifyApiError(403), "forbidden");
  assert.equal(classifyApiError(409), "conflict");
  assert.equal(classifyApiError(429), "rate-limited");
  assert.equal(classifyApiError(503), "unavailable");
  assert.equal(
    classifyApiError(0, new DOMException("timeout", "AbortError")),
    "cancelled",
  );
  assert.equal(
    classifyApiError(0, new DOMException("timeout", "TimeoutError")),
    "timeout",
  );
  assert.equal(classifyApiError(0, new Error("network")), "offline");
});

test("shared API contract parses Retry-After seconds and HTTP dates", () => {
  const now = Date.parse("2026-10-12T10:00:00.000Z");
  assert.equal(parseRetryAfterMs("3", now), 3_000);
  assert.equal(parseRetryAfterMs("Mon, 12 Oct 2026 10:00:05 GMT", now), 5_000);
  assert.equal(parseRetryAfterMs("invalid", now), undefined);
  assert.equal(readRetryAfterHeader({ "Retry-After": "4" }), "4");
  assert.equal(readRetryAfterHeader(new Headers({ "Retry-After": "6" })), "6");
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
  assert.throws(
    () =>
      validateAuthorizationCallback(
        {
          error: "access_denied",
          code: "one-time-code",
          state: "request-state",
        },
        "request-state",
      ),
    /authorization_callback_error/,
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
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://user@oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://@oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      " kitezh://oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://oauth:444/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://oauth/callback#fragment",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://oauth/callback#",
      "kitezh://oauth/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "kitezh://oauth/callback",
      "kitezh://oauth:444/callback",
    ),
    false,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "https://kitezh.onrender.com/oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    true,
  );
  assert.equal(
    isAllowedNativeRedirect(
      "https://attacker.example/oauth/callback?code=redacted",
      "kitezh://oauth/callback",
    ),
    false,
  );
});

test("native authorization metadata requires a trusted issuer and endpoints", () => {
  const discovery = {
    issuer: "https://issuer.example.test",
    authorizationEndpoint: "https://issuer.example.test/oauth2/authorize",
    tokenEndpoint: "https://issuer.example.test/oauth2/token",
    endSessionEndpoint: "https://issuer.example.test/connect/logout",
  };
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "kitezh://oauth/callback",
      discovery,
    ),
    true,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      " ",
      "kitezh://oauth/callback",
      discovery,
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "https://attacker.example/callback",
      discovery,
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "kitezh://oauth/callback",
      { ...discovery, tokenEndpoint: "http://issuer.example.test/token" },
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "kitezh://oauth/callback",
      { ...discovery, issuer: "https://other.example.test" },
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "kitezh://oauth/callback",
      {
        ...discovery,
        authorizationEndpoint: "https://attacker.example/authorize",
      },
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "https://issuer.example.test",
      "mobile-account-console",
      "kitezh://oauth/callback?state=unexpected",
      discovery,
    ),
    false,
  );
  const androidFixtureDiscovery = {
    issuer: "http://10.0.2.2:8080",
    authorizationEndpoint: "http://10.0.2.2:8080/oauth2/authorize",
    tokenEndpoint: "http://10.0.2.2:8080/oauth2/token",
    endSessionEndpoint: "http://10.0.2.2:8080/connect/logout",
  };
  assert.equal(
    validateNativeAuthorizationConfig(
      "http://10.0.2.2:8080",
      "mobile-account-console",
      "kitezh://oauth/callback",
      androidFixtureDiscovery,
    ),
    false,
  );
  assert.equal(
    validateNativeAuthorizationConfig(
      "http://10.0.2.2:8080",
      "mobile-account-console",
      "kitezh://oauth/callback",
      androidFixtureDiscovery,
      true,
    ),
    true,
  );
});

test("native deep links accept only registered routes", () => {
  assert.deepEqual(
    parseNativeDeepLink(
      "kitezh://verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    {
      kind: "verify-email",
      token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    },
  );
  assert.deepEqual(
    parseNativeDeepLink(
      "kitezh://confirm-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    {
      kind: "confirm-email",
      token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    },
  );
  assert.deepEqual(parseNativeDeepLink("kitezh://oauth/callback"), {
    kind: "oauth-callback",
  });
  assert.deepEqual(parseNativeDeepLink("kitezh://logout/callback"), {
    kind: "logout-callback",
  });
  assert.deepEqual(parseNativeDeepLink("kitezh://admin/oauth/callback"), {
    kind: "admin-oauth-callback",
  });
  assert.deepEqual(parseNativeDeepLink("kitezh://admin/logout/callback"), {
    kind: "admin-logout-callback",
  });
  assert.equal(
    parseNativeDeepLink(
      "https://kitezh.onrender.com/verify-email?token=secret",
    ),
    null,
  );
  assert.deepEqual(
    parseNativeDeepLink(
      "https://kitezh.onrender.com/verify-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    {
      kind: "verify-email",
      token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    },
  );
  assert.deepEqual(
    parseNativeDeepLink(
      "https://kitezh.onrender.com/confirm-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    {
      kind: "confirm-email",
      token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    },
  );
  assert.deepEqual(
    parseNativeDeepLink("https://kitezh.onrender.com/admin/oauth/callback"),
    { kind: "admin-oauth-callback" },
  );
  assert.deepEqual(
    parseNativeDeepLink("https://kitezh.onrender.com/logout/callback"),
    { kind: "logout-callback" },
  );
  assert.deepEqual(
    parseNativeDeepLink("https://kitezh.onrender.com/admin/logout/callback"),
    { kind: "admin-logout-callback" },
  );
  assert.equal(
    parseNativeDeepLink(
      "https://kitezh.onrender.com.attacker.example/verify-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(
    parseNativeDeepLink(
      "https://kitezh.onrender.com:443/verify-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(
    parseNativeDeepLink(
      "https://kitezh.onrender.com/verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(parseNativeDeepLink("kitezh://verify-email/"), null);
  assert.equal(parseNativeDeepLink("kitezh://verify-email/?token=short"), null);
  assert.equal(
    parseNativeDeepLink(
      "kitezh://verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(
    parseNativeDeepLink(
      "kitezh://user@verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(
    parseNativeDeepLink(
      "kitezh://verify-email:444/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    null,
  );
  assert.equal(
    parseNativeDeepLink(
      "kitezh://verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG#fragment",
    ),
    null,
  );
});

test("native intent routes registered callback links without callback parameters", () => {
  assert.equal(
    resolveNativeIntentPath("kitezh://oauth/callback?code=secret&state=state"),
    "/oauth/callback",
  );
  assert.equal(
    resolveNativeIntentPath(
      "kitezh://admin/oauth/callback?code=secret&state=state",
    ),
    "/admin/oauth/callback",
  );
  assert.equal(
    resolveNativeIntentPath("kitezh://logout/callback"),
    "/logout/callback",
  );
  assert.equal(
    resolveNativeIntentPath("https://example.com/oauth/callback"),
    null,
  );
  assert.equal(
    resolveNativeIntentPath(
      "https://kitezh.onrender.com/reset-password?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    "/reset-password?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  );
  assert.equal(
    resolveNativeIntentPath(
      "https://kitezh.onrender.com/oauth/callback?code=secret&state=private",
    ),
    "/oauth/callback",
  );
  assert.equal(
    resolveNativeIntentPath(
      "https://kitezh.onrender.com/admin/logout/callback?state=private",
    ),
    "/admin/logout/callback",
  );
  assert.equal(
    resolveNativeIntentPath(
      "kitezh://verify-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    "/verify-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  );
  assert.equal(
    resolveNativeIntentPath(
      "kitezh://confirm-email/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    ),
    "/confirm-email?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  );
  assert.equal(
    resolveNativeIntentPath(
      "kitezh://reset-password/?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&state=private",
    ),
    "/reset-password?token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  );
});

test("session refresh operations are single-flight and recover after completion", async () => {
  assert.equal(NATIVE_REFRESH_EXPIRY_SKEW_MS, 60_000);
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
