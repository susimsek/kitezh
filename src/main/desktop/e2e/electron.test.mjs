import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "playwright-core";

const require = createRequire(import.meta.url);
const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const electronExecutable = require("electron");
const packageVersion = JSON.parse(
  await readFile(path.join(desktopDirectory, "package.json"), "utf8"),
).version;

async function launchDesktop({
  devTools = false,
  updatePreviewState,
  updatePreviewVersion = "0.1.1",
} = {}) {
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-desktop-e2e-"),
  );
  await writeFile(
    path.join(userDataDirectory, "desktop-language-mode.json"),
    "en",
  );
  await writeFile(path.join(userDataDirectory, "desktop-language.json"), "en");
  return electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`, desktopDirectory],
    cwd: desktopDirectory,
    env: {
      ...process.env,
      DESKTOP_API_BASE_URL: "http://127.0.0.1:9090",
      DESKTOP_AUTO_UPDATE: "false",
      DESKTOP_DEVTOOLS: devTools ? "true" : "false",
      ...(updatePreviewState
        ? {
            DESKTOP_UPDATE_PREVIEW: "true",
            DESKTOP_UPDATE_PREVIEW_STATE: updatePreviewState,
            DESKTOP_UPDATE_PREVIEW_VERSION: updatePreviewVersion,
          }
        : {}),
    },
    executablePath: electronExecutable,
  });
}

async function clickApplicationMenuItem(application, label) {
  const clicked = await application.evaluate(({ Menu }, itemLabel) => {
    const menu = Menu.getApplicationMenu();
    const item = menu?.items[0]?.submenu?.items.find(
      (candidate) => candidate.label === itemLabel,
    );
    item?.click();
    return Boolean(item);
  }, label);
  assert.equal(clicked, true, `Could not find application menu item: ${label}`);
}

async function clickViewMenuItem(application, label) {
  const clicked = await application.evaluate(({ Menu }, itemLabel) => {
    const menu = Menu.getApplicationMenu();
    const view = menu?.items.find((candidate) => candidate.label === "View");
    const item = view?.submenu?.items.find(
      (candidate) => candidate.label === itemLabel,
    );
    item?.click();
    return Boolean(item);
  }, label);
  assert.equal(clicked, true, `Could not find View menu item: ${label}`);
}

async function nativeMainWindow(application) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const window = application
      .windows()
      .find((candidate) => candidate.url() === "app://renderer/native");
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Native main window did not become available");
}

async function windowWithHeading(application, name) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    for (const window of application.windows()) {
      if (window.isClosed()) continue;
      try {
        if (await window.getByRole("heading", { name }).count()) return window;
      } catch (error) {
        // Transient checking windows can close between enumeration and lookup.
        if (!window.isClosed()) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Window with heading ${String(name)} did not become available`,
  );
}

async function closeNativeSettings(application) {
  // A Playwright page close precedes BrowserWindow's closed event. Waiting for
  // the latter prevents the next menu action from focusing the closing window.
  await application.evaluate(
    ({ BrowserWindow }) =>
      new Promise((resolve) => {
        const window = BrowserWindow.getAllWindows().find((candidate) =>
          candidate.webContents.getURL().includes("/desktop-settings"),
        );
        if (!window) {
          resolve();
          return;
        }
        window.once("closed", resolve);
        window.close();
      }),
  );
}

async function openManualUpdateCheck(
  application,
  label = "Check for Updates…",
  expectNextWindow = true,
) {
  const checkingWindowPromise = application.waitForEvent("window");
  // Observe both windows before clicking: a fast result can arrive before the
  // checking window's DOM is ready.
  const nextWindowPromise = expectNextWindow
    ? windowWithHeading(
        application,
        /A new version of Kitezh is available!|Kitezh is up to date/,
      )
    : null;
  await clickApplicationMenuItem(application, label);
  const checkingWindow = await checkingWindowPromise;
  return { checkingWindow, nextWindowPromise };
}

test("opens the native console chooser and exposes the narrow desktop bridge", async () => {
  const application = await launchDesktop();
  try {
    const window = await nativeMainWindow(application);
    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("heading", { name: "Choose a console" }).waitFor();

    assert.equal(await window.url(), "app://renderer/native");
    if (process.platform === "win32") {
      assert.equal(
        await application.evaluate(({ app }) =>
          app.isDefaultProtocolClient("kitezh", process.execPath, [
            app.getAppPath(),
          ]),
        ),
        true,
        "Protocol registration must use the application path, not debugger argv flags",
      );
    }
    assert.equal(
      await window
        .getByRole("button", { name: "Administration Console" })
        .count(),
      1,
    );
    assert.equal(
      await window.getByRole("button", { name: "Account Console" }).count(),
      1,
    );
    assert.equal(await window.locator(".desktop-console-option").count(), 0);
    const nativeLogin = application
      .windows()
      .find((candidate) => candidate.url().includes("/desktop-login"));
    assert.ok(nativeLogin, "Desktop should show the native login window");
    await nativeLogin
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    assert.equal(await nativeLogin.url(), "app://renderer/desktop-login");
    assert.equal(
      await nativeLogin
        .getByRole("button", { name: "Sign in to Admin Console" })
        .count(),
      1,
    );
    assert.deepEqual(
      await window.evaluate(async () => ({
        apiBaseUrl: window.desktopApi?.apiBaseUrl,
        isDesktop: window.desktopApi?.isDesktop,
        version: await window.desktopApi?.getAppVersion(),
      })),
      {
        apiBaseUrl: "http://127.0.0.1:9090",
        isDesktop: true,
        version: packageVersion,
      },
    );
  } finally {
    await application.close();
  }
});

