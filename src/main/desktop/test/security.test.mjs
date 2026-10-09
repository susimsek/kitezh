import test from "node:test";
import assert from "node:assert/strict";

import {
  exchangeAuthorizationCode,
  isPendingAuthorizationValid,
  parseAuthCallback,
  parseLogoutCallback,
  parseSocialLinkCallback,
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

test("preserves an initial desktop protocol callback on first launch", () => {
  assert.equal(
    findDesktopDeepLink([
      "electron",
      "kitezh://oauth/callback?state=state",
    ]),
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
  assert.equal(
    parseAuthCallback("kitezh://other/callback?state=state"),
    null,
  );
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

test("accepts only a social-link callback without fragment data", () => {
  assert.deepEqual(
    parseSocialLinkCallback(
      "kitezh://social-link/callback?state=state-1&code=completion-1",
    ),
    { state: "state-1", code: "completion-1", error: null },
  );
  assert.deepEqual(
    parseSocialLinkCallback(
      "kitezh://social-link/callback?state=state-2&error=authorization_failed",
    ),
    { state: "state-2", code: null, error: "authorization_failed" },
  );
  assert.equal(
    parseSocialLinkCallback(
      "kitezh://social-link/callback?state=state-1&code=completion-1#fragment",
    ),
    null,
  );
  assert.equal(
    parseSocialLinkCallback("kitezh://oauth/callback?state=state-1"),
    null,
  );
  assert.equal(
    parseSocialLinkCallback("https://example.test/social-link/callback?state=state-1"),
    null,
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
