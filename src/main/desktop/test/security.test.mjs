import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

import {
  exchangeAuthorizationCode,
  isPendingAuthorizationValid,
  parseAuthCallback,
  parseLogoutCallback,
  parsePendingAuthorizationStore,
  sanitizedAuthCallback,
} from "../dist/security/auth-flow.js";
import {
  getApiBaseUrl,
  findDesktopDeepLink,
  isAllowedExternalUrl,
} from "../dist/config.js";
import {
  isTrustedRendererFrame,
  isTrustedRendererUrl,
} from "../dist/security/origin-policy.js";
import { registerGlobalShortcutWithFallback } from "../dist/security/global-shortcut.js";
import { redactDiagnosticText } from "../dist/security/diagnostics.js";
import {
  readPendingAuthorizationStore,
  writePendingAuthorizationStore,
} from "../dist/security/auth-transaction-vault.js";

test("redacts credentials, personal paths, and email addresses from diagnostics", () => {
  const sanitized = redactDiagnosticText(
    'access_token=access-secret "refreshToken":"refresh-secret" https://kitezh.onrender.com/callback?code=auth-secret /Users/alice/private/report.txt alice@example.com',
  );

  assert.doesNotMatch(sanitized, /access-secret|refresh-secret|auth-secret/);
  assert.doesNotMatch(sanitized, /\/Users\/alice|alice@example\.com/);
  assert.match(sanitized, /access_token=\[redacted\]/);
  assert.match(sanitized, /"refreshToken":"\[redacted\]"/);
  assert.match(sanitized, /https:\/\/kitezh\.onrender\.com\/callback/);
  assert.match(sanitized, /\[user-path\] \[email\]/);
  assert.equal(redactDiagnosticText("x".repeat(501)).length, 500);
});

test("preserves an initial desktop protocol callback on first launch", () => {
  assert.equal(
    findDesktopDeepLink(["electron", "kitezh://oauth/callback?state=state"]),
    "kitezh://oauth/callback?state=state",
  );
  assert.equal(findDesktopDeepLink(["electron", "--no-sandbox"]), null);
});

test("accepts only the expected desktop callback route", () => {
  assert.deepEqual(
    parseAuthCallback("kitezh://oauth/callback?state=state-1&code=code-1"),
    { state: "state-1", code: "code-1", error: null },
  );
  assert.deepEqual(
    parseAuthCallback(
      "kitezh://oauth/callback#state=state-2&error=access_denied",
    ),
    { state: "state-2", code: null, error: "access_denied" },
  );
  assert.equal(parseAuthCallback("kitezh://other/callback?state=state"), null);
  assert.equal(
    parseAuthCallback("https://example.test/callback?state=state"),
    null,
  );
});

test("accepts only the exact native logout callback", () => {
  assert.equal(parseLogoutCallback("kitezh://logout/callback"), true);
  assert.equal(parseLogoutCallback("kitezh://oauth/callback"), false);
  assert.equal(
    parseLogoutCallback("kitezh://logout/callback?state=unexpected"),
    false,
  );
  assert.equal(
    parseLogoutCallback("https://example.com/logout/callback"),
    false,
  );
});

test("sanitizes callback data before sending it to the renderer", () => {
  assert.equal(
    sanitizedAuthCallback("state-1"),
    "kitezh://oauth/callback?state=state-1",
  );
});

test("rejects stale or mismatched authorization state", () => {
  const pending = {
    state: "state-1",
    codeVerifier: "verifier",
    clientId: "desktop-admin-console",
    redirectUri: "kitezh://oauth/callback",
    createdAt: 10_000,
  };
  assert.equal(isPendingAuthorizationValid(pending, "state-1", 10_001), true);
  assert.equal(isPendingAuthorizationValid(pending, "other", 10_001), false);
  assert.equal(isPendingAuthorizationValid(pending, "state-1", 310_001), false);
});

test("restores only fresh, console-bound PKCE transactions", () => {
  const now = 120_000;
  const valid = {
    state: "0123456789abcdef",
    codeVerifier: "v".repeat(43),
    clientId: "desktop-admin-console",
    redirectUri: "kitezh://oauth/callback",
    createdAt: now - 1_000,
  };

  assert.deepEqual(
    parsePendingAuthorizationStore(
      {
        admin: valid,
        account: {
          ...valid,
          clientId: "desktop-admin-console",
        },
        expired: valid,
      },
      now,
    ),
    { admin: valid },
  );
  assert.deepEqual(
    parsePendingAuthorizationStore(
      { admin: { ...valid, createdAt: now - 5 * 60 * 1000 } },
      now,
    ),
    {},
  );
});