test("keeps native sign-in busy until callback and rejects duplicate authorization", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      shell.openExternal = async (url) => {
        globalThis.__pendingAuthorizationUrl = url;
      };
    });
    const window = await nativeMainWindow(application);
    await window
      .getByRole("button", { name: "Account Console", exact: true })
      .click();
    const signIn = window.getByRole("button", { name: "Sign in", exact: true });
    await signIn.waitFor();
    assert.equal(await signIn.isDisabled(), true);
    assert.equal(await signIn.locator(".spinner").count(), 1);
    assert.equal(await signIn.getAttribute("aria-busy"), "true");
    const duplicateRejected = await window.evaluate(async () => {
      try {
        await window.desktopApi.auth.startLogin("account");
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(duplicateRejected, true);
    await application.evaluate(({ app }) => {
      const state = new URL(
        globalThis.__pendingAuthorizationUrl,
      ).searchParams.get("state");
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&error=access_denied`,
      );
    });
    await window.getByRole("alert").waitFor();
    assert.equal(await signIn.isDisabled(), false);
    assert.equal(await signIn.locator(".spinner").count(), 0);
  } finally {
    await application.close();
  }
});

test("native login chooser stays alive and authenticated Admin does not reopen the browser", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__authorizationOpens = 0;
      shell.openExternal = async (url) => {
        globalThis.__authorizationOpens += 1;
        globalThis.__pendingAuthorizationUrl = url;
      };
      globalThis.fetch = async (url) => {
        const requestUrl = new URL(String(url));
        if (requestUrl.pathname === "/oauth2/token")
          return new Response(
            JSON.stringify({
              access_token: "test-admin-access-token",
              expires_in: 3600,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        if (requestUrl.pathname === "/api/admin/dashboard")
          return new Response(
            JSON.stringify({ clients: 4, users: 12, sessions: 6, consents: 8 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        if (requestUrl.pathname === "/api/admin/users") {
          globalThis.__adminUserRequests ??= [];
          globalThis.__adminUserRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const page = Number(requestUrl.searchParams.get("page") ?? 0);
          const query = requestUrl.searchParams.get("q") ?? "";
          const username = query
            ? `alice-${page + 1}`
            : page === 0
              ? "admin"
              : "user";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: page + 1,
                  username,
                  email: `${username}@example.test`,
                  enabled: true,
                  authorities: ["ROLE_USER"],
                  effectiveRoles: ["ROLE_USER"],
                },
              ],
              number: page,
              totalPages: 2,
              totalElements: 2,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/roles") {
          globalThis.__adminRoleRequests ??= [];
          globalThis.__adminRoleRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const page = Number(requestUrl.searchParams.get("page") ?? 0);
          const query = requestUrl.searchParams.get("q") ?? "";
          const name = query
            ? "ROLE_AUDITOR"
            : page === 0
              ? "ROLE_ADMIN"
              : "ROLE_USER";
          return new Response(
            JSON.stringify({
              content: [{ name, description: "Scoped authorization role" }],
              number: page,
              totalPages: 2,
              totalElements: 2,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/groups") {
          globalThis.__adminGroupRequests ??= [];
          globalThis.__adminGroupRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const page = Number(requestUrl.searchParams.get("page") ?? 0);
          const query = requestUrl.searchParams.get("q") ?? "";
          const name = query
            ? "finance-audit"
            : page === 0
              ? "finance"
              : "support";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: page + 1,
                  name,
                  path: `Organization / ${name}`,
                  roles: ["ROLE_USER_VIEWER"],
                  effectiveRoles: ["ROLE_USER_VIEWER"],
                  userCount: 3,
                },
              ],
              number: page,
              totalPages: 2,
              totalElements: 2,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/client-scopes") {
          globalThis.__adminClientScopeRequests ??= [];
          globalThis.__adminClientScopeRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          const name = query ? "account-api" : "openid";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: `scope-${name}`,
                  name,
                  displayName: name === "openid" ? "OpenID" : "Account API",
                  description: "Read-only scope description",
                  builtIn: name === "openid",
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/clients") {
          globalThis.__adminClientRequests ??= [];
          globalThis.__adminClientRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          const clientId = query ? "admin-console" : "account-console";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "client-1",
                  clientId,
                  clientName:
                    clientId === "admin-console"
                      ? "Admin Console"
                      : "Account Console",
                  scopes: ["openid", "admin-api"],
                  requireProofKey: true,
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/identity-providers") {
          globalThis.__adminIdentityProviderRequests ??= [];
          globalThis.__adminIdentityProviderRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          const alias = query ? "google" : "github";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "provider-1",
                  registrationId: alias,
                  providerType: "oidc",
                  displayName: alias === "google" ? "Google" : "GitHub",
                  alias,
                  enabled: true,
                  configured: true,
                  clientId: "public-client-id",
                  clientSecretConfigured: true,
                  samlIdpCertificate: "SECRET_CERT_NEVER_RENDER",
                  mapperCount: 2,
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/sessions") {
          globalThis.__adminSessionRequests ??= [];
          globalThis.__adminSessionRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const status = requestUrl.searchParams.get("status") ?? "active";
          const username = requestUrl.searchParams.get("q")
            ? "alice"
            : status === "active"
              ? "admin"
              : "user";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "session-secret-should-not-render",
                  username,
                  authorizationCount: 2,
                  active: status === "active",
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/consents") {
          globalThis.__adminConsentRequests ??= [];
          globalThis.__adminConsentRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          const clientId = query ? "admin-console" : "account-console";
          return new Response(
            JSON.stringify({
              content: [
                {
                  clientId,
                  clientName:
                    clientId === "admin-console"
                      ? "Admin Console"
                      : "Account Console",
                  principalName: "alice",
                  userId: 9,
                  authorities: ["openid", "admin-api"],
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/offline-sessions") {
          globalThis.__adminOfflineSessionRequests ??= [];
          globalThis.__adminOfflineSessionRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const page = Number(requestUrl.searchParams.get("page") ?? 0);
          const username = page === 0 ? "alice" : "bob";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "offline-auth-opaque-id",
                  username,
                  clientId: "account-console",
                  clientName: "Account Console",
                },
              ],
              number: page,
              totalPages: 2,
              totalElements: 2,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/events") {
          globalThis.__adminEventRequests ??= [];
          globalThis.__adminEventRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "event-id",
                  actor: "admin",
                  action: query ? "user.updated" : "user.created",
                  targetType: "user",
                  targetId: "4",
                  details: "SECRET_PII_DETAIL_NEVER_RENDER",
                  occurredAt: "2026-10-10T07:00:00Z",
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/keys") {
          globalThis.__adminKeyRequests ??= [];
          globalThis.__adminKeyRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "key-id",
                  kid: query ? "rsa-retired" : "rsa-active",
                  type: "RSA",
                  algorithm: "RS256",
                  use: "sig",
                  active: requestUrl.searchParams.get("active") !== "false",
                  privateKey: "SECRET_PRIVATE_KEY_NEVER_RENDER",
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/settings/ciba-policy") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              requestLifespanSeconds: 300,
              pollingIntervalSeconds: 5,
              deliveryMode: "all",
              userVerification: "preferred",
              mfaRequired: true,
              stepUpRequired: false,
              stepUpAcr: "urn:kitezh:loa:2",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/settings/offline-access") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              idleTimeout: "P30D",
              maxLifespan: "P180D",
              maxLimited: true,
              revokedBefore: "2026-01-01T00:00:00Z",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/settings/branding") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              applicationName: "Kitezh <Admin>",
              logoPath: "/assets/logo.svg",
              faviconPath: "/assets/favicon.ico",
              appleTouchIconPath: "/assets/apple-touch.png",
              primaryColor: "#0d6efd",
              accentColor: "#0b2b69",
              backgroundColor: "#f8f9fa",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/server-info") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              issuer: "https://identity.example.test",
              discoveryEndpoint:
                "https://identity.example.test/.well-known/openid-configuration",
              authorizationEndpoint:
                "https://identity.example.test/oauth2/authorize",
              tokenEndpoint: "https://identity.example.test/oauth2/token",
              introspectionEndpoint:
                "https://identity.example.test/oauth2/introspect",
              revocationEndpoint: "https://identity.example.test/oauth2/revoke",
              jwksEndpoint: "https://identity.example.test/oauth2/jwks",
              userInfoEndpoint: "https://identity.example.test/userinfo",
              endSessionEndpoint:
                "https://identity.example.test/connect/logout",
              sessionTimeout: "30m",
              activeSigningKey: {
                kid: "rsa-current",
                type: "RSA",
                algorithm: "RS256",
                use: "sig",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw new Error("Unexpected Admin API request");
      };
    });
    const window = await nativeMainWindow(application);
    let chooser;
    for (let attempt = 0; attempt < 100 && !chooser; attempt += 1) {
      chooser = application
        .windows()
        .find((page) => page.url() === "app://renderer/desktop-login");
      if (!chooser) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(chooser, "Visible native login chooser must exist");
    await chooser
      .getByRole("button", { name: "Sign in to Admin Console", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Sign in", exact: true })
      .waitFor();
    assert.equal(
      await window
        .getByRole("button", { name: "Sign in", exact: true })
        .isDisabled(),
      true,
    );
    await application.evaluate(({ app }) => {
      const state = new URL(
        globalThis.__pendingAuthorizationUrl,
      ).searchParams.get("state");
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&code=test-admin-code`,
      );
    });
    await window
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    await window.getByText("Registered clients").waitFor();
    await window.locator(".stat-value").first().waitFor();
    assert.deepEqual(await window.locator(".stat-value").allTextContents(), [
      "4",
      "12",
      "6",
      "8",
    ]);
    const usersNavigation = window.getByRole("button", {
      name: "Users",
      exact: true,
    });
    await usersNavigation.click();
    assert.equal(await usersNavigation.isDisabled(), true);
    assert.equal(await usersNavigation.locator(".spinner").count(), 1);
    const usersButton = window.getByRole("button", {
      name: "Search users",
      exact: true,
    });
    await usersButton.waitFor();
    await window.getByText("admin@example.test").waitFor();
    const userQuery = window.getByRole("searchbox", { name: "Search users" });
    await userQuery.fill("alice");
    await usersButton.click();
    assert.equal(await usersButton.isDisabled(), true);
    await window.getByText("alice-1@example.test").waitFor();
    assert.match(
      await window.locator('[aria-label="Users pagination"]').innerText(),
      /Page 1 \/ 2/,
    );
    const nextPage = window.getByRole("button", { name: "Next" });
    await nextPage.click();
    assert.equal(await nextPage.isDisabled(), true);
    assert.equal(await nextPage.locator(".spinner").count(), 1);
    await window.getByText("alice-2@example.test").waitFor();
    const requestedQueries = await application.evaluate(
      () => globalThis.__adminUserRequests,
    );
    assert.deepEqual(
      requestedQueries.map((query) => new URLSearchParams(query).get("page")),
      ["0", "0", "1"],
    );
    assert.equal(new URLSearchParams(requestedQueries[1]).get("q"), "alice");
    const rolesNavigation = window.getByRole("button", {
      name: "Roles",
      exact: true,
    });
    await rolesNavigation.click();
    assert.equal(await rolesNavigation.isDisabled(), true);
    assert.equal(await rolesNavigation.locator(".spinner").count(), 1);
    await window.getByText("ROLE_ADMIN").waitFor();
    const roleQuery = window.getByRole("searchbox", { name: "Search roles" });
    await roleQuery.fill("AUDITOR");
    await window.getByRole("button", { name: "Search roles" }).click();
    assert.equal(
      await window.getByRole("button", { name: "Search roles" }).isDisabled(),
      true,
    );
    await window.getByText("ROLE_AUDITOR").waitFor();
    const roleRequests = await application.evaluate(
      () => globalThis.__adminRoleRequests,
    );
    assert.deepEqual(
      roleRequests.map((query) => new URLSearchParams(query).get("page")),
      ["0", "0"],
    );
    assert.equal(new URLSearchParams(roleRequests[1]).get("q"), "AUDITOR");
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("button", { name: "Rol ara" }).waitFor();
    assert.equal(await window.getByText("ROLE_AUDITOR").count(), 1);
    await window.getByRole("button", { name: "İngilizce" }).click();
    const groupsNavigation = window.getByRole("button", {
      name: "Groups",
      exact: true,
    });
    await groupsNavigation.click();
    assert.equal(await groupsNavigation.isDisabled(), true);
    assert.equal(await groupsNavigation.locator(".spinner").count(), 1);
    await window.getByText("Organization / finance").waitFor();
    const groupQuery = window.getByRole("searchbox", { name: "Search groups" });
    await groupQuery.fill("audit");
    await window.getByRole("button", { name: "Search groups" }).click();
    assert.equal(
      await window.getByRole("button", { name: "Search groups" }).isDisabled(),
      true,
    );
    await window.getByText("Organization / finance-audit").waitFor();
    const groupRequests = await application.evaluate(
      () => globalThis.__adminGroupRequests,
    );
    assert.deepEqual(
      groupRequests.map((query) => new URLSearchParams(query).get("page")),
      ["0", "0"],
    );
    assert.equal(new URLSearchParams(groupRequests[1]).get("q"), "audit");
    const clientScopesNavigation = window.getByRole("button", {
      name: "Client scopes",
      exact: true,
    });
    await clientScopesNavigation.click();
    assert.equal(await clientScopesNavigation.isDisabled(), true);
    assert.equal(await clientScopesNavigation.locator(".spinner").count(), 1);
    await window.getByText("OpenID").waitFor();
    const clientScopeQuery = window.getByRole("searchbox", {
      name: "Search client scopes",
    });
    await clientScopeQuery.fill("account");
    await window.getByRole("button", { name: "Search client scopes" }).click();
    assert.equal(
      await window
        .getByRole("button", { name: "Search client scopes" })
        .isDisabled(),
      true,
    );
    await window.getByText("Account API").waitFor();
    const clientScopeRequests = await application.evaluate(
      () => globalThis.__adminClientScopeRequests,
    );
    assert.equal(
      new URLSearchParams(clientScopeRequests[1]).get("q"),
      "account",
    );
    const clientsNavigation = window.getByRole("button", {
      name: "Clients",
      exact: true,
    });
    await clientsNavigation.click();
    assert.equal(await clientsNavigation.isDisabled(), true);
    assert.equal(await clientsNavigation.locator(".spinner").count(), 1);
    await window.getByText("Account Console").waitFor();
    const clientQuery = window.getByRole("searchbox", {
      name: "Search clients",
    });
    await clientQuery.fill("admin");
    await window.getByRole("button", { name: "Search clients" }).click();
    assert.equal(
      await window.getByRole("button", { name: "Search clients" }).isDisabled(),
      true,
    );
    await window.getByText("Admin Console").waitFor();
    const clientRequests = await application.evaluate(
      () => globalThis.__adminClientRequests,
    );
    assert.equal(new URLSearchParams(clientRequests[1]).get("q"), "admin");
    const identityProvidersNavigation = window.getByRole("button", {
      name: "Identity providers",
      exact: true,
    });
    await identityProvidersNavigation.click();
    assert.equal(await identityProvidersNavigation.isDisabled(), true);
    assert.equal(
      await identityProvidersNavigation.locator(".spinner").count(),
      1,
    );
    await window.getByText("GitHub", { exact: true }).waitFor();
    assert.equal(await window.getByText("SECRET_CERT_NEVER_RENDER").count(), 0);
    const providerQuery = window.getByRole("searchbox", {
      name: "Search identity providers",
    });
    await providerQuery.fill("google");
    await window
      .getByRole("button", { name: "Search identity providers" })
      .click();
    assert.equal(
      await window
        .getByRole("button", { name: "Search identity providers" })
        .isDisabled(),
      true,
    );
    await window.getByText("Google", { exact: true }).waitFor();
    const providerRequests = await application.evaluate(
      () => globalThis.__adminIdentityProviderRequests,
    );
    assert.equal(new URLSearchParams(providerRequests[1]).get("q"), "google");
    const sessionsNavigation = window.getByRole("button", {
      name: "Sessions",
      exact: true,
    });
    await sessionsNavigation.click();
    assert.equal(await sessionsNavigation.isDisabled(), true);
    assert.equal(await sessionsNavigation.locator(".spinner").count(), 1);
    await window.getByText("admin", { exact: true }).waitFor();
    assert.equal(
      await window.getByText("session-secret-should-not-render").count(),
      0,
    );
    await window
      .getByRole("searchbox", { name: "Search sessions" })
      .fill("alice");
    await window.locator("#admin-session-status").selectOption("expired");
    await window.getByRole("button", { name: "Search sessions" }).click();
    assert.equal(
      await window
        .getByRole("button", { name: "Search sessions" })
        .isDisabled(),
      true,
    );
    await window.getByText("alice", { exact: true }).waitFor();
    const sessionRequests = await application.evaluate(
      () => globalThis.__adminSessionRequests,
    );
    assert.equal(
      new URLSearchParams(sessionRequests[1]).get("status"),
      "expired",
    );
    assert.equal(new URLSearchParams(sessionRequests[1]).get("q"), "alice");
    const consentsNavigation = window.getByRole("button", {
      name: "Consents",
      exact: true,
    });
    await consentsNavigation.click();
    assert.equal(await consentsNavigation.isDisabled(), true);
    assert.equal(await consentsNavigation.locator(".spinner").count(), 1);
    await window
      .locator(".list-item strong")
      .filter({ hasText: "Account Console" })
      .waitFor();
    await window
      .getByRole("searchbox", { name: "Search consents" })
      .fill("admin");
    await window.getByRole("button", { name: "Search consents" }).click();
    assert.equal(
      await window
        .getByRole("button", { name: "Search consents" })
        .isDisabled(),
      true,
    );
    await window
      .locator(".list-item strong")
      .filter({ hasText: "Admin Console" })
      .waitFor();
    const consentRequests = await application.evaluate(
      () => globalThis.__adminConsentRequests,
    );
    assert.equal(new URLSearchParams(consentRequests[1]).get("q"), "admin");
    const offlineSessionsNavigation = window.getByRole("button", {
      name: "Offline sessions",
      exact: true,
    });
    await offlineSessionsNavigation.click();
    assert.equal(await offlineSessionsNavigation.isDisabled(), true);
    assert.equal(
      await offlineSessionsNavigation.locator(".spinner").count(),
      1,
    );
    await window.getByText("alice", { exact: true }).waitFor();
    assert.equal(await window.getByText("offline-auth-opaque-id").count(), 0);
    const nextOfflineSessionPage = window.getByRole("button", { name: "Next" });
    await nextOfflineSessionPage.click();
    assert.equal(await nextOfflineSessionPage.isDisabled(), true);
    assert.equal(await nextOfflineSessionPage.locator(".spinner").count(), 1);
    await window.getByText("bob", { exact: true }).waitFor();
    const offlineSessionRequests = await application.evaluate(
      () => globalThis.__adminOfflineSessionRequests,
    );
    assert.deepEqual(
      offlineSessionRequests.map((query) =>
        new URLSearchParams(query).get("page"),
      ),
      ["0", "1"],
    );
    const eventsNavigation = window.getByRole("button", {
      name: "Events",
      exact: true,
    });
    await eventsNavigation.click();
    assert.equal(await eventsNavigation.isDisabled(), true);
    assert.equal(await eventsNavigation.locator(".spinner").count(), 1);
    await window.getByText("user.created", { exact: true }).waitFor();
    assert.equal(
      await window.getByText("SECRET_PII_DETAIL_NEVER_RENDER").count(),
      0,
    );
    await window
      .getByRole("searchbox", { name: "Search events" })
      .fill("admin");
    await window.getByRole("button", { name: "Search events" }).click();
    assert.equal(
      await window.getByRole("button", { name: "Search events" }).isDisabled(),
      true,
    );
    await window.getByText("user.updated", { exact: true }).waitFor();
    const eventRequests = await application.evaluate(
      () => globalThis.__adminEventRequests,
    );
    assert.equal(new URLSearchParams(eventRequests[1]).get("q"), "admin");
    const keysNavigation = window.getByRole("button", {
      name: "Signing keys",
      exact: true,
    });
    await keysNavigation.click();
    assert.equal(await keysNavigation.isDisabled(), true);
    assert.equal(await keysNavigation.locator(".spinner").count(), 1);
    await window.getByText("rsa-active", { exact: true }).waitFor();
    assert.equal(
      await window.getByText("SECRET_PRIVATE_KEY_NEVER_RENDER").count(),
      0,
    );
    await window
      .getByRole("searchbox", { name: "Search signing keys" })
      .fill("rsa");
    await window.locator("#admin-key-active").selectOption("false");
    await window.getByRole("button", { name: "Search signing keys" }).click();
    assert.equal(
      await window
        .getByRole("button", { name: "Search signing keys" })
        .isDisabled(),
      true,
    );
    await window.getByText("rsa-retired", { exact: true }).waitFor();
    const keyRequests = await application.evaluate(
      () => globalThis.__adminKeyRequests,
    );
    assert.equal(new URLSearchParams(keyRequests[1]).get("q"), "rsa");
    assert.equal(new URLSearchParams(keyRequests[1]).get("active"), "false");
    const policiesNavigation = window.getByRole("button", {
      name: "Policies",
      exact: true,
    });
    await policiesNavigation.click();
    assert.equal(await policiesNavigation.isDisabled(), true);
    assert.equal(await policiesNavigation.locator(".spinner").count(), 1);
    await window.getByRole("heading", { name: "CIBA policy" }).waitFor();
    await window.getByText("300", { exact: true }).waitFor();
    await window.getByText("P30D", { exact: true }).waitFor();
    await window.getByText("urn:kitezh:loa:2", { exact: true }).waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("heading", { name: "CIBA politikası" }).waitFor();
    await window.getByText("MFA gerekli", { exact: true }).waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    const configurationNavigation = window.getByRole("button", {
      name: "Server & branding",
      exact: true,
    });
    await configurationNavigation.click();
    assert.equal(await configurationNavigation.isDisabled(), true);
    assert.equal(await configurationNavigation.locator(".spinner").count(), 1);
    await window
      .getByRole("heading", { name: "Branding", exact: true })
      .waitFor();
    await window.getByText("Kitezh <Admin>", { exact: true }).waitFor();
    assert.equal(await window.locator("admin").count(), 0);
    await window
      .getByText("https://identity.example.test/oauth2/token", { exact: true })
      .waitFor();
    await window
      .getByText("rsa-current · RSA · RS256 · sig", { exact: true })
      .waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Markalama", exact: true })
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Dashboard" }).click();
    await application.evaluate(() => {
      globalThis.fetch = async (url) => {
        if (new URL(String(url)).pathname !== "/api/admin/dashboard")
          throw new Error("Unexpected Admin API request");
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new Response("{}", { status: 403 });
      };
    });
    await window.getByRole("button", { name: "Dashboard" }).click();
    const forbidden = window.getByRole("alert");
    await forbidden
      .getByText(
        "You do not have permission to use the administration console.",
      )
      .waitFor();
    const retry = forbidden.getByRole("button", { name: "Retry" });
    await retry.click();
    assert.equal(await retry.isDisabled(), true);
    assert.equal(await retry.locator(".spinner").count(), 1);
    await forbidden
      .getByText(
        "You do not have permission to use the administration console.",
      )
      .waitFor();
    await window.waitForFunction(
      () => !document.querySelector('[data-action="retry"]')?.disabled,
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("button", { name: "İngilizce" }).waitFor();
    assert.match(
      await forbidden.innerText(),
      /Yönetim konsolunu kullanma yetkiniz yok\./,
    );
    await window.waitForTimeout(500);
    assert.deepEqual(
      await window.evaluate(async () => ({
        admin: await window.desktopApi.auth.hasSession("admin"),
        account: await window.desktopApi.auth.hasSession("account"),
      })),
      { admin: true, account: false },
    );
    assert.equal(
      await application.evaluate(() => globalThis.__authorizationOpens),
      1,
    );
    await window.reload();
    await window
      .getByRole("heading", { name: "Kontrol paneli", exact: true })
      .waitFor();
    await window.waitForTimeout(500);
    assert.equal(
      await application.evaluate(() => globalThis.__authorizationOpens),
      1,
    );
  } finally {
    await application.close();
  }
});

