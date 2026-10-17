import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountApiError,
  changeAccountPassword,
  completeNativeSocialLink,
  decideCibaRequest,
  deleteAccount,
  generateRecoveryCodes,
  getAccountProfile,
  getAccountAvatar,
  getAccountProfileAttributes,
  getMfaStatus,
  getRecoveryCodesStatus,
  listAccountApplications,
  listAccountNotifications,
  listAccountSessions,
  listCibaRequests,
  listOfflineSessions,
  listSocialLinks,
  getAccountUnreadNotificationCount,
  markAccountNotificationRead,
  mutateMfa,
  revokeAccountApplication,
  revokeOfflineSession,
  signOutAccountSession,
  signOutOtherAccountSessions,
  startMfaSetup,
  startNativeSocialLink,
  unlinkSocialProvider,
  updateAccountProfile,
  updateAccountProfileAttributes,
  uploadAccountAvatar,
  deleteAccountAvatar,
  sendAccountVerificationEmail,
} from "./account-api.ts";

import { installAxiosFetchMockCompatibility } from "../testing/axios-fetch-mock.ts";

installAxiosFetchMockCompatibility();

test("profile attributes use the authenticated account contract", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; method?: string; body?: string }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(input.toString()).pathname,
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(
      JSON.stringify({
        definitions: [],
        attributes: { department: ["Engineering"] },
      }),
      { status: 200 },
    );
  };

  try {
    await getAccountProfileAttributes("access-token");
    await updateAccountProfileAttributes("access-token", {
      department: ["Platform"],
    });
    assert.deepEqual(requests, [
      {
        path: "/api/account/profile/attributes",
        method: "GET",
        body: undefined,
      },
      {
        path: "/api/account/profile/attributes",
        method: "PUT",
        body: JSON.stringify({ attributes: { department: ["Platform"] } }),
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account avatar and verification actions use the authenticated native API", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; method?: string; authorization?: string }[] =
    [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(input.toString()).pathname,
      method: init?.method,
      authorization:
        new Headers(init?.headers).get("Authorization") ?? undefined,
    });
    const path = new URL(input.toString()).pathname;
    if (path === "/api/account/profile/avatar" && init?.method === "GET") {
      return new Response(JSON.stringify({ avatarUrl: null }), { status: 200 });
    }
    if (path === "/api/account/profile/avatar" && init?.method === "PUT") {
      return new Response(
        JSON.stringify({ avatarUrl: "/avatars/current?v=2" }),
        {
          status: 200,
        },
      );
    }
    return new Response(null, { status: 204 });
  };

  try {
    assert.equal((await getAccountAvatar("access-token")).avatarUrl, null);
    assert.equal(
      (
        await uploadAccountAvatar("access-token", {
          uri: "file:///avatar.jpg",
          name: "avatar.jpg",
          type: "image/jpeg",
        })
      ).avatarUrl,
      "/avatars/current?v=2",
    );
    await deleteAccountAvatar("access-token");
    await sendAccountVerificationEmail("access-token");
    assert.deepEqual(requests, [
      {
        path: "/api/account/profile/avatar",
        method: "GET",
        authorization: "Bearer access-token",
      },
      {
        path: "/api/account/profile/avatar",
        method: "PUT",
        authorization: "Bearer access-token",
      },
      {
        path: "/api/account/profile/avatar",
        method: "DELETE",
        authorization: "Bearer access-token",
      },
      {
        path: "/api/account/send-verify-email",
        method: "POST",
        authorization: "Bearer access-token",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account notifications use authenticated paged, unread-count, and mark-read routes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: {
    path: string;
    search: string;
    method?: string;
    authorization?: string;
  }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(input.toString()).pathname,
      search: new URL(input.toString()).search,
      method: init?.method,
      authorization:
        new Headers(init?.headers).get("Authorization") ?? undefined,
    });
    const path = new URL(input.toString()).pathname;
    if (path.endsWith("unread-count")) return new Response("2", { status: 200 });
    if (path === "/api/account/notifications") {
      return new Response(
        JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 2, size: 10 }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 204 });
  };

  try {
    await listAccountNotifications("access-token", { page: 2, size: 10 });
    assert.equal(
      await getAccountUnreadNotificationCount("access-token"),
      2,
    );
    await markAccountNotificationRead("access-token", "notice/one");
    assert.deepEqual(requests, [
      {
        path: "/api/account/notifications",
        search: "?page=2&size=10&sort=createdAt,desc",
        method: "GET",
        authorization: "Bearer access-token",
      },
      {
        path: "/api/account/notifications/unread-count",
        search: "",
        method: "GET",
        authorization: "Bearer access-token",
      },
      {
        path: "/api/account/notifications/notice%2Fone/read",
        search: "",
        method: "PUT",
        authorization: "Bearer access-token",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CIBA requests use the authenticated account API and preserve encoded IDs", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: input.toString(), init });
    return requests.length === 1
      ? new Response(
          JSON.stringify({
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0,
            size: 20,
          }),
          { status: 200 },
        )
      : new Response(null, { status: 204 });
  };

  try {
    assert.equal((await listCibaRequests("access-token")).size, 20);
    await decideCibaRequest(
      "access-token",
      { authReqId: "request/one", userCode: "A+B 2" },
      "approve",
    );
    assert.deepEqual(
      requests.map(({ url, init }) => ({
        path: new URL(url).pathname,
        query: new URL(url).search,
        method: init?.method,
        authorization: new Headers(init?.headers).get("Authorization"),
      })),
      [
        {
          path: "/api/ciba/requests",
          query: "?page=0&size=20&sort=createdAt,desc",
          method: "GET",
          authorization: "Bearer access-token",
        },
        {
          path: "/api/ciba/requests/request%2Fone/approve",
          query: "?user_code=A%2BB%202",
          method: "POST",
          authorization: "Bearer access-token",
        },
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account pageable lists accept a page and clamp page size to the server limit", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(
      new URL(input.toString()).pathname + new URL(input.toString()).search,
    );
    return new Response(
      JSON.stringify({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 2,
        size: 100,
      }),
      { status: 200 },
    );
  };

  try {
    await listAccountSessions("token", { page: 2, size: 500 });
    await listAccountApplications("token", { page: 2, size: 500 });
    await listOfflineSessions("token", { page: 2, size: 500 });
    await listCibaRequests("token", { page: 2, size: 500 });
    assert.deepEqual(urls, [
      "/api/account/sessions?page=2&size=100",
      "/api/account/applications?page=2&size=100",
      "/api/account/offline-sessions?page=2&size=100",
      "/api/ciba/requests?page=2&size=100&sort=createdAt,desc",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CIBA decisions preserve forbidden responses without retrying", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ detail: "Forbidden" }), {
      status: 403,
    });
  };

  try {
    await assert.rejects(
      decideCibaRequest(
        "access-token",
        { authReqId: "request-1", userCode: "ABCD-1234" },
        "approve",
      ),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.status === 403 &&
        error.kind === "forbidden",
    );
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rate-limited account responses expose the server retry delay", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ title: "Try later" }), {
      status: 429,
      headers: { "Retry-After": "7" },
    });

  try {
    await assert.rejects(
      getAccountProfile("access-token"),
      (error: unknown) =>
        error instanceof AccountApiError &&
        error.kind === "rate-limited" &&
        error.retryAfterMs === 7_000,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
  globalThis.fetch = async (_input, init) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(init?.signal?.aborted, true);
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  };

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
  let firstRequestHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    firstRequestHeaders ??= new Headers(init?.headers);
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
    await startNativeSocialLink("token", "github", {
      state: "state-value",
      codeChallenge: "challenge-value",
    });
    await completeNativeSocialLink("token", {
      code: "completion-code",
      codeVerifier: "verifier-value",
    });

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
      {
        path: "/api/account/social-links/github/mobile/start",
        method: "POST",
        body: JSON.stringify({
          state: "state-value",
          codeChallenge: "challenge-value",
        }),
      },
      {
        path: "/api/account/social-links/mobile/complete",
        method: "POST",
        body: JSON.stringify({
          code: "completion-code",
          codeVerifier: "verifier-value",
        }),
      },
    ]);
    assert.ok(requests.every(({ method }) => method !== undefined));
    assert.equal(firstRequestHeaders?.get("App-Name"), "Kitezh");
    assert.equal(firstRequestHeaders?.get("App-Version"), "v0.1.0");
    assert.equal(firstRequestHeaders?.get("Client-Platform"), "android");
    assert.equal(firstRequestHeaders?.get("OS"), "android");
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
