import assert from "node:assert/strict";
import test from "node:test";

import {
  getCaptchaSettings,
  getSocialProviders,
  PublicApiError,
  registerAccount,
} from "./public-api.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("social provider discovery filters malformed records and unapproved icons", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        { provider: "google", providerType: "google", iconKey: "google", configured: true },
        { provider: "external", providerType: "oidc", iconKey: "https://bad", configured: true },
        { provider: "bad alias/../path", providerType: "oidc", iconKey: "generic", configured: true },
      ]),
      { status: 200 },
    );

  assert.deepEqual(await getSocialProviders(), [
    { provider: "google", providerType: "google", iconKey: "google", configured: true },
  ]);
});

test("public API keeps server status and Retry-After for CAPTCHA failures", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: 429, detail: "slow down" }), {
      headers: { "Retry-After": "12" },
      status: 429,
    });

  await assert.rejects(getCaptchaSettings(), (error: unknown) =>
    error instanceof PublicApiError &&
    error.status === 429 &&
    error.kind === "rate-limited" &&
    error.retryAfterSeconds === 12,
  );
});

test("public API request timeout is classified without exposing request data", async () => {
  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });

  await assert.rejects(
    registerAccount({
      username: "sensitive-user",
      firstName: "A",
      lastName: "B",
      email: "private@example.com",
      password: "secret-password",
      confirmPassword: "secret-password",
      locale: "en",
    }, { timeoutMs: 1 }),
    (error: unknown) =>
      error instanceof PublicApiError &&
      error.kind === "timeout" &&
      !error.message.includes("secret-password") &&
      !error.message.includes("private@example.com"),
  );
});

test("CAPTCHA settings require an explicit boolean response", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ enabled: "yes" }), { status: 200 });
  await assert.rejects(getCaptchaSettings(), (error: unknown) =>
    error instanceof PublicApiError && error.status === 502,
  );
});