test("opens settings in a separate window without requiring login", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();

    const settingsWindowPromise = application.waitForEvent("window");
    await application.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const settings = menu?.items[0]?.submenu?.items.find(
        (item) => item.label === "Settings…",
      );
      settings?.click();
    });
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();

    for (const section of [
      "General",
      "Notifications",
      "Appearance",
      "Updates",
      "Diagnostics",
    ]) {
      assert.equal(
        await settingsWindow.getByRole("button", { name: section }).count(),
        1,
      );
    }
    const settingsSearch = settingsWindow.locator("#desktop-settings-search");
    await settingsSearch.fill("zz");
    assert.equal(
      await settingsWindow.locator("#desktop-settings-no-results").isVisible(),
      true,
    );
    await settingsSearch.fill("");
    assert.equal(
      await settingsWindow.getByRole("button", { name: "General" }).isVisible(),
      true,
    );
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("heading", { name: "Appearance" }).waitFor();
    assert.equal(
      await settingsWindow.getByRole("radio", { name: "System" }).count(),
      1,
    );
    await settingsWindow.getByRole("button", { name: "General" }).click();
    assert.equal(await settingsWindow.locator("#desktop-language").count(), 1);
    assert.equal(
      await settingsWindow.locator("#desktop-show-in-menu-bar").count(),
      1,
    );
    const platform = await application.evaluate(() => process.platform);
    assert.equal(
      await settingsWindow.locator("#desktop-show-in-dock").count(),
      platform === "darwin" ? 1 : 0,
    );
    const showInMenuBar = settingsWindow.locator("#desktop-show-in-menu-bar");
    assert.equal(await showInMenuBar.isChecked(), true);
    await showInMenuBar.click();
    await settingsWindow.waitForFunction(
      () => !document.querySelector("#desktop-show-in-menu-bar")?.checked,
    );
    await showInMenuBar.click();
    await settingsWindow.waitForFunction(
      () => document.querySelector("#desktop-show-in-menu-bar")?.checked,
    );
    assert.deepEqual(
      await settingsWindow
        .locator("#desktop-language option")
        .allTextContents(),
      ["System", "English", "Türkçe"],
    );
    const shortcut = settingsWindow.locator("#desktop-global-shortcut");
    await shortcut.click();
    await shortcut.press("Control+Shift+K");
    await settingsWindow.waitForFunction(
      () =>
        document.querySelector("#desktop-global-shortcut")?.value ===
        "CommandOrControl+Shift+K",
    );
    assert.equal(await shortcut.inputValue(), "CommandOrControl+Shift+K");
    const resetDefaults = settingsWindow.getByRole("button", {
      name: "Reset to defaults",
    });
    assert.equal(await resetDefaults.count(), 1);
    await resetDefaults.click();
    await settingsWindow.waitForLoadState("domcontentloaded");
    await settingsWindow
      .getByRole("heading", { name: /Settings|Ayarlar/ })
      .waitFor();
    await settingsWindow.waitForFunction(
      () =>
        document.querySelector("#desktop-global-shortcut")?.value ===
        "Alt+Space",
    );
    assert.equal(await showInMenuBar.isChecked(), true);
    assert.equal(
      await settingsWindow.locator("#desktop-language").inputValue(),
      "system",
    );
    await settingsWindow
      .getByRole("button", { name: /Diagnostics|Tanı bilgileri/ })
      .click();
    await settingsWindow
      .getByRole("heading", { name: /Diagnostics|Tanı bilgileri/ })
      .waitFor();
    assert.equal(
      await settingsWindow
        .getByRole("button", {
          name: /Copy diagnostics|Tanı bilgilerini kopyala/,
        })
        .count(),
      1,
    );

    assert.equal(await settingsWindow.url(), "app://renderer/desktop-settings");
    assert.equal(
      await settingsWindow
        .getByRole("button", { name: "Check for updates" })
        .count(),
      0,
    );
    assert.equal(
      await settingsWindow.getByRole("button", { name: "Done" }).count(),
      0,
    );
    assert.equal(
      await mainWindow
        .getByRole("heading", { name: /Choose a console|Bir konsol seçin/ })
        .count(),
      1,
    );
  } finally {
    await application.close();
  }
});

