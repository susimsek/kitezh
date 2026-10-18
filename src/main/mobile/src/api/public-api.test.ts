import assert from "node:assert/strict";
import test from "node:test";
import { installAxiosFetchMockCompatibility } from "../testing/axios-fetch-mock.ts";
import {
  PublicApiError,
  getCaptchaSettings,
  getMobileAuthCapabilities,
  getLoginCaptchaSettings,
  getMobileLoginMfaSetup,
  getMobileLoginPasskeyRegistrationOptions,
  getMobileLoginRecoveryCodes,
  getLatestReleaseMetadata,
  getSocialProviders,
  confirmEmail,
  startMobileLogin,
  startMobileGoogleLogin,
  startMobilePasskeyLogin,
  verifyMobilePasskeyLogin,
  registerMobileLoginPasskey,
  submitMobileLoginAction,
  submitMobileLoginConsent,
  submitMobileLoginMfa,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./public-api.ts";
import { setMobileApiLocale } from "../i18n/api-locale.ts";

installAxiosFetchMockCompatibility();

test("discovers versioned mobile authentication capabilities", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  const capabilities = {
    contractVersion: 1,
    capabilities: [
      "authorization_code_pkce",
      "native_password_login",
      "native_social_account_link",
    ],
  };
  globalThis.fetch = async (input) => {
    requestedPath = new URL(input.toString()).pathname;
    return new Response(JSON.stringify(capabilities), { status: 200 });
  };

  try {
    assert.deepEqual(await getMobileAuthCapabilities(), capabilities);
    assert.equal(requestedPath, "/api/auth/mobile/capabilities");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("posts an explicit native OAuth consent decision and validates its continuation", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(input.toString()).pathname,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify({
        status: "consent_required",
        transactionId: "opaque-transaction",
        clientName: "Kitezh Account",
        scopes: [
          {
            name: "profile",
            displayName: "Profile",
            description: "Read your profile",
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    assert.deepEqual(
      await submitMobileLoginConsent("opaque-transaction", true),
      {
        status: "consent_required",
        transactionId: "opaque-transaction",
        clientName: "Kitezh Account",
        scopes: [
          {
            name: "profile",
            displayName: "Profile",
            description: "Read your profile",
          },
        ],
      },
    );
    assert.deepEqual(requests, [
      {
        path: "/api/auth/mobile/login/opaque-transaction/consent",
        body: { approved: true },
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed mobile authentication capability contracts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ contractVersion: 0, capabilities: [false] }),
      {
        status: 200,
      },
    );

  try {
    await assert.rejects(getMobileAuthCapabilities(), (error: unknown) => {
      assert.ok(error instanceof PublicApiError);
      assert.equal(error.status, 502);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes capability, release, and social discovery failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(input.toString()).pathname;
    return new Response(JSON.stringify({ title: `${path} unavailable` }), {
      status: 503,
      headers: { "Retry-After": "3" },
    });
  };

  try {
    await assert.rejects(
      getMobileAuthCapabilities(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 503 &&
        error.retryAfterMs === 3_000,
    );
    await assert.rejects(
      getLatestReleaseMetadata(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 503 &&
        error.message === "Release metadata request failed",
    );
    await assert.rejects(
      getSocialProviders(),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 503,
    );

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ providers: [] }), { status: 200 });
    await assert.rejects(
      getSocialProviders(),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 502,
    );

    globalThis.fetch = async () => {
      throw new TypeError("private network detail");
    };
    await assert.rejects(
      getMobileAuthCapabilities(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.message === "Mobile authentication capabilities unavailable",
    );
    await assert.rejects(
      getLatestReleaseMetadata(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.message === "Release metadata request failed",
    );
    await assert.rejects(
      getSocialProviders(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.message === "Social provider discovery unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reads the shared cached application release metadata endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const metadata = {
    tag: "v0.1.5",
    version: "0.1.5",
    releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.5",
    assets: {
      androidApk:
        "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-android.apk",
      iosUnsignedIpa:
        "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-ios-unsigned.ipa",
    },
  };
  let requestedPath = "";
  globalThis.fetch = async (input) => {
    requestedPath = new URL(input.toString()).pathname;
    return new Response(JSON.stringify(metadata), { status: 200 });
  };

  try {
    assert.deepEqual(await getLatestReleaseMetadata(), metadata);
    assert.equal(requestedPath, "/api/public/app-release");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("captcha settings accepts only a boolean enabled value", async () => {
  const originalFetch = globalThis.fetch;
  const values = [
    {
      enabled: true,
      nativeRequired: true,
      nativeEnabled: true,
      siteKey: "",
      action: "register",
    },
    {
      enabled: "true",
      nativeRequired: true,
      nativeEnabled: true,
      siteKey: "",
      action: "register",
    },
  ];
  globalThis.fetch = async () =>
    new Response(JSON.stringify(values.shift()), { status: 200 });

  try {
    assert.deepEqual(await getCaptchaSettings(), {
      enabled: true,
      nativeRequired: true,
      nativeEnabled: true,
      provider: "",
      siteKey: "",
      action: "register",
      recaptchaV3: false,
      useRecaptchaNet: false,
      androidSiteKey: "",
      iosSiteKey: "",
    });
    await assert.rejects(
      getCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 502 &&
        error.kind === "unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("social provider discovery returns typed server aliases and filters malformed entries", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  globalThis.fetch = async (input) => {
    requestedPath = new URL(input.toString()).pathname;
    return new Response(
      JSON.stringify([
        {
          provider: "google",
          providerType: "oauth",
          iconKey: "google",
          configured: true,
        },
        { provider: "bad alias", configured: true },
      ]),
      { status: 200 },
    );
  };

  try {
    assert.deepEqual(await getSocialProviders({ locale: "tr" }), [
      {
        provider: "google",
        providerType: "oauth",
        iconKey: "google",
        configured: true,
      },
    ]);
    assert.equal(requestedPath, "/api/auth/social-providers");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mobile login posts PKCE credentials and validates the authorization response", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; body: unknown; locale: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(input.toString()).pathname,
      body: JSON.parse(String(init?.body)),
      locale: new Headers(init?.headers).get("Accept-Language"),
    });
    const body =
      requests.length === 1
        ? { status: "mfa_required", transactionId: "transaction-1" }
        : requests.length === 2
          ? {
              status: "required_actions",
              transactionId: "transaction-1",
              actions: [
                {
                  key: "UPDATE_PASSWORD",
                  displayName: "Update password",
                  description: "Choose a new password",
                  version: 1,
                },
              ],
            }
          : {
              status: "authorized",
              code: "authorization-code",
              state: "request-state",
              redirectUri: "kitezh://oauth/callback",
            };
    return new Response(JSON.stringify(body), { status: 200 });
  };

  try {
    const loginRequest = {
      platform: "IOS" as const,
      clientId: "mobile-account",
      redirectUri: "kitezh://oauth/callback",
      scope: "openid account-api",
      state: "request-state",
      codeChallenge: "pkce-challenge",
      codeChallengeMethod: "S256" as const,
      nonce: "oidc-nonce",
      username: "alice",
      password: "password-value",
      captchaToken: null,
    };
    assert.deepEqual(await startMobileLogin(loginRequest, { locale: "tr" }), {
      status: "mfa_required",
      transactionId: "transaction-1",
    });
    assert.deepEqual(await submitMobileLoginMfa("transaction-1", "123456"), {
      status: "required_actions",
      transactionId: "transaction-1",
      actions: [
        {
          key: "UPDATE_PASSWORD",
          displayName: "Update password",
          description: "Choose a new password",
          version: 1,
        },
      ],
    });
    assert.deepEqual(
      await submitMobileLoginAction("transaction-1", "UPDATE_PASSWORD", {
        newPassword: "a-long-password",
      }),
      {
        status: "authorized",
        code: "authorization-code",
        state: "request-state",
        redirectUri: "kitezh://oauth/callback",
      },
    );
    assert.deepEqual(
      requests.map(({ path }) => path),
      [
        "/api/auth/mobile/login",
        "/api/auth/mobile/login/transaction-1/mfa",
        "/api/auth/mobile/login/transaction-1/actions/UPDATE_PASSWORD",
      ],
    );
    assert.deepEqual(requests[0]?.body, loginRequest);
    assert.equal(requests[0]?.locale, "tr");
    assert.deepEqual(requests[1]?.body, { code: "123456" });
    assert.deepEqual(requests[2]?.body, {
      values: { newPassword: "a-long-password" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("native Google login sends its one-time code through the S256 mobile endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: { path: string; body: Record<string, unknown> } | undefined;
  globalThis.fetch = async (input, init) => {
    request = {
      path: new URL(input.toString()).pathname,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    };
    return new Response(
      JSON.stringify({
        status: "authorized",
        code: "kitezh-code",
        state: "state_12345678901234567890123456789012",
        redirectUri: "kitezh://oauth/callback",
      }),
      { status: 200 },
    );
  };

  try {
    const response = await startMobileGoogleLogin(
      {
        platform: "IOS",
        clientId: "mobile-account-console",
        redirectUri: "kitezh://oauth/callback",
        scope: "openid account-api",
        state: "state_12345678901234567890123456789012",
        codeChallenge: "A".repeat(43),
        codeChallengeMethod: "S256",
        nonce: "nonce_1234567890123456",
        idToken: "signed-google-id-token",
      },
      { locale: "tr", mobilePlatform: "IOS" },
    );
    assert.equal(request?.path, "/api/auth/mobile/login/google");
    assert.equal(request?.body.idToken, "signed-google-id-token");
    assert.equal(response.status, "authorized");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("native passkey login and enrollment use transaction-bound endpoint payloads", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(input.toString()).pathname;
    requests.push({ path, body: JSON.parse(String(init?.body)) });
    const body =
      requests.length === 1
        ? {
            status: "passkey_required",
            transactionId: "passkey-tx",
            publicKey: { challenge: "assertion-challenge" },
          }
        : requests.length === 2 || requests.length === 4
          ? {
              status: "authorized",
              code: "authorization-code",
              state: "original-state",
              redirectUri: "kitezh://oauth/callback",
            }
          : { publicKey: { challenge: "registration-challenge" } };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const credential = {
    id: "credential-id",
    rawId: "credential-id",
    type: "public-key" as const,
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: { clientDataJSON: "client-data", signature: "proof" },
  } as never;
  const pkce = {
    platform: "IOS" as const,
    clientId: "mobile-account-console",
    redirectUri: "kitezh://oauth/callback",
    scope: "openid account-api",
    state: "original-state",
    codeChallenge: "a".repeat(43),
    codeChallengeMethod: "S256" as const,
    nonce: "n".repeat(20),
    username: "alice",
  };

  try {
    const challenge = await startMobilePasskeyLogin(pkce, { locale: "tr" });
    assert.equal(challenge.status, "passkey_required");
    if (challenge.status !== "passkey_required") assert.fail();
    assert.deepEqual(challenge.publicKey, { challenge: "assertion-challenge" });
    assert.equal(
      (await verifyMobilePasskeyLogin("passkey-tx", credential)).status,
      "authorized",
    );
    assert.deepEqual(
      await getMobileLoginPasskeyRegistrationOptions(
        "action-tx",
        "CONFIGURE_PASSKEY",
      ),
      { challenge: "registration-challenge" },
    );
    assert.equal(
      (
        await registerMobileLoginPasskey(
          "action-tx",
          "CONFIGURE_PASSKEY",
          credential,
          "My phone",
        )
      ).status,
      "authorized",
    );
    assert.deepEqual(
      requests.map(({ path }) => path),
      [
        "/api/auth/mobile/login/passkey/begin",
        "/api/auth/mobile/login/passkey-tx/passkey/verify",
        "/api/auth/mobile/login/action-tx/actions/CONFIGURE_PASSKEY/passkey/options",
        "/api/auth/mobile/login/action-tx/actions/CONFIGURE_PASSKEY/passkey/register",
      ],
    );
    assert.deepEqual(requests[0]?.body, pkce);
    assert.deepEqual(requests[1]?.body, { credential });
    assert.deepEqual(requests[3]?.body, { credential, label: "My phone" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login CAPTCHA settings are validated and fail closed on malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        enabled: true,
        nativeRequired: true,
        nativeEnabled: true,
        provider: "recaptcha",
        siteKey: "public-site-key",
        action: "login",
        recaptchaV3: true,
        useRecaptchaNet: false,
        androidSiteKey: "android-key",
        iosSiteKey: "ios-key",
      }),
      { status: 200 },
    );
  try {
    assert.deepEqual(await getLoginCaptchaSettings(), {
      enabled: true,
      nativeRequired: true,
      nativeEnabled: true,
      provider: "recaptcha",
      siteKey: "public-site-key",
      action: "login",
      recaptchaV3: true,
      useRecaptchaNet: false,
      androidSiteKey: "android-key",
      iosSiteKey: "ios-key",
    });
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ enabled: false }), { status: 200 });
    await assert.rejects(
      getLoginCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 502,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mobile TOTP and recovery code setup use transaction-bound endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; method?: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(input.toString()).pathname;
    requests.push({ path, method: init?.method });
    return new Response(
      JSON.stringify(
        path.endsWith("CONFIGURE_TOTP/setup")
          ? {
              secret: "JBSWY3DPEHPK3PXP",
              qrCode: "data:image/png;base64,abc",
              algorithm: "SHA1",
              digits: 6,
              periodSeconds: 30,
            }
          : { codes: ["ABCD-EFGH"], remaining: 1 },
      ),
      { status: 200 },
    );
  };
  try {
    assert.deepEqual(
      await getMobileLoginMfaSetup("transaction-1", { locale: "tr" }),
      {
        secret: "JBSWY3DPEHPK3PXP",
        qrCode: "data:image/png;base64,abc",
        algorithm: "SHA1",
        digits: 6,
        periodSeconds: 30,
      },
    );
    assert.deepEqual(await getMobileLoginRecoveryCodes("transaction-1"), {
      codes: ["ABCD-EFGH"],
      remaining: 1,
    });
    assert.deepEqual(requests, [
      {
        path: "/api/auth/mobile/login/transaction-1/actions/CONFIGURE_TOTP/setup",
        method: "POST",
      },
      {
        path: "/api/auth/mobile/login/transaction-1/actions/RECOVERY_CODES/setup",
        method: "POST",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed mobile login setup and consent responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({}), { status: 200 });

  try {
    await assert.rejects(
      getMobileLoginMfaSetup("transaction-1"),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 502,
    );
    await assert.rejects(
      getMobileLoginRecoveryCodes("transaction-1"),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 502,
    );

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "denied",
          state: "state-1234",
          redirectUri: "kitezh://callback",
        }),
        { status: 200 },
      );
    assert.deepEqual(await submitMobileLoginConsent("transaction-1", false), {
      status: "denied",
      state: "state-1234",
      redirectUri: "kitezh://callback",
    });

    globalThis.fetch = async () => new Response("null", { status: 200 });
    await assert.rejects(
      submitMobileLoginConsent("transaction-1", true),
      (error: unknown) =>
        error instanceof PublicApiError && error.status === 502,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public account mutations send localized JSON requests to their endpoints", async () => {
  setMobileApiLocale("tr");
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
    assert.equal(await confirmEmail("confirm-token"), undefined);

    assert.deepEqual(
      requests.map(({ url, init }) => ({
        path: new URL(url).pathname,
        method: init?.method,
        locale: new Headers(init?.headers).get("Accept-Language"),
        appName: new Headers(init?.headers).get("App-Name"),
        appVersion: new Headers(init?.headers).get("App-Version"),
        clientPlatform: new Headers(init?.headers).get("Client-Platform"),
        os: new Headers(init?.headers).get("OS"),
        body: init?.body,
      })),
      [
        {
          path: "/api/auth/register",
          method: "POST",
          locale: "tr",
          appName: "Kitezh",
          appVersion: "v0.1.0",
          clientPlatform: "android",
          os: "android",
          body: JSON.stringify(registration),
        },
        {
          path: "/api/auth/forgot-password",
          method: "POST",
          locale: "tr",
          appName: "Kitezh",
          appVersion: "v0.1.0",
          clientPlatform: "android",
          os: "android",
          body: JSON.stringify({ identifier: "new@example.com", locale: "tr" }),
        },
        {
          path: "/api/auth/reset-password",
          method: "POST",
          locale: "tr",
          appName: "Kitezh",
          appVersion: "v0.1.0",
          clientPlatform: "android",
          os: "android",
          body: JSON.stringify({
            token: "reset-token",
            newPassword: "new-secret",
            otpCode: "123456",
          }),
        },
        {
          path: "/api/auth/verify-email",
          method: "POST",
          locale: "tr",
          appName: "Kitezh",
          appVersion: "v0.1.0",
          clientPlatform: "android",
          os: "android",
          body: JSON.stringify({ token: "email-token" }),
        },
        {
          path: "/api/auth/confirm-email",
          method: "POST",
          locale: "tr",
          appName: "Kitezh",
          appVersion: "v0.1.0",
          clientPlatform: "android",
          os: "android",
          body: JSON.stringify({ token: "confirm-token" }),
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

test("public auth requests forward cancellation and timeout controls", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (_input, init) => {
    requestSignal = init?.signal;
    return new Response(null, { status: 204 });
  };

  try {
    await verifyEmail("one-time-token", {
      signal: controller.signal,
      timeoutMs: 3210,
    });
    assert.ok(requestSignal instanceof AbortSignal);
    assert.equal(controller.signal.aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public auth requests distinguish caller cancellation from timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(init?.signal?.aborted, true);
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  };

  try {
    const controller = new AbortController();
    const cancelled = verifyEmail("one-time-token", {
      signal: controller.signal,
      timeoutMs: 1000,
    });
    controller.abort();
    await assert.rejects(
      cancelled,
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.kind === "cancelled",
    );
    await assert.rejects(
      verifyEmail("one-time-token", { timeoutMs: 5 }),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 0 &&
        error.kind === "timeout",
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
        error.status === 503 &&
        error.kind === "unavailable",
    );

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(
      getCaptchaSettings(),
      (error: unknown) =>
        error instanceof PublicApiError &&
        error.status === 502 &&
        error.kind === "unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
