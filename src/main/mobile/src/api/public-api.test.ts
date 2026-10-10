import assert from "node:assert/strict";
import test from "node:test";

import {
  PublicApiError,
  getCaptchaSettings,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./public-api.ts";

test("captcha settings accepts only a boolean enabled value", async () => {
  const originalFetch = globalThis.fetch;
  const values = [{ enabled: true }, { enabled: "true" }, {}];
  globalThis.fetch = async () =>
    new Response(JSON.stringify(values.shift()), { status: 200 });

  try {
    assert.deepEqual(await getCaptchaSettings(), { enabled: true });
    assert.deepEqual(await getCaptchaSettings(), { enabled: false });
    assert.deepEqual(await getCaptchaSettings(), { enabled: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public account mutations send localized JSON requests to their endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: input.toString(), init });
    return new Response(null, { status: 204 });
  };

  try {
    const registration = {
      username: "new-user",
      firstName: "New",
      lastName: "User",
      email: "new@example.com",
      password: "secret",
      confirmPassword: "secret",
      captchaToken: null,
      locale: "tr",
    };
    assert.equal(await registerAccount(registration), undefined);
    assert.equal(
      await requestPasswordReset("new@example.com", "tr"),
      undefined,
    );
    assert.equal(
      await resetPassword({
        token: "reset-token",
        newPassword: "new-secret",
        otpCode: "123456",
      }),
      undefined,
    );
    assert.equal(await verifyEmail("email-token"), undefined);

    assert.deepEqual(
      requests.map(({ url, init }) => ({
        path: new URL(url).pathname,
        method: init?.method,
        locale: new Headers(init?.headers).get("Accept-Language"),
        body: init?.body,
      })),
      [
        {
          path: "/api/auth/register",
          method: "POST",
          locale: "tr",
          body: JSON.stringify(registration),
        },
        {
          path: "/api/auth/forgot-password",
          method: "POST",
          locale: "tr",
          body: JSON.stringify({ identifier: "new@example.com", locale: "tr" }),
        },
        {
          path: "/api/auth/reset-password",
          method: "POST",
          locale: null,
          body: JSON.stringify({
            token: "reset-token",
            newPassword: "new-secret",
            otpCode: "123456",
          }),
        },
        {
          path: "/api/auth/verify-email",
          method: "POST",
          locale: null,
          body: JSON.stringify({ token: "email-token" }),
        },
      ],
    );
    assert.ok(
      requests.every(
        ({ init }) =>
          new Headers(init?.headers).get("Accept") === "application/json",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public API exposes validation details and tolerates invalid error JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        type: "about:blank",
        title: "Validation failed",
        status: 422,
        detail: "Check the submitted fields",
        violations: [{ field: "email", message: "Invalid email" }, null],
      }),
      { status: 422 },
    );

  try {
    await assert.rejects(
      registerAccount({
        username: "new-user",
        firstName: "New",
        lastName: "User",
        email: "bad",
        password: "secret",
        confirmPassword: "secret",
        locale: "en",
      }),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 422 &&
        error.kind === "validation" &&
        error.problem?.violations?.[0]?.field === "email",
    );

    globalThis.fetch = async () => new Response("not-json", { status: 500 });
    await assert.rejects(
      verifyEmail("token"),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 500 &&
        error.kind === "server" &&
        error.data === undefined,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("captcha and public mutations normalize unavailable network requests", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("private transport detail");
  };

  try {
    await assert.rejects(
      getCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.kind === "offline" &&
        error.message === "Registration CAPTCHA settings unavailable",
    );
    await assert.rejects(
      requestPasswordReset("user@example.com", "en"),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.kind === "offline" &&
        !error.message.includes("private transport detail"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public APIs parse successful JSON and normalize CAPTCHA response errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (input.toString().endsWith("/api/auth/verify-email")) {
      return new Response("created", { status: 201 });
    }
    if (input.toString().endsWith("/api/auth/registration-captcha")) {
      return new Response(JSON.stringify({ title: "Unavailable" }), {
        status: 503,
      });
    }
    return new Response(JSON.stringify({ registered: true }), { status: 200 });
  };

  try {
    assert.deepEqual(
      await registerAccount({
        username: "new-user",
        firstName: "New",
        lastName: "User",
        email: "new@example.com",
        password: "secret",
        confirmPassword: "secret",
        locale: "en",
      }),
      { registered: true },
    );
    assert.equal(await verifyEmail("created-token"), undefined);
    await assert.rejects(
      getCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.message === "Registration CAPTCHA settings unavailable",
    );

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(
      getCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.message === "Registration CAPTCHA settings unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