test("opens the native quick access companion from View", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const companionWindowPromise = application.waitForEvent("window");
    await clickViewMenuItem(application, "Quick Access…");
    const companionWindow = await companionWindowPromise;
    await companionWindow.getByRole("heading", { name: "Kitezh" }).waitFor();
    assert.equal(
      await companionWindow.url(),
      "app://renderer/desktop-companion",
    );
    assert.equal(
      await companionWindow
        .getByRole("main", { name: "CONTINUE SECURELY" })
        .count(),
      1,
    );
    assert.equal(
      await companionWindow
        .getByRole("button", { name: "Admin Console" })
        .count(),
      1,
    );
    assert.equal(
      await companionWindow
        .getByRole("button", { name: "Account Console" })
        .count(),
      1,
    );
    for (const button of await companionWindow.getByRole("button").all()) {
      assert.equal(await button.getAttribute("aria-busy"), null);
      assert.equal(
        await button.evaluate(
          (element) =>
            Number.parseFloat(getComputedStyle(element).minHeight) >= 44,
        ),
        true,
      );
    }
    const accountButton = companionWindow.getByRole("button", {
      name: "Account Console",
    });
    await accountButton.focus();
    assert.equal(
      await companionWindow.evaluate(() =>
        document.activeElement?.getAttribute("data-console"),
      ),
      "account",
    );
    const companionClosed = companionWindow.waitForEvent("close");
    await Promise.allSettled([
      companionWindow.keyboard.press("Escape"),
      companionClosed,
    ]);
    await mainWindow.waitForTimeout(100);
    assert.equal(
      application
        .windows()
        .some((candidate) => candidate.url().includes("/desktop-companion")),
      false,
    );
  } finally {
    await application.close();
  }
});

