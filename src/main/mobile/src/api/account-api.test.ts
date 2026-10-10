import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountApiError,
  changeAccountPassword,
  deleteAccount,
  generateRecoveryCodes,
  getAccountProfile,
  getMfaStatus,
  getRecoveryCodesStatus,
  listAccountApplications,
  listAccountSessions,
  listOfflineSessions,
  listSocialLinks,
  mutateMfa,
  revokeAccountApplication,
  revokeOfflineSession,
  signOutAccountSession,
  signOutOtherAccountSessions,
  startMfaSetup,
  unlinkSocialProvider,
  updateAccountProfile,
} from "./account-api.ts";

test("account requests classify transport failures as offline without leaking details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("private transport detail");
  };

  try {
    await assert.rejects(
      getAccountProfile("access-token"),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.kind === "offline" &&
        !error.message.includes("private transport detail"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account request deadlines surface a typed timeout error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        { once: true },
      );
    });

  try {
    await assert.rejects(
      getAccountProfile("access-token", { timeoutMs: 5 }),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.status === 0 &&
        error.kind === "timeout",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account requests refresh once after an unauthorized response", async () => {
  const originalFetch = globalThis.fetch;
  const authorizationHeaders: string[] = [];
  globalThis.fetch = async (_input, init) => {
    authorizationHeaders.push(
      new Headers(init?.headers).get("Authorization") ?? "",
    );
    if (authorizationHeaders.length === 1) {
      return new Response(null, { status: 401 });
    }
    return new Response(
      JSON.stringify({
        username: "fixture-user",
        firstName: null,
        lastName: null,
        email: null,
        pendingEmail: null,
        emailVerified: false,
        preferredLocale: "en",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }),
      { status: 200 },
    );
  };

  try {
    await getAccountProfile("expired-token", {
      refreshAccessToken: async () => "fresh-token",
    });
    assert.deepEqual(authorizationHeaders, [
      "Bearer expired-token",
      "Bearer fresh-token",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account endpoints use their protected methods, bodies, and encoded resource identifiers", async () => {
  const originalFetch = globalThis.fetch;
  const requests: {
    path: string;
    method?: string;
    body?: BodyInit | null;
  }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path:
        new URL(input.toString()).pathname + new URL(input.toString()).search,
      method: init?.method,
      body: init?.body,
    });
    return new Response(null, { status: 204 });
  };

  try {
    const profile = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    };
    const password = { currentPassword: "old", newPassword: "new" };
    await getAccountProfile("token");
    await updateAccountProfile("token", profile);
    await changeAccountPassword("token", password);
    await listAccountSessions("token");
    await signOutOtherAccountSessions("token");
    await signOutAccountSession("token", "session/one");
    await listAccountApplications("token");
    await revokeAccountApplication("token", "client/one");
    await listOfflineSessions("token");
    await revokeOfflineSession("token", "offline/one");
    await deleteAccount("token", "current-password");
    await getMfaStatus("token");
    await startMfaSetup("token");
    await mutateMfa("token", "enable", "123456");
    await mutateMfa("token", "disable", "654321");
    await getRecoveryCodesStatus("token");
    await generateRecoveryCodes("token");
    await listSocialLinks("token");
    await unlinkSocialProvider("token", "provider/one");

    assert.deepEqual(requests, [
      { path: "/api/account/profile", method: "GET", body: undefined },
      {
        path: "/api/account/profile",
        method: "PUT",
        body: JSON.stringify(profile),
      },
      {
        path: "/api/account/password",
        method: "PUT",
        body: JSON.stringify(password),
      },
      {
        path: "/api/account/sessions?page=0&size=20",
        method: "GET",
        body: undefined,
      },
      {
        path: "/api/account/sessions/others",
        method: "DELETE",
        body: undefined,
      },
      {
        path: "/api/account/sessions/session%2Fone",
        method: "DELETE",
        body: undefined,
      },
      {
        path: "/api/account/applications?page=0&size=20",
        method: "GET",
        body: undefined,
      },
      {
        path: "/api/account/applications/client%2Fone",
        method: "DELETE",
        body: undefined,
      },
      {
        path: "/api/account/offline-sessions?page=0&size=20",
        method: "GET",
        body: undefined,
      },
      {
        path: "/api/account/offline-sessions/offline%2Fone",
        method: "DELETE",
        body: undefined,
      },
      {
        path: "/api/account",
        method: "DELETE",
        body: JSON.stringify({ currentPassword: "current-password" }),
      },
      { path: "/api/account/mfa", method: "GET", body: undefined },
      { path: "/api/account/mfa/setup", method: "POST", body: undefined },
      {
        path: "/api/account/mfa/enable",
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
      },
      {
        path: "/api/account/mfa/disable",
        method: "POST",
        body: JSON.stringify({ code: "654321" }),
      },
      {
        path: "/api/account/mfa/recovery-codes",
        method: "GET",
        body: undefined,
      },
      {
        path: "/api/account/mfa/recovery-codes",
        method: "POST",
        body: undefined,
      },
      { path: "/api/account/social-links", method: "GET", body: undefined },
      {
        path: "/api/account/social-links/provider%2Fone",
        method: "DELETE",
        body: undefined,
      },
    ]);
    assert.ok(requests.every(({ method }) => method !== undefined));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account requests preserve HTTP problem details and stop retrying when refresh fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        title: "Forbidden",
        status: 403,
        detail: "Account access denied",
      }),
      { status: 403 },
    );

  try {
    await assert.rejects(
      getAccountProfile("token"),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.status === 403 &&
        error.kind === "forbidden" &&
        error.problem?.title === "Forbidden",
    );

    let refreshCalls = 0;
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(
      getAccountProfile("expired-token", {
        refreshAccessToken: async () => {
          refreshCalls += 1;
          return null;
        },
      }),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.status === 401 &&
        error.kind === "unauthorized",
    );
    assert.equal(refreshCalls, 1);

    globalThis.fetch = async () =>
      new Response("invalid json", { status: 500 });
    await assert.rejects(
      getAccountProfile("token"),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.status === 500 &&
        error.kind === "server" &&
        error.data === undefined,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
