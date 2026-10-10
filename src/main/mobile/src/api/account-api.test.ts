import assert from "node:assert/strict";
import test from "node:test";

import { AccountApiError, getAccountProfile } from "./account-api.ts";

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
        () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
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