test("brings the existing window forward on a second launch", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find(
          (window) => window.webContents.getURL() === "app://renderer/native",
        )
        ?.hide();
    });
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find(
            (window) => window.webContents.getURL() === "app://renderer/native",
          )
          ?.isVisible(),
      ),
      false,
    );

    await application.evaluate(({ app }) => {
      app.emit("second-instance", {}, []);
    });
    await mainWindow.waitForTimeout(100);
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find(
            (window) => window.webContents.getURL() === "app://renderer/native",
          )
          ?.isVisible(),
      ),
      true,
    );
  } finally {
    await application.close();
  }
});

test("keeps developer tools closed until toggled from View", async () => {
  const application = await launchDesktop({ devTools: true });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();

    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.isDevToolsOpened(),
        ),
      ),
      false,
    );
    const hasToggle = await application.evaluate(({ Menu }) => {
      const view = Menu.getApplicationMenu()?.items.find(
        (item) => item.label === "View",
      );
      const toggle = view?.submenu?.items.find(
        (item) => item.label === "Toggle Developer Tools",
      );
      toggle?.click();
      return Boolean(toggle);
    });
    assert.equal(hasToggle, true);
    await mainWindow.waitForTimeout(1000);
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.isDevToolsOpened(),
        ),
      ),
      true,
    );
  } finally {
    await application.close();
  }
});

