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

test("preserves Account profile drafts offline and blocks saves until reconnect", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__accountWrites = [];
      shell.openExternal = async (url) => {
        globalThis.__pendingAuthorizationUrl = url;
      };
      globalThis.fetch = async (url, init) => {
        const requestUrl = new URL(String(url));
        const method = String(init?.method ?? "GET").toUpperCase();
        if (requestUrl.pathname === "/oauth2/token")
          return new Response(
            JSON.stringify({
              access_token: "test-account-access-token",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/account/profile" && method === "GET")
          return new Response(
            JSON.stringify({
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.test",
              preferredLocale: "en",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/account/mfa")
          return new Response(
            JSON.stringify({ available: true, enabled: false, digits: 6 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/account/mfa/recovery-codes")
          return new Response(
            JSON.stringify({ available: true, remaining: 0 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        if (requestUrl.pathname === "/api/account/social-links")
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        if (
          (requestUrl.pathname === "/api/account/profile" ||
            requestUrl.pathname === "/api/auth/localization/me") &&
          method === "PUT"
        ) {
          const body = JSON.parse(String(init.body));
          globalThis.__accountWrites.push({ path: requestUrl.pathname, body });
          return new Response(
            JSON.stringify(
              requestUrl.pathname === "/api/account/profile"
                ? {
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email,
                    preferredLocale: "en",
                  }
                : { locale: body.locale },
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error("Unexpected Account API request");
      };
    });
    const window = await nativeMainWindow(application);
    await window
      .getByRole("button", { name: "Account Console", exact: true })
      .click();
    const signIn = window.getByRole("button", {
      name: "Sign in",
      exact: true,
    });
    await signIn.waitFor();
    assert.equal(await signIn.isDisabled(), true);
    await application.evaluate(({ app }) => {
      const state = new URL(
        globalThis.__pendingAuthorizationUrl,
      ).searchParams.get("state");
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&code=test-account-code`,
      );
    });
    const profileForm = window.locator('form[data-form="profile"]');
    await profileForm.locator('[name="firstName"]').waitFor();
    await profileForm.locator('[name="firstName"]').fill("Grace");
    await profileForm.locator('[name="lastName"]').fill("Hopper");
    await profileForm.locator('[name="email"]').fill("grace@example.test");
    await profileForm.locator('[name="preferredLocale"]').selectOption("tr");
    await profileForm
      .locator('[name="currentPassword"]')
      .fill("TEMPORARY_SECRET");
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    const save = profileForm.getByRole("button", { name: "Save" });
    assert.equal(await save.isDisabled(), true);
    assert.match(
      await window.getByRole("status").textContent(),
      /Offline mode/,
    );
    assert.equal(
      await profileForm.locator('[name="firstName"]').inputValue(),
      "Grace",
    );
    assert.equal(
      await profileForm.locator('[name="lastName"]').inputValue(),
      "Hopper",
    );
    assert.equal(
      await profileForm.locator('[name="email"]').inputValue(),
      "grace@example.test",
    );
    assert.equal(
      await profileForm.locator('[name="preferredLocale"]').inputValue(),
      "tr",
    );
    assert.equal(
      await profileForm.locator('[name="currentPassword"]').inputValue(),
      "",
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__accountWrites),
      [],
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    assert.equal(await save.isDisabled(), false);
    await save.click();
    let writeCount = 0;
    for (let attempt = 0; attempt < 20 && writeCount < 2; attempt += 1) {
      writeCount = await application.evaluate(
        () => globalThis.__accountWrites?.length ?? 0,
      );
      if (writeCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.equal(writeCount, 2);
    const accountWrites = await application.evaluate(
      () => globalThis.__accountWrites,
    );
    assert.deepEqual(accountWrites, [
      {
        path: "/api/account/profile",
        body: {
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.test",
        },
      },
      { path: "/api/auth/localization/me", body: { locale: "tr" } },
    ]);
    await window.getByRole("button", { name: "Security", exact: true }).click();
    await window
      .getByRole("button", { name: "Set up authenticator" })
      .waitFor();
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    assert.equal(
      await window
        .getByRole("button", { name: "Save", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await window
        .getByRole("button", { name: "Set up authenticator" })
        .isDisabled(),
      true,
    );
    assert.equal(
      await window
        .getByRole("button", { name: "Delete account", exact: true })
        .isDisabled(),
      true,
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__accountWrites),
      accountWrites,
    );
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
      globalThis.fetch = async (url, init) => {
        const requestUrl = new URL(String(url));
        const requestMethod = String(init?.method ?? "GET").toUpperCase();
        if (
          requestMethod === "PUT" &&
          [
            "/api/admin/settings/ciba-policy",
            "/api/admin/settings/offline-access",
            "/api/admin/settings/branding",
          ].includes(requestUrl.pathname)
        )
          globalThis.__requestBody = init?.body;
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
        if (
          requestUrl.pathname === "/api/admin/users" &&
          requestMethod === "POST"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminUserCreateRequests ??= [];
          globalThis.__adminUserCreateRequests.push({
            username: body.username,
            email: body.email,
            roles: body.roles,
            passwordProvided: Boolean(body.password),
            temporary: body.temporary,
            enabled: body.enabled,
            emailVerified: body.emailVerified,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.username === "duplicate-user")
            return new Response(
              JSON.stringify({
                detail: "Correct the user fields.",
                violations: [
                  {
                    field: "username",
                    message: "This username is already used.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          globalThis.__createdUsers ??= [];
          globalThis.__createdUsers.push({
            id: 99,
            username: body.username,
            email: body.email,
            enabled: body.enabled,
            authorities: body.roles,
            effectiveRoles: body.roles,
          });
          return new Response(
            JSON.stringify(globalThis.__createdUsers.at(-1)),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
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
          const content = [
            {
              id: page + 1,
              username,
              email: `${username}@example.test`,
              enabled: true,
              authorities: ["ROLE_USER"],
              effectiveRoles: ["ROLE_USER"],
            },
          ];
          if (!query && page === 0)
            content.push(...(globalThis.__createdUsers ?? []));
          return new Response(
            JSON.stringify({
              content,
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
        if (
          /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const roleName = requestUrl.pathname.split("/").at(-1);
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminRoleUpdateRequests ??= [];
          globalThis.__adminRoleUpdateRequests.push({
            name: roleName,
            description: body.description,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.description === "Rejected description")
            return new Response(
              JSON.stringify({
                detail: "Correct the role fields.",
                violations: [
                  {
                    field: "description",
                    message: "Açıklama reddedildi.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          globalThis.__updatedRoles ??= {};
          globalThis.__updatedRoles[roleName] = {
            name: roleName,
            description: body.description,
          };
          return new Response(
            JSON.stringify(globalThis.__updatedRoles[roleName]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/roles") {
          if (requestMethod === "POST") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminRoleCreateRequests ??= [];
            globalThis.__adminRoleCreateRequests.push({
              name: body.name,
              description: body.description,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.name === "ROLE_AUDITOR")
              return new Response(
                JSON.stringify({
                  detail: "Correct the role fields.",
                  violations: [
                    {
                      field: "name",
                      message: "This role name is already registered.",
                    },
                  ],
                }),
                {
                  status: 409,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__createdRoles ??= [];
            globalThis.__createdRoles.push({
              name: body.name,
              description: body.description,
            });
            return new Response(
              JSON.stringify(globalThis.__createdRoles.at(-1)),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
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
          const roles =
            requestUrl.searchParams.get("size") === "100"
              ? [
                  { name: "ROLE_USER", description: "Standard user role" },
                  { name: "ROLE_ADMIN", description: "Administrator role" },
                ]
              : [{ name, description: "Scoped authorization role" }];
          if (!query && page === 0)
            roles.push(
              ...(globalThis.__createdRoles ?? []).map(
                (role) => globalThis.__updatedRoles?.[role.name] ?? role,
              ),
            );
          return new Response(
            JSON.stringify({
              content: roles,
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
          if (requestMethod === "POST") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminGroupCreateRequests ??= [];
            globalThis.__adminGroupCreateRequests.push(body);
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.name === "finance")
              return new Response(
                JSON.stringify({
                  detail: "Correct the group fields.",
                  violations: [
                    {
                      field: "name",
                      message: "Group name is already registered.",
                    },
                  ],
                }),
                {
                  status: 409,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__createdGroups ??= [];
            globalThis.__createdGroups.push({
              id: 99,
              name: body.name,
              path: `Organization / ${body.name}`,
              roles: [],
              effectiveRoles: [],
              userCount: 0,
            });
            return new Response(
              JSON.stringify(globalThis.__createdGroups.at(-1)),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
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
          const content = [
            {
              id: page + 1,
              name,
              path: `Organization / ${name}`,
              roles: ["ROLE_USER_VIEWER"],
              effectiveRoles: ["ROLE_USER_VIEWER"],
              userCount: 3,
            },
          ];
          if (!query && page === 0)
            content.push(...(globalThis.__createdGroups ?? []));
          return new Response(
            JSON.stringify({
              content,
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
        if (
          /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const scopeId = requestUrl.pathname.split("/").at(-1);
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminClientScopeUpdateRequests ??= [];
          globalThis.__adminClientScopeUpdateRequests.push({
            id: scopeId,
            ...body,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.displayName === "Rejected scope name")
            return new Response(
              JSON.stringify({
                detail: "Correct the client scope fields.",
                violations: [
                  { field: "displayName", message: "Görünen ad reddedildi." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          globalThis.__updatedClientScopes ??= {};
          globalThis.__updatedClientScopes[scopeId] = {
            id: scopeId,
            ...body,
            builtIn: false,
          };
          return new Response(
            JSON.stringify(globalThis.__updatedClientScopes[scopeId]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/client-scopes") {
          if (requestMethod === "POST") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminClientScopeCreateRequests ??= [];
            globalThis.__adminClientScopeCreateRequests.push(body);
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.name === "account-api")
              return new Response(
                JSON.stringify({
                  detail: "Correct the client scope fields.",
                  violations: [
                    {
                      field: "name",
                      message: "Client scope name is already registered.",
                    },
                  ],
                }),
                {
                  status: 409,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__createdClientScopes ??= [];
            globalThis.__createdClientScopes.push({
              id: "scope-native-observer",
              name: body.name,
              displayName: body.displayName,
              description: body.description,
              builtIn: false,
            });
            return new Response(
              JSON.stringify(globalThis.__createdClientScopes.at(-1)),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          globalThis.__adminClientScopeRequests ??= [];
          globalThis.__adminClientScopeRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const page = Number(requestUrl.searchParams.get("page") ?? 0);
          const query = requestUrl.searchParams.get("q") ?? "";
          const name = query ? "account-api" : "openid";
          const content = [
            {
              id: `scope-${name}`,
              name,
              displayName: name === "openid" ? "OpenID" : "Account API",
              description: "Read-only scope description",
              builtIn: name === "openid",
            },
          ];
          if (!query && page === 0)
            content.push(
              ...(globalThis.__createdClientScopes ?? []).map(
                (scope) =>
                  globalThis.__updatedClientScopes?.[scope.id] ?? scope,
              ),
            );
          return new Response(
            JSON.stringify({
              content,
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
        if (
          requestUrl.pathname === "/api/admin/settings/ciba-policy" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(globalThis.__requestBody);
          globalThis.__cibaPolicyUpdates ??= [];
          globalThis.__cibaPolicyUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.requestLifespanSeconds > 3600)
            return new Response(
              JSON.stringify({
                detail: "Correct the policy fields.",
                violations: [
                  {
                    field: "requestLifespanSeconds",
                    message: "Lifetime must not exceed 3600 seconds.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
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
        if (
          requestUrl.pathname === "/api/admin/settings/offline-access" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(globalThis.__requestBody);
          globalThis.__offlineAccessPolicyUpdates ??= [];
          globalThis.__offlineAccessPolicyUpdates.push(body);
          globalThis.__offlineAccessPolicyUpdate = body;
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({ ...body, revokedBefore: "2026-01-01T00:00:00Z" }),
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
        if (
          requestUrl.pathname === "/api/admin/settings/branding" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__brandingUpdates ??= [];
          globalThis.__brandingUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (!/^#[0-9a-fA-F]{6}$/.test(body.primaryColor))
            return new Response(
              JSON.stringify({
                detail: "Correct the branding fields.",
                violations: [
                  {
                    field: "primaryColor",
                    message: "Enter a six-digit hex color.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(
            JSON.stringify({
              ...body,
              logoPath: "/assets/logo.svg",
              faviconPath: "/assets/favicon.ico",
              appleTouchIconPath: "/assets/apple-touch.png",
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
        if (requestUrl.pathname === "/api/admin/settings/login") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              userRegistration: true,
              forgotPassword: true,
              rememberMe: true,
              loginWithEmail: true,
              verifyEmail: true,
              sessionTimeoutMinutes: 30,
              passwordMinimumLength: 12,
              bruteForceEnabled: true,
              bruteForceMaxFailures: 5,
              otpEnabled: true,
              otpRequired: false,
              passkeys: true,
              passwordCommonPasswords: "SECRET_COMMON_PASSWORDS_NEVER_RENDER",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          requestUrl.pathname === "/api/admin/settings/email" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__emailSettingsUpdates ??= [];
          globalThis.__emailSettingsUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.host === "invalid.example.test")
            return new Response(
              JSON.stringify({
                detail: "Correct the email settings.",
                violations: [
                  { field: "host", message: "SMTP host is invalid." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          const { password: _password, ...safeSettings } = body;
          return new Response(
            JSON.stringify({
              ...safeSettings,
              passwordConfigured: true,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/settings/email") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              enabled: true,
              fromAddress: "noreply@example.test",
              baseUrl: "https://app.example.test",
              host: "smtp.example.test",
              port: 587,
              username: "private-mailbox@example.test",
              passwordConfigured: true,
              smtpAuth: true,
              starttls: true,
              ssl: false,
              smtpPassword: "SECRET_SMTP_PASSWORD_NEVER_RENDER",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          requestUrl.pathname === "/api/admin/settings/localization" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__localizationSettingsUpdates ??= [];
          globalThis.__localizationSettingsUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (!body.supportedLocales.includes(body.defaultLocale))
            return new Response(
              JSON.stringify({
                detail: "Correct the localization settings.",
                violations: [
                  {
                    field: "defaultLocale",
                    message: "Default language must be enabled.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (requestUrl.pathname === "/api/admin/settings/localization") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              internationalizationEnabled: true,
              defaultLocale: "en",
              supportedLocales: ["en", "tr"],
              availableLocales: ["en", "tr"],
              availableBundles: ["backend", "common"],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          requestUrl.pathname ===
            "/api/admin/settings/localization/messages/1" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__localizationMessageUpdates ??= [];
          globalThis.__localizationMessageUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.locale !== "tr")
            return new Response(
              JSON.stringify({
                detail: "Correct the localization fields.",
                violations: [
                  { field: "locale", message: "Use a supported locale." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(JSON.stringify({ id: 1, ...body }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          requestUrl.pathname === "/api/admin/settings/localization/messages"
        ) {
          globalThis.__localizationMessageRequests ??= [];
          globalThis.__localizationMessageRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 1,
                  locale: "tr",
                  bundle: "admin",
                  messageKey: "login.title",
                  messageValue: "<img src=x onerror=alert(1)>",
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
        if (requestUrl.pathname === "/api/admin/settings/ldap") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify([
              {
                id: "directory-1",
                name: "Corporate Directory",
                enabled: true,
                vendor: "Active Directory",
                authenticationType: "SIMPLE",
                editMode: "READ_ONLY",
                importUsers: true,
                trustEmail: false,
                lastSyncAt: "2026-10-10T07:00:00Z",
                lastSyncStatus: "SUCCESS",
                lastSyncImported: 12,
                lastSyncUpdated: 3,
                connectionUrl: "ldaps://private-directory.internal:636",
                bindDn: "CN=secret-service-account",
                lastSyncError: "PRIVATE_DIRECTORY_ERROR_NEVER_RENDER",
                bindPassword: "SECRET_LDAP_PASSWORD_NEVER_RENDER",
              },
            ]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/authentication/flows") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 1,
                  alias: "browser",
                  name: "Browser",
                  description: "Primary browser authentication flow",
                  flowType: "BASIC",
                  topLevel: true,
                  builtIn: true,
                  requirement: null,
                  priority: 0,
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
        if (requestUrl.pathname === "/api/admin/authentication/bindings") {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify([
              {
                bindingType: "BROWSER",
                flowId: 1,
                flowAlias: "browser",
                flowName: "Browser",
              },
            ]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          requestUrl.pathname ===
          "/api/admin/authentication/execution-providers"
        ) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(JSON.stringify(["password", "totp"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
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
    await window.emulateMedia({ forcedColors: "active" });
    assert.deepEqual(
      await window.evaluate(() => ({
        background: getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
        primary: getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim(),
        text: getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      })),
      { background: "Canvas", primary: "Highlight", text: "CanvasText" },
    );
    await window.emulateMedia({ forcedColors: "none" });
    const signOut = window.getByRole("button", {
      name: "Sign out",
      exact: true,
    });
    assert.equal(await signOut.locator(".button-icon").textContent(), "↪");
    assert.equal(
      await signOut.locator(".button-icon").getAttribute("aria-hidden"),
      "true",
    );
    const languageToggle = window.getByRole("button", {
      name: "Turkish",
      exact: true,
    });
    assert.equal(
      await languageToggle.locator(".button-icon").textContent(),
      "◎",
    );
    assert.equal(
      await languageToggle.locator(".button-icon").getAttribute("aria-hidden"),
      "true",
    );
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
    const usersNav = window.getByRole("button", {
      name: "Users",
      exact: true,
    });
    await usersNav.click();
    assert.equal(await usersNav.isDisabled(), true);
    assert.equal(await usersNav.locator(".spinner").count(), 1);
    const createUserAction = window.locator(".topbar").getByRole("button", {
      name: "Create user",
      exact: true,
    });
    await createUserAction.click();
    assert.equal(await createUserAction.isDisabled(), true);
    assert.equal(await createUserAction.locator(".spinner").count(), 1);
    await window
      .getByRole("heading", { name: "Create user", exact: true })
      .waitFor();
    const userCreateForm = window.locator(
      'form[data-form="admin-user-create"]',
    );
    await userCreateForm.locator('[name="username"]').fill("duplicate-user");
    await userCreateForm.locator('[name="firstName"]').fill("Native");
    await userCreateForm.locator('[name="lastName"]').fill("Account");
    await userCreateForm
      .locator('[name="email"]')
      .fill("native-account@example.test");
    await userCreateForm
      .locator('[name="password"]')
      .fill("TemporaryChange12!");
    assert.equal(
      await userCreateForm
        .locator('input[name="roles"][value="ROLE_USER"]')
        .isChecked(),
      true,
    );
    const createUserSubmit = userCreateForm.getByRole("button", {
      name: "Create user",
      exact: true,
    });
    await createUserSubmit.click();
    assert.equal(await createUserSubmit.isDisabled(), true);
    assert.equal(await createUserSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("This username is already used.", { exact: true })
      .waitFor();
    assert.equal(
      await userCreateForm.locator('[name="username"]').inputValue(),
      "duplicate-user",
    );
    assert.equal(
      await userCreateForm.locator('[name="password"]').inputValue(),
      "",
    );
    await userCreateForm.locator('[name="username"]').fill("new-native-user");
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Kullanıcı oluştur", exact: true })
      .waitFor();
    await window.waitForFunction(() => {
      const localeButton = document.querySelector(
        '.sidebar-footer button[data-action="toggle-locale"]',
      );
      return localeButton && !localeButton.disabled;
    });
    await userCreateForm
      .locator('[name="password"]')
      .fill("TemporaryChange12!");
    await userCreateForm
      .getByRole("button", { name: "Kullanıcı oluştur", exact: true })
      .click();
    await window.getByText("Kullanıcı oluşturuldu.", { exact: true }).waitFor();
    await window
      .getByText("native-account@example.test", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminUserCreateRequests),
      [
        {
          username: "duplicate-user",
          email: "native-account@example.test",
          roles: ["ROLE_USER"],
          passwordProvided: true,
          temporary: false,
          enabled: true,
          emailVerified: false,
        },
        {
          username: "new-native-user",
          email: "native-account@example.test",
          roles: ["ROLE_USER"],
          passwordProvided: true,
          temporary: false,
          enabled: true,
          emailVerified: false,
        },
      ],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    const rolesNav = window.getByRole("button", {
      name: "Roles",
      exact: true,
    });
    await rolesNav.click();
    await window.getByRole("button", { name: "Search roles" }).waitFor();
    await window
      .locator(".topbar")
      .getByRole("button", { name: "Create role", exact: true })
      .click();
    await window
      .getByRole("heading", { name: "Create role", exact: true })
      .waitFor();
    const roleCreateForm = window.locator(
      'form[data-form="admin-role-create"]',
    );
    await roleCreateForm.locator('[name="name"]').fill("ROLE_AUDITOR");
    await roleCreateForm
      .locator('[name="description"]')
      .fill("Audits role creation");
    const roleCreateSubmit = roleCreateForm.getByRole("button", {
      name: "Create role",
      exact: true,
    });
    await roleCreateSubmit.click();
    assert.equal(await roleCreateSubmit.isDisabled(), true);
    assert.equal(await roleCreateSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("This role name is already registered.", { exact: true })
      .waitFor();
    assert.equal(
      await roleCreateForm.locator('[name="name"]').inputValue(),
      "ROLE_AUDITOR",
    );
    await roleCreateForm.locator('[name="name"]').fill("badrole");
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Rol oluştur", exact: true })
      .waitFor();
    await window.waitForFunction(() => {
      const localeButton = document.querySelector(
        '.sidebar-footer button[data-action="toggle-locale"]',
      );
      return localeButton && !localeButton.disabled;
    });
    assert.equal(
      await roleCreateForm.locator('[name="name"]').inputValue(),
      "badrole",
    );
    await roleCreateForm
      .getByRole("button", { name: "Rol oluştur", exact: true })
      .click();
    await window
      .getByText(
        "ROLE_ sonrasında büyük harf, rakam veya alt çizgi kullanın.",
        { exact: true },
      )
      .waitFor();
    await roleCreateForm.locator('[name="name"]').fill("ROLE_NATIVE_VIEWER");
    await roleCreateForm
      .getByRole("button", { name: "Rol oluştur", exact: true })
      .click();
    await window.getByText("Rol oluşturuldu.", { exact: true }).waitFor();
    await window.getByText("ROLE_NATIVE_VIEWER", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminRoleCreateRequests),
      [
        { name: "ROLE_AUDITOR", description: "Audits role creation" },
        { name: "ROLE_NATIVE_VIEWER", description: "Audits role creation" },
      ],
    );
    const roleEditForm = window.locator(
      'form[data-form="admin-role-edit"][data-role-name="ROLE_NATIVE_VIEWER"]',
    );
    await roleEditForm
      .locator('[name="description"]')
      .fill("Rejected description");
    const roleUpdateSubmit = roleEditForm.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    await roleUpdateSubmit.click();
    assert.equal(await roleUpdateSubmit.isDisabled(), true);
    assert.equal(await roleUpdateSubmit.locator(".spinner").count(), 1);
    await roleEditForm
      .getByText("Açıklama reddedildi.", { exact: true })
      .waitFor();
    await roleEditForm
      .locator('[name="description"]')
      .fill("Native viewer access");
    await roleUpdateSubmit.click();
    assert.equal(await roleUpdateSubmit.isDisabled(), true);
    assert.equal(await roleUpdateSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("Rol açıklaması güncellendi.", { exact: true })
      .waitFor();
    assert.equal(
      await roleEditForm.locator('[name="description"]').inputValue(),
      "Native viewer access",
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminRoleUpdateRequests),
      [
        {
          name: "ROLE_NATIVE_VIEWER",
          description: "Rejected description",
        },
        { name: "ROLE_NATIVE_VIEWER", description: "Native viewer access" },
      ],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Search roles" }).waitFor();
    await application.evaluate(({ Tray }) => {
      globalThis.__trayTooltips = [];
      const originalSetToolTip = Tray.prototype.setToolTip;
      Tray.prototype.setToolTip = function (value) {
        globalThis.__trayTooltips.push(value);
        return originalSetToolTip.call(this, value);
      };
    });
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("button", { name: "Rol ara" }).waitFor();
    assert.equal(await window.getByText("ROLE_NATIVE_VIEWER").count(), 1);
    assert.equal(
      await application.evaluate(() => globalThis.__trayTooltips.at(-1)),
      "Kitezh — güvenli kimlik konsolu",
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    assert.equal(
      await application.evaluate(() => globalThis.__trayTooltips.at(-1)),
      "Kitezh — secure identity console",
    );
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
    await window
      .locator(".topbar")
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await window
      .getByRole("heading", { name: "Create group", exact: true })
      .waitFor();
    const groupCreateForm = window.locator(
      'form[data-form="admin-group-create"]',
    );
    await groupCreateForm.locator('[name="name"]').fill("finance");
    const groupCreateSubmit = groupCreateForm.getByRole("button", {
      name: "Create group",
      exact: true,
    });
    await groupCreateSubmit.click();
    assert.equal(await groupCreateSubmit.isDisabled(), true);
    assert.equal(await groupCreateSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("Group name is already registered.", { exact: true })
      .waitFor();
    await groupCreateForm.locator('[name="name"]').fill("native-operators");
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Grup oluştur", exact: true })
      .waitFor();
    await window.waitForFunction(() => {
      const localeButton = document.querySelector(
        '.sidebar-footer button[data-action="toggle-locale"]',
      );
      return localeButton && !localeButton.disabled;
    });
    assert.equal(
      await groupCreateForm.locator('[name="name"]').inputValue(),
      "native-operators",
    );
    await groupCreateForm
      .getByRole("button", { name: "Grup oluştur", exact: true })
      .click();
    await window.getByText("Grup oluşturuldu.", { exact: true }).waitFor();
    await window.getByText("Organization / native-operators").waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminGroupCreateRequests),
      [
        {
          name: "finance",
          parentId: null,
          attributes: {},
          defaultGroup: false,
        },
        {
          name: "native-operators",
          parentId: null,
          attributes: {},
          defaultGroup: false,
        },
      ],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Search groups" }).waitFor();
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
    await window
      .locator(
        'form[data-form="admin-client-scope-edit"][data-scope-id="scope-account-api"]',
      )
      .waitFor();
    const clientScopeRequests = await application.evaluate(
      () => globalThis.__adminClientScopeRequests,
    );
    assert.equal(
      new URLSearchParams(clientScopeRequests[1]).get("q"),
      "account",
    );
    await window
      .locator(".topbar")
      .getByRole("button", { name: "Create client scope", exact: true })
      .click();
    await window
      .getByRole("heading", {
        name: "Create client scope",
        exact: true,
      })
      .waitFor();
    const clientScopeCreateForm = window.locator(
      'form[data-form="admin-client-scope-create"]',
    );
    await clientScopeCreateForm.locator('[name="name"]').fill("account-api");
    await clientScopeCreateForm
      .locator('[name="displayName"]')
      .fill("Native observer");
    await clientScopeCreateForm
      .locator('[name="description"]')
      .fill("Read-only native console scope");
    const clientScopeCreateSubmit = clientScopeCreateForm.getByRole("button", {
      name: "Create client scope",
      exact: true,
    });
    await clientScopeCreateSubmit.click();
    assert.equal(await clientScopeCreateSubmit.isDisabled(), true);
    assert.equal(await clientScopeCreateSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("Client scope name is already registered.", { exact: true })
      .waitFor();
    await clientScopeCreateForm
      .locator('[name="name"]')
      .fill("native-observer");
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", {
        name: "İstemci kapsamı oluştur",
        exact: true,
      })
      .waitFor();
    await window.waitForFunction(() => {
      const localeButton = document.querySelector(
        '.sidebar-footer button[data-action="toggle-locale"]',
      );
      return localeButton && !localeButton.disabled;
    });
    await clientScopeCreateForm
      .getByRole("button", { name: "İstemci kapsamı oluştur", exact: true })
      .click();
    await window
      .getByText("İstemci kapsamı oluşturuldu.", { exact: true })
      .waitFor();
    const createdScopeForm = window.locator(
      'form[data-form="admin-client-scope-edit"][data-scope-id="scope-native-observer"]',
    );
    await createdScopeForm.waitFor();
    assert.equal(
      await createdScopeForm.locator('[name="displayName"]').inputValue(),
      "Native observer",
    );
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientScopeCreateRequests,
      ),
      [
        {
          name: "account-api",
          displayName: "Native observer",
          description: "Read-only native console scope",
        },
        {
          name: "native-observer",
          displayName: "Native observer",
          description: "Read-only native console scope",
        },
      ],
    );
    const scopeEditForm = window.locator(
      'form[data-form="admin-client-scope-edit"][data-scope-id="scope-native-observer"]',
    );
    await scopeEditForm
      .locator('[name="displayName"]')
      .fill("Rejected scope name");
    const scopeUpdateSubmit = scopeEditForm.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    await scopeUpdateSubmit.click();
    assert.equal(await scopeUpdateSubmit.isDisabled(), true);
    assert.equal(await scopeUpdateSubmit.locator(".spinner").count(), 1);
    await scopeEditForm
      .getByText("Görünen ad reddedildi.", { exact: true })
      .waitFor();
    await scopeEditForm
      .locator('[name="displayName"]')
      .fill("Native observer updated");
    await scopeUpdateSubmit.click();
    assert.equal(await scopeUpdateSubmit.isDisabled(), true);
    assert.equal(await scopeUpdateSubmit.locator(".spinner").count(), 1);
    await window
      .getByText("İstemci kapsamı güncellendi.", { exact: true })
      .waitFor();
    await window
      .locator(
        'form[data-form="admin-client-scope-edit"][data-scope-id="scope-native-observer"] [name="displayName"]',
      )
      .waitFor({ state: "visible" });
    assert.equal(
      await scopeEditForm.locator('[name="displayName"]').inputValue(),
      "Native observer updated",
    );
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientScopeUpdateRequests,
      ),
      [
        {
          id: "scope-native-observer",
          name: "native-observer",
          displayName: "Rejected scope name",
          description: "Read-only native console scope",
        },
        {
          id: "scope-native-observer",
          name: "native-observer",
          displayName: "Native observer updated",
          description: "Read-only native console scope",
        },
      ],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window
      .getByRole("button", { name: "Search client scopes" })
      .waitFor();
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
    const cibaForm = window.locator('form[data-form="admin-ciba-policy"]');
    assert.equal(
      await cibaForm.locator('[name="requestLifespanSeconds"]').inputValue(),
      "300",
    );
    assert.equal(
      await cibaForm.locator('[name="pollingIntervalSeconds"]').inputValue(),
      "5",
    );
    assert.equal(
      await cibaForm.locator('[name="stepUpAcr"]').inputValue(),
      "urn:kitezh:loa:2",
    );
    const offlineForm = window.locator(
      'form[data-form="admin-offline-access-policy"]',
    );
    assert.equal(
      await offlineForm.locator('[name="idleTimeout"]').inputValue(),
      "P30D",
    );
    assert.equal(
      await offlineForm.locator('[name="maxLifespan"]').inputValue(),
      "P180D",
    );
    const cibaLifespan = cibaForm.locator('[name="requestLifespanSeconds"]');
    await cibaLifespan.fill("5000");
    const cibaSave = cibaForm.getByRole("button", { name: "Save" });
    await cibaSave.click();
    assert.equal(await cibaSave.isDisabled(), true);
    assert.equal(await cibaSave.locator(".spinner").count(), 1);
    await window
      .getByText("Lifetime must not exceed 3600 seconds.", { exact: true })
      .waitFor();
    assert.equal(await cibaLifespan.getAttribute("aria-invalid"), "true");
    assert.equal(await cibaLifespan.inputValue(), "5000");
    await cibaLifespan.fill("600");
    await cibaSave.click();
    assert.equal(await cibaSave.isDisabled(), true);
    assert.equal(await cibaSave.locator(".spinner").count(), 1);
    await window.getByText("Policy settings saved.").waitFor();
    const cibaUpdates = await application.evaluate(
      () => globalThis.__cibaPolicyUpdates,
    );
    assert.equal(cibaUpdates[1].requestLifespanSeconds, 600);
    await offlineForm.locator('[name="idleTimeout"]').fill("P45D");
    await offlineForm.locator('[name="maxLifespan"]').fill("P365D");
    await offlineForm.locator('[name="maxLimited"]').check();
    const offlineSave = offlineForm.locator('button[type="submit"]');
    await offlineSave.click();
    assert.equal(await offlineSave.isDisabled(), true);
    assert.equal(await offlineSave.locator(".spinner").count(), 1);
    await window.getByText("Policy settings saved.").waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__offlineAccessPolicyUpdate),
      { idleTimeout: "P45D", maxLifespan: "P365D", maxLimited: true },
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Politikalar", exact: true })
      .waitFor();
    await offlineForm.locator('[name="idleTimeout"]').fill("P50D");
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    await window
      .getByText(
        "Çevrimdışı mod: güvenli değişiklikler bağlantı gelene kadar devre dışı.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await offlineForm.locator('[name="idleTimeout"]').inputValue(),
      "P50D",
    );
    assert.equal(await offlineSave.isDisabled(), true);
    await offlineForm.locator('[name="idleTimeout"]').fill("P51D");
    assert.equal(
      await application.evaluate(
        () => globalThis.__offlineAccessPolicyUpdates.length,
      ),
      1,
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await window
      .getByText(
        "Çevrimdışı mod: güvenli değişiklikler bağlantı gelene kadar devre dışı.",
        { exact: true },
      )
      .waitFor({ state: "detached" });
    assert.equal(
      await offlineForm.locator('[name="idleTimeout"]').inputValue(),
      "P51D",
    );
    await offlineSave.click();
    await window
      .getByText("Politika ayarları kaydedildi.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__offlineAccessPolicyUpdate),
      { idleTimeout: "P51D", maxLifespan: "P365D", maxLimited: true },
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window
      .getByRole("heading", { name: "Policies", exact: true })
      .waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Politikalar", exact: true })
      .waitFor();
    await window.getByText("İstek ömrü (saniye)", { exact: true }).waitFor();
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
    const brandingForm = window.locator('form[data-form="admin-branding"]');
    assert.equal(
      await brandingForm.locator('[name="applicationName"]').inputValue(),
      "Kitezh <Admin>",
    );
    const brandingPrimary = brandingForm.locator('[name="primaryColor"]');
    await brandingPrimary.fill("blue");
    const brandingSave = brandingForm.getByRole("button", { name: "Save" });
    await brandingSave.click();
    assert.equal(await brandingSave.isDisabled(), true);
    assert.equal(await brandingSave.locator(".spinner").count(), 1);
    await window
      .getByText("Enter a six-digit hex color.", { exact: true })
      .waitFor();
    assert.equal(await brandingPrimary.inputValue(), "blue");
    await brandingPrimary.fill("#123abc");
    await brandingSave.click();
    assert.equal(await brandingSave.isDisabled(), true);
    assert.equal(await brandingSave.locator(".spinner").count(), 1);
    await window
      .getByText("Branding settings saved.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__brandingUpdates.at(-1)),
      {
        applicationName: "Kitezh <Admin>",
        primaryColor: "#123abc",
        accentColor: "#0b2b69",
        backgroundColor: "#f8f9fa",
      },
    );
    assert.equal(
      await brandingForm.locator('[name="applicationName"]').inputValue(),
      "Kitezh <Admin>",
    );
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
    await brandingForm
      .locator('[name="applicationName"]')
      .fill("Kitezh Yönetim");
    await brandingForm.getByRole("button", { name: "Kaydet" }).click();
    await window
      .getByText("Markalama ayarları kaydedildi.", { exact: true })
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    const loginEmailNavigation = window.getByRole("button", {
      name: "Login & email",
      exact: true,
    });
    await loginEmailNavigation.click();
    assert.equal(await loginEmailNavigation.isDisabled(), true);
    assert.equal(await loginEmailNavigation.locator(".spinner").count(), 1);
    await window.getByRole("heading", { name: "Login policy" }).waitFor();
    const emailForm = window.locator('form[data-form="admin-email-settings"]');
    await window.getByLabel("SMTP host", { exact: true }).waitFor();
    assert.equal(await emailForm.locator('[name="password"]').inputValue(), "");
    assert.equal(
      await window
        .getByText("private-mailbox@example.test", { exact: true })
        .count(),
      0,
    );
    const emailHost = emailForm.locator('[name="host"]');
    await emailHost.fill("invalid.example.test");
    const emailSave = emailForm.getByRole("button", { name: "Save" });
    assert.equal(await emailSave.locator(".button-icon").textContent(), "✓");
    assert.equal(
      await emailSave.locator(".button-icon").getAttribute("aria-hidden"),
      "true",
    );
    await emailSave.click();
    assert.equal(await emailSave.isDisabled(), true);
    assert.equal(await emailSave.locator(".spinner").count(), 1);
    await window.getByText("SMTP host is invalid.", { exact: true }).waitFor();
    assert.equal(await emailHost.inputValue(), "invalid.example.test");
    assert.equal(await emailForm.locator('[name="password"]').inputValue(), "");
    await emailHost.fill("smtp.example.test");
    await emailSave.click();
    assert.equal(await emailSave.isDisabled(), true);
    assert.equal(await emailSave.locator(".spinner").count(), 1);
    await window.getByText("Email settings saved.", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() =>
        globalThis.__emailSettingsUpdates.at(-1),
      ),
      {
        enabled: true,
        fromAddress: "noreply@example.test",
        baseUrl: "https://app.example.test",
        host: "smtp.example.test",
        port: 587,
        username: "private-mailbox@example.test",
        password: "",
        smtpAuth: true,
        starttls: true,
        ssl: false,
      },
    );
    await window.getByText("12", { exact: true }).waitFor();
    assert.equal(
      await window.getByText("SECRET_COMMON_PASSWORDS_NEVER_RENDER").count(),
      0,
    );
    assert.equal(
      await window.getByText("SECRET_SMTP_PASSWORD_NEVER_RENDER").count(),
      0,
    );
    assert.equal(
      await window.getByText("private-mailbox@example.test").count(),
      0,
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("heading", { name: "Giriş politikası" }).waitFor();
    await emailForm.getByRole("button", { name: "Kaydet" }).click();
    await window
      .getByText("E-posta ayarları kaydedildi.", { exact: true })
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    const localizationNavigation = window.getByRole("button", {
      name: "Localization",
      exact: true,
    });
    await localizationNavigation.click();
    assert.equal(await localizationNavigation.isDisabled(), true);
    assert.equal(await localizationNavigation.locator(".spinner").count(), 1);
    await window
      .getByRole("heading", { name: "Localization settings" })
      .waitFor();
    const localizationSettingsForm = window.locator(
      'form[data-form="admin-localization-settings"]',
    );
    const trLocale = localizationSettingsForm.locator(
      'input[name="supportedLocales"][value="tr"]',
    );
    await trLocale.uncheck();
    await localizationSettingsForm
      .locator('[name="defaultLocale"]')
      .selectOption("tr");
    const localizationSave = localizationSettingsForm.getByRole("button", {
      name: "Save",
    });
    await localizationSave.click();
    assert.equal(await localizationSave.isDisabled(), true);
    assert.equal(await localizationSave.locator(".spinner").count(), 1);
    await window
      .getByText("Default language must be enabled.", { exact: true })
      .waitFor();
    assert.equal(await trLocale.isChecked(), false);
    assert.equal(
      await localizationSettingsForm
        .locator('[name="defaultLocale"]')
        .inputValue(),
      "tr",
    );
    await trLocale.check();
    await localizationSave.click();
    assert.equal(await localizationSave.isDisabled(), true);
    assert.equal(await localizationSave.locator(".spinner").count(), 1);
    await window
      .getByText("Localization settings saved.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() =>
        globalThis.__localizationSettingsUpdates.at(-1),
      ),
      {
        internationalizationEnabled: true,
        defaultLocale: "tr",
        supportedLocales: ["en", "tr"],
      },
    );
    await window
      .getByText("tr · admin · login.title", { exact: true })
      .waitFor();
    await window
      .getByText("<img src=x onerror=alert(1)>", { exact: true })
      .waitFor();
    assert.equal(await window.locator("img[src=x]").count(), 0);
    const overrideForm = window.locator(
      'form[data-form="admin-localization-message"]',
    );
    const overrideLocale = overrideForm.locator('[name="locale"]');
    const overrideValue = overrideForm.locator('[name="messageValue"]');
    await overrideLocale.fill("en_US");
    await overrideValue.fill("<strong>Sign in</strong>");
    const overrideSave = overrideForm.getByRole("button", { name: "Save" });
    await overrideSave.click();
    assert.equal(await overrideSave.isDisabled(), true);
    assert.equal(await overrideSave.locator(".spinner").count(), 1);
    await window
      .getByText("Use a supported locale.", { exact: true })
      .waitFor();
    assert.equal(await overrideLocale.inputValue(), "en_US");
    assert.equal(await overrideValue.inputValue(), "<strong>Sign in</strong>");
    await overrideLocale.fill("tr");
    await overrideSave.click();
    assert.equal(await overrideSave.isDisabled(), true);
    assert.equal(await overrideSave.locator(".spinner").count(), 1);
    await window
      .getByText("Message override saved.", { exact: true })
      .waitFor();
    assert.equal(
      await window.locator("strong").filter({ hasText: "Sign in" }).count(),
      0,
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Yerelleştirme ayarları" })
      .waitFor();
    await localizationSettingsForm
      .locator('[name="defaultLocale"]')
      .selectOption("en");
    await localizationSettingsForm
      .getByRole("button", { name: "Kaydet" })
      .click();
    await window
      .getByText("Yerelleştirme ayarları kaydedildi.", { exact: true })
      .waitFor();
    await overrideValue.fill("Oturum aç");
    await overrideForm.getByRole("button", { name: "Kaydet" }).click();
    await window
      .getByText("İleti geçersiz kılması kaydedildi.", { exact: true })
      .waitFor();
    const localizationRequests = await application.evaluate(
      () => globalThis.__localizationMessageRequests,
    );
    assert.equal(
      new URLSearchParams(localizationRequests[0]).get("size"),
      "20",
    );
    assert.equal(
      new URLSearchParams(localizationRequests[0]).get("sort"),
      "locale,asc",
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    const ldapNavigation = window.getByRole("button", {
      name: "LDAP federation",
      exact: true,
    });
    await ldapNavigation.click();
    assert.equal(await ldapNavigation.isDisabled(), true);
    assert.equal(await ldapNavigation.locator(".spinner").count(), 1);
    await window.getByText("Corporate Directory", { exact: true }).waitFor();
    await window.getByText(/12 imported · 3 updated/).waitFor();
    assert.equal(
      await window.getByText("ldaps://private-directory.internal:636").count(),
      0,
    );
    assert.equal(
      await window.getByText("CN=secret-service-account").count(),
      0,
    );
    assert.equal(
      await window.getByText("PRIVATE_DIRECTORY_ERROR_NEVER_RENDER").count(),
      0,
    );
    assert.equal(
      await window.getByText("SECRET_LDAP_PASSWORD_NEVER_RENDER").count(),
      0,
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "LDAP federasyonu", exact: true })
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    const authenticationNavigation = window.getByRole("button", {
      name: "Authentication flows",
      exact: true,
    });
    await authenticationNavigation.click();
    assert.equal(await authenticationNavigation.isDisabled(), true);
    assert.equal(await authenticationNavigation.locator(".spinner").count(), 1);
    await window.getByText("Primary browser authentication flow").waitFor();
    await window.getByText("BROWSER", { exact: true }).waitFor();
    await window.getByText("password", { exact: true }).waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("heading", { name: "Kimlik doğrulama akışları", exact: true })
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.evaluate(async () => window.desktopApi.theme.set("dark"));
    await window.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await window.evaluate(async () => window.desktopApi.theme.set("light"));
    await window.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await window.evaluate(async () => window.desktopApi.theme.set("system"));
    assert.equal(
      await window.evaluate(() => window.desktopApi.theme.get()),
      "system",
    );
    await window.waitForFunction(() =>
      ["light", "dark"].includes(document.documentElement.dataset.theme),
    );
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
    await mainWindow.evaluate(async () => window.desktopApi.theme.set("light"));
    await mainWindow.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await settingsWindow.getByRole("radio", { name: "Dark" }).click();
    await mainWindow.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("heading", { name: "Appearance" }).waitFor();
    await settingsWindow.getByRole("radio", { name: "System" }).click();
    assert.equal(
      await settingsWindow.evaluate(() => window.desktopApi.theme.get()),
      "system",
    );
    await mainWindow.waitForFunction(() =>
      ["light", "dark"].includes(document.documentElement.dataset.theme),
    );
    await settingsWindow.getByRole("button", { name: "General" }).click();
    await settingsWindow.locator("#desktop-language").selectOption("tr");
    await settingsWindow
      .getByRole("heading", { name: "Ayarlar", exact: true })
      .waitFor();
    await mainWindow
      .getByRole("heading", { name: "Bir konsol seçin", exact: true })
      .waitFor();
    const turkishMenuLabels = await application.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().items[0].submenu.items.map(
        (item) => item.label,
      ),
    );
    assert.equal(turkishMenuLabels.includes("Ayarlar…"), true);
    await settingsWindow.locator("#desktop-language").selectOption("en");
    await settingsWindow
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor();
    await mainWindow
      .getByRole("heading", { name: "Choose a console", exact: true })
      .waitFor();
    const englishMenuLabels = await application.evaluate(({ Menu }) =>
      Menu.getApplicationMenu().items[0].submenu.items.map(
        (item) => item.label,
      ),
    );
    assert.equal(englishMenuLabels.includes("Settings…"), true);
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
    await application.evaluate(() => {
      process.emit(
        "unhandledRejection",
        new Error(
          "person@example.test access_token=ACCESS_E2E refresh_token=REFRESH_E2E code=AUTH_E2E",
        ),
      );
    });
    await settingsWindow.waitForTimeout(200);
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
    const diagnosticText = await settingsWindow
      .locator("#desktop-diagnostics")
      .innerText();
    assert.match(diagnosticText, /unhandled-rejection/);
    for (const sensitiveValue of [
      "person@example.test",
      "ACCESS_E2E",
      "REFRESH_E2E",
      "AUTH_E2E",
    ]) {
      assert.equal(diagnosticText.includes(sensitiveValue), false);
    }

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
    await mainWindow.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    assert.equal(
      await mainWindow.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim(),
      ),
      "#111418",
    );
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
    await mainWindow.evaluate(async () => window.desktopApi.language.set("en"));
    await availableWindow
      .getByRole("heading", { name: "A new version of Kitezh is available!" })
      .waitFor();
    assert.equal(
      await availableWindow
        .getByRole("button", { name: "Skip This Version" })
        .count(),
      1,
    );
    await mainWindow.evaluate(async () => window.desktopApi.language.set("tr"));
    await availableWindow
      .getByRole("heading", { name: "Yeni bir Kitezh sürümü var!" })
      .waitFor();
    assert.equal(
      await availableWindow.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
      "rgb(17, 20, 24)",
    );
    await mainWindow.evaluate(async () => window.desktopApi.theme.set("light"));
    await availableWindow.waitForFunction(
      () =>
        getComputedStyle(document.body).backgroundColor ===
        "rgb(247, 249, 252)",
    );
    await mainWindow.evaluate(async () =>
      window.desktopApi.theme.set("system"),
    );
    const systemTheme = await mainWindow.evaluate(
      () => document.documentElement.dataset.theme,
    );
    const systemDialogBackground =
      systemTheme === "dark" ? "rgb(17, 20, 24)" : "rgb(247, 249, 252)";
    await availableWindow.waitForFunction(
      (background) =>
        getComputedStyle(document.body).backgroundColor === background,
      systemDialogBackground,
    );
  } finally {
    await application.close();
  }
});
