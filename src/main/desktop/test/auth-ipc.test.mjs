import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDesktopAuthIpc } from "../dist/auth-ipc.js";

function createAuthHarness({
  openExternal = async () => {},
  encryptionAvailable = true,
  vault = {},
} = {}) {
  const handlers = new Map();
  const pendingAuthorizations = new Map();
  const calls = [];
  let currentVault = { ...vault };
  const dependencies = {
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    assertTrustedSender(event) {
      calls.push("assert-trusted");
      if (!event?.trusted) throw new Error("Untrusted IPC sender");
    },
    assertConsole(value) {
      if (value !== "admin" && value !== "account") {
        throw new Error("Invalid console");
      }
    },
    pendingAuthorizations,
    isPendingAuthorizationValid(pending, state) {
      return pending.state === state;
    },
    createAuthorizationRequest(consoleName) {
      calls.push(["create-auth-request", consoleName]);
      return {
        authorizationUrl: new URL(`https://identity.example/${consoleName}`),
        pending: {
          state: `state-${consoleName}`,
          clientId: `desktop-${consoleName}-console`,
          codeVerifier: "pkce-verifier",
          redirectUri: "kitezh://oauth/callback",
          createdAt: 1,
        },
      };
    },
    async persistPendingAuthorizations() {
      calls.push(["persist-authorizations", [...pendingAuthorizations.keys()]]);
    },
    openExternal,
    async readVault() {
      calls.push("read-vault");
      return { ...currentVault };
    },
    async writeVault(next) {
      currentVault = { ...next };
      calls.push(["write-vault", { ...next }]);
    },
    setLogoutMenuVisible(visible) {
      calls.push(["logout-menu", visible]);
    },
    isEncryptionAvailable() {
      return encryptionAvailable;
    },
    async logoutDesktopSession(consoleName) {
      calls.push(["logout", consoleName]);
    },
    async startNativeSocialLink(provider) {
      calls.push(["social-link", provider]);
      return { status: 202, kind: null, body: null };
    },
  };
  registerDesktopAuthIpc(dependencies);

  return {
    calls,
    pendingAuthorizations,
    invoke(channel, event = { trusted: true }, value) {
      return handlers.get(channel)(event, value);
    },
  };
}

test("starts one trusted desktop authorization and persists its PKCE transaction", async () => {
  const openedUrls = [];
  const harness = createAuthHarness({
    openExternal: async (url) => openedUrls.push(url),
  });

  const result = await harness.invoke("desktop:auth-start-login", undefined, "admin");

  assert.equal(result, undefined);
  assert.equal(openedUrls[0], "https://identity.example/admin");
  assert.equal(harness.pendingAuthorizations.get("admin").state, "state-admin");
  assert.deepEqual(harness.calls[1], ["create-auth-request", "admin"]);
  assert.deepEqual(harness.calls[2], ["persist-authorizations", ["admin"]]);
});

test("rejects malformed, untrusted, and duplicate desktop login requests", async () => {
  const harness = createAuthHarness();

  await assert.rejects(
    harness.invoke("desktop:auth-start-login", undefined, 3),
    /Invalid login request/,
  );
  await assert.rejects(
    harness.invoke("desktop:auth-start-login", { trusted: false }, "admin"),
    /Untrusted IPC sender/,
  );
  harness.pendingAuthorizations.set("admin", {
    state: "active",
    clientId: "client",
    codeVerifier: "verifier",
    redirectUri: "kitezh://oauth/callback",
    createdAt: 1,
  });
  await assert.rejects(
    harness.invoke("desktop:auth-start-login", undefined, "admin"),
    /already in progress/,
  );

  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "create-auth-request"), false);
});

test("removes pending authorization and persists cleanup when opening the browser fails", async () => {
  const harness = createAuthHarness({
    openExternal: async () => {
      throw new Error("browser unavailable");
    },
  });

  await assert.rejects(
    harness.invoke("desktop:auth-start-login", undefined, "account"),
    /browser could not be opened/,
  );

  assert.equal(harness.pendingAuthorizations.has("account"), false);
  assert.deepEqual(
    harness.calls.filter((call) => Array.isArray(call) && call[0] === "persist-authorizations"),
    [
      ["persist-authorizations", ["account"]],
      ["persist-authorizations", []],
    ],
  );
});

test("cancels login and reports whether a console session exists", async () => {
  const harness = createAuthHarness({ vault: { admin: { accessToken: "redacted" } } });
  harness.pendingAuthorizations.set("admin", { state: "pending" });

  await harness.invoke("desktop:auth-cancel-login", undefined, "admin");
  const hasAdmin = await harness.invoke("desktop:auth-has-session", undefined, "admin");
  const hasAccount = await harness.invoke("desktop:auth-has-session", undefined, "account");

  assert.equal(harness.pendingAuthorizations.has("admin"), false);
  assert.deepEqual([hasAdmin, hasAccount], [true, false]);
});

test("clears a single console while preserving the other session and updates logout visibility", async () => {
  const accountTokens = { accessToken: "redacted" };
  const harness = createAuthHarness({
    vault: { admin: { accessToken: "redacted" }, account: accountTokens },
  });

  await harness.invoke("desktop:auth-clear-session", undefined, "admin");

  assert.deepEqual(harness.calls.find((call) => Array.isArray(call) && call[0] === "write-vault"), [
    "write-vault",
    { account: accountTokens },
  ]);
  assert.deepEqual(harness.calls.at(-1), ["logout-menu", true]);
});

test("clears every session, exposes encryption status, and delegates logout", async () => {
  const harness = createAuthHarness({ encryptionAvailable: false });

  await harness.invoke("desktop:auth-clear-all-sessions");
  const storageStatus = harness.invoke("desktop:auth-storage-status");
  await harness.invoke("desktop:auth-logout", undefined, "account");

  assert.equal(storageStatus, "unavailable");
  assert.ok(harness.calls.some((call) => Array.isArray(call) && call[0] === "write-vault" && Object.keys(call[1]).length === 0));
  assert.ok(harness.calls.some((call) => Array.isArray(call) && call[0] === "logout-menu" && call[1] === false));
  assert.deepEqual(harness.calls.at(-1), ["logout", "account"]);
});

test("delegates social-link requests only after sender validation", async () => {
  const harness = createAuthHarness();

  const response = await harness.invoke("desktop:social-link-start", undefined, "github");

  assert.deepEqual(response, { status: 202, kind: null, body: null });
  assert.deepEqual(harness.calls.at(-1), ["social-link", "github"]);
});

test("rejects untrusted and invalid-console session requests before touching the vault", async () => {
  const harness = createAuthHarness();

  await assert.rejects(
    harness.invoke("desktop:auth-clear-session", { trusted: false }, "admin"),
    /Untrusted IPC sender/,
  );
  await assert.rejects(
    harness.invoke("desktop:auth-has-session", undefined, "other"),
    /Invalid console/,
  );

  assert.equal(harness.calls.includes("read-vault"), false);
});