test("shows the available update dialog from the application menu", async () => {
  const application = await launchDesktop({
    updatePreviewState: "available",
  });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const { nextWindowPromise: availableWindowPromise } =
      await openManualUpdateCheck(application);
    const availableWindow = await availableWindowPromise;
    await availableWindow
      .getByRole("heading", {
        name: "A new version of Kitezh is available!",
      })
      .waitFor();
    const replayedStatus = await mainWindow.evaluate(
      () =>
        new Promise((resolve) => {
          let remove;
          remove = window.desktopApi?.updates.onStatus((status) => {
            remove?.();
            resolve(status);
          });
        }),
    );
    assert.deepEqual(replayedStatus, {
      state: "available",
      version: "0.1.1",
    });
    assert.equal(
      await availableWindow
        .getByRole("button", { name: "Skip This Version" })
        .count(),
      1,
    );
    assert.equal(
      await availableWindow
        .getByRole("button", { name: "Remind Me Later" })
        .count(),
      1,
    );
    assert.equal(
      await availableWindow
        .getByRole("button", { name: "Install Update" })
        .count(),
      1,
    );
    await availableWindow
      .getByRole("button", { name: "Skip This Version" })
      .click();
  } finally {
    await application.close();
  }
});

test("shows an up-to-date result when no update is available", async () => {
  const application = await launchDesktop({
    updatePreviewState: "not-available",
  });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const { nextWindowPromise: resultWindowPromise } =
      await openManualUpdateCheck(application);
    const resultWindow = await resultWindowPromise;
    await resultWindow
      .getByRole("heading", { name: "Kitezh is up to date" })
      .waitFor();
    assert.match(
      await resultWindow.locator("p").textContent(),
      /There are no new updates available/,
    );
    await resultWindow.getByRole("button", { name: "Done" }).click();
  } finally {
    await application.close();
  }
});

