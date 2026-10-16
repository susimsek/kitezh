import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_API_BASE_URL,
  DESKTOP_PROTOCOL,
  findDesktopDeepLink,
  getApiBaseUrl,
  isAllowedExternalUrl,
} from "../dist/config.js";

test("selects the first Kitezh callback and returns null when absent", () => {
  assert.equal(DESKTOP_PROTOCOL, "kitezh");
  assert.equal(
    findDesktopDeepLink([
      "--unrelated",
      "kitezh://oauth/callback?state=first",
      "kitezh://logout/callback",
    ]),
    "kitezh://oauth/callback?state=first",
  );
  assert.equal(findDesktopDeepLink(["--unrelated"]), null);
});

test("accepts only the deployed API origin and explicit local development origins", () => {
  assert.equal(getApiBaseUrl(), DEFAULT_API_BASE_URL);
  assert.equal(
    getApiBaseUrl(" https://kitezh.onrender.com/ "),
    DEFAULT_API_BASE_URL,
  );
  for (const url of [
    "http://localhost:9090",
    "http://localhost:9091",
    "http://127.0.0.1:9090",
    "http://[::1]:9090",
  ]) {
    assert.equal(getApiBaseUrl(url), url.replace(/\/$/, ""));
  }
  for (const url of [
    "https://example.test",
    "http://kitezh.onrender.com",
    "https://kitezh.onrender.com/api",
    "https://kitezh.onrender.com/?tenant=one",
    "https://kitezh.onrender.com/#fragment",
    "https://user:password@kitezh.onrender.com",
    "file:///tmp/kitezh",
  ]) {
    assert.throws(() => getApiBaseUrl(url), /DESKTOP_API_BASE_URL/, url);
  }
});

test("allows only approved OAuth providers and exact callback destinations", () => {
  const allowed = [
    "https://kitezh.onrender.com/oauth2/authorize?redirect_uri=kitezh%3A%2F%2Foauth%2Fcallback",
    "http://localhost:9090/connect/logout?post_logout_redirect_uri=kitezh%3A%2F%2Flogout%2Fcallback",
    "https://kitezh.onrender.com/account/social-links/google/desktop/authorize?redirect_uri=kitezh%3A%2F%2Fsocial-link%2Fcallback",
    "https://accounts.google.com/o/oauth2/v2/auth",
    "https://github.com/login/oauth/authorize",
    "https://www.github.com/login/oauth/authorize",
    "https://www.linkedin.com/oauth/v2/authorization",
    "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
  ];
  for (const url of allowed) assert.equal(isAllowedExternalUrl(url), true, url);

  const rejected = [
    "not a URL",
    "https://evil.example.test/oauth2/authorize",
    "https://kitezh.onrender.com/oauth2/authorize#fragment",
    "https://user:password@github.com/login/oauth/authorize",
    "https://kitezh.onrender.com/oauth2/authorize?redirect_uri=https%3A%2F%2Fevil.example.test",
    "https://kitezh.onrender.com/oauth2/authorize?redirect_uri=kitezh%3A%2F%2Foauth%2Fcallback&redirect_uri=kitezh%3A%2F%2Foauth%2Fcallback",
    "https://kitezh.onrender.com/connect/logout?post_logout_redirect_uri=kitezh%3A%2F%2Flogout%2Fcallback&post_logout_redirect_uri=kitezh%3A%2F%2Flogout%2Fcallback",
    "https://accounts.google.com/login",
    "https://github.com/",
    "https://www.linkedin.com/login",
    "https://login.microsoftonline.com/not%20allowed/oauth2/v2.0/authorize",
    "http://localhost:9091/oauth2/authorize",
  ];
  for (const url of rejected)
    assert.equal(isAllowedExternalUrl(url), false, url);
});