test("persists PKCE transactions encrypted and restores them after restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kitezh-auth-vault-"));
  const file = path.join(directory, "pending.bin");
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  };
  const pending = {
    state: "0123456789abcdef",
    codeVerifier: "pkce-verifier-secret-".padEnd(43, "x"),
    clientId: "desktop-account-console",
    redirectUri: "kitezh://oauth/callback",
    createdAt: 119_000,
  };

  try {
    await writePendingAuthorizationStore(file, { account: pending }, storage);
    const onDisk = await readFile(file, "utf8");
    assert.doesNotMatch(onDisk, /pkce-verifier-secret/);
    assert.deepEqual(
      await readPendingAuthorizationStore(file, storage, 120_000),
      { account: pending },
    );
    assert.deepEqual(
      await readPendingAuthorizationStore(file, storage, 420_000),
      {},
    );
    await writePendingAuthorizationStore(file, {}, storage);
    await assert.rejects(readFile(file), { code: "ENOENT" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("exchanges the authorization code with PKCE and validates the token response", async () => {
  let request;
  const fetcher = async (url, init) => {
    request = { url, init };
    return new Response(
      JSON.stringify({
        access_token: "access",
        expires_in: 60,
        refresh_token: "refresh",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const tokens = await exchangeAuthorizationCode(
    fetcher,
    "https://example.test",
    {
      state: "state",
      codeVerifier: "verifier",
      clientId: "desktop-admin-console",
      redirectUri: "kitezh://oauth/callback",
      createdAt: Date.now(),
    },
    "code",
  );
  assert.equal(request.url, "https://example.test/oauth2/token");
  assert.match(request.init.body.toString(), /code_verifier=verifier/);
  assert.equal(tokens.accessToken, "access");
  assert.equal(tokens.refreshToken, "refresh");
});

test("trusts only the packaged renderer origin", () => {
  assert.equal(isTrustedRendererUrl("app://renderer/"), true);
  assert.equal(isTrustedRendererFrame("app://renderer/admin/"), true);
  assert.equal(isTrustedRendererUrl("app://renderer.evil/"), false);
  assert.equal(isTrustedRendererFrame("https://example.test/"), false);
  assert.equal(isTrustedRendererFrame(undefined), false);
});

test("accepts only configured API and external origins", () => {
  assert.equal(getApiBaseUrl("http://localhost:9090"), "http://localhost:9090");
  assert.equal(
    getApiBaseUrl("https://kitezh.onrender.com"),
    "https://kitezh.onrender.com",
  );
  assert.throws(
    () => getApiBaseUrl("https://example.test"),
    /deployed Render host/,
  );
  assert.equal(isAllowedExternalUrl("https://github.com/example/oauth"), true);
  assert.equal(isAllowedExternalUrl("https://evil.example/oauth"), false);
  assert.equal(isAllowedExternalUrl("javascript:alert(1)"), false);
});

test("restores the default quick-access shortcut when a custom shortcut conflicts", () => {
  const attempts = [];
  const adapter = {
    unregisterAll() {},
    register(accelerator) {
      attempts.push(accelerator);
      return accelerator === "Alt+Space";
    },
  };

  assert.deepEqual(
    registerGlobalShortcutWithFallback(
      adapter,
      "CommandOrControl+Shift+K",
      "Alt+Space",
      () => {},
    ),
    { registered: false, accelerator: "Alt+Space" },
  );
  assert.deepEqual(attempts, ["CommandOrControl+Shift+K", "Alt+Space"]);
});

test("reports when both the requested and fallback shortcuts are unavailable", () => {
  const adapter = {
    unregisterAll() {},
    register() {
      return false;
    },
  };

  assert.deepEqual(
    registerGlobalShortcutWithFallback(
      adapter,
      "CommandOrControl+Shift+K",
      "Alt+Space",
      () => {},
    ),
    { registered: false, accelerator: "CommandOrControl+Shift+K" },
  );
});