test("shows the update error in the renderer when checking fails", async () => {
  const application = await launchDesktop({ updatePreviewState: "error" });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const statusPromise = mainWindow.evaluate(
      () =>
        new Promise((resolve) => {
          let remove;
          remove = window.desktopApi?.updates.onStatus((status) => {
            if (status?.state !== "error") return;
            remove?.();
            resolve(status);
          });
        }),
    );
    await openManualUpdateCheck(application, "Check for Updates…", false);
    assert.deepEqual(await statusPromise, {
      state: "error",
      message: "Desktop update could not be checked.",
    });
  } finally {
    await application.close();
  }
});

test("localizes and themes the update dialog with desktop preferences", async () => {
  const application = await launchDesktop({ updatePreviewState: "available" });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const settingsWindowPromise = application.waitForEvent("window");
    await clickApplicationMenuItem(application, "Settings…");
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("radio", { name: "Dark" }).click();
    await settingsWindow.getByRole("button", { name: "General" }).click();
    await settingsWindow.locator("#desktop-language").selectOption("tr");
    await mainWindow
      .getByRole("heading", { name: "Bir konsol seçin" })
      .waitFor();
    await settingsWindow.getByRole("heading", { name: "Ayarlar" }).waitFor();
    const settingsClosed = settingsWindow.waitForEvent("close");
    await closeNativeSettings(application);
    await settingsClosed;
    await clickApplicationMenuItem(application, "Ayarlar…");
    const reopenedSettingsWindow = await windowWithHeading(
      application,
      "Ayarlar",
    );
    await reopenedSettingsWindow
      .getByRole("heading", { name: "Ayarlar" })
      .waitFor();
    assert.equal(
      await reopenedSettingsWindow.locator("#desktop-language").inputValue(),
      "tr",
    );
    const reopenedSettingsClosed = reopenedSettingsWindow.waitForEvent("close");
    await closeNativeSettings(application);
    await reopenedSettingsClosed;
    await clickApplicationMenuItem(application, "Güncellemeleri denetle…");
    const availableWindow = await windowWithHeading(
      application,
      "Yeni bir Kitezh sürümü var!",
    );
    assert.equal(
      await availableWindow
        .getByRole("button", { name: "Bu sürümü atla" })
        .count(),
      1,
    );
    assert.equal(
      await availableWindow.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
      "rgb(32, 33, 36)",
    );
  } finally {
    await application.close();
  }
});
