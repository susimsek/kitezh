import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  await readFile(path.join(desktopDirectory, "package.json"), "utf8"),
).version;
const packagedExecutable = path.join(
  desktopDirectory,
  "release",
  "win-unpacked",
  "Kitezh.exe",
);

async function nativeMainWindow(application) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const window = application
      .windows()
      .find((candidate) => candidate.url().startsWith("app://renderer/native"));
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Packaged native main window did not become available");
}

async function externalUrlFromDesktop(application) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await application.evaluate(() => globalThis.__e2eExternalUrl);
    if (typeof value === "string") return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Packaged authorization handoff was not requested");
}

async function callbackUrlFromBrowser(application) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await application.evaluate(() => globalThis.__e2eCallbackUrl);
    if (
      typeof value === "string" &&
      value.startsWith("kitezh://oauth/callback")
    )
      return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Packaged OAuth callback was not received");
}

async function accountProfile(mainWindow) {
  return mainWindow.evaluate(() =>
    window.desktopApi.api.request({
      console: "account",
      path: "/api/account/profile",
    }),
  );
}

test("recovers from canceled PKCE and completes login in the packaged Windows app", async () => {
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-packaged-auth-e2e-"),
  );
  await writeFile(
    path.join(userDataDirectory, "desktop-language-mode.json"),
    "en",
  );
  await writeFile(path.join(userDataDirectory, "desktop-language.json"), "en");

  const launchPackaged = () =>
    electron.launch({
      executablePath: packagedExecutable,
      args: [`--user-data-dir=${userDataDirectory}`],
      env: {
        ...process.env,
        DESKTOP_API_BASE_URL:
          process.env.DESKTOP_API_BASE_URL ?? "http://localhost:9090",
        DESKTOP_AUTO_UPDATE: "false",
      },
    });
  let application = await launchPackaged();

  try {
    await application.evaluate(({ shell }) => {
      globalThis.__socialLinkStartRequests = [];
      globalThis.__socialLinkCompletions = [];
      globalThis.__socialLinkCompleted = false;
      shell.openExternal = async (url) => {
        globalThis.__e2eExternalUrl = url;
      };
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input, init) => {
        const requestUrl = new URL(String(input));
        const method = String(init?.method ?? "GET").toUpperCase();
        if (requestUrl.pathname === "/api/account/social-links") {
          return new Response(
            JSON.stringify([
              {
                provider: "github",
                displayName: "GitHub",
                linked: globalThis.__socialLinkCompleted,
                configured: true,
                enabled: true,
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          requestUrl.pathname ===
            "/api/account/social-links/github/desktop/start" &&
          method === "POST"
        ) {
          const body = JSON.parse(String(init.body));
          globalThis.__socialLinkStartRequests.push({
            path: requestUrl.pathname,
            body,
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          return new Response(
            JSON.stringify({
              state: body.state,
              authorizationUrl:
                "http://localhost:9090/account/social-links/github/desktop/authorize?transaction=packaged-transaction",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          requestUrl.pathname ===
            "/api/account/social-links/desktop/complete" &&
          method === "POST"
        ) {
          globalThis.__socialLinkCompletions.push(
            JSON.parse(String(init.body)),
          );
          globalThis.__socialLinkCompleted = true;
          return new Response(null, { status: 204 });
        }
        return originalFetch(input, init);
      };
    });
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await mainWindow.getByRole("button", { name: "Account Console" }).click();

    const canceledAuthorizationUrl = await externalUrlFromDesktop(application);
    const canceledState = new URL(canceledAuthorizationUrl).searchParams.get(
      "state",
    );
    assert.ok(canceledState);
    const cancelSignIn = mainWindow.getByRole("button", {
      name: "Cancel sign-in",
      exact: true,
    });
    await cancelSignIn.click();
    await cancelSignIn.locator(".spinner").waitFor({ state: "visible" });
    await mainWindow
      .getByText("Sign-in canceled. You can try again.", { exact: true })
      .waitFor();
    await application.evaluate(({ app }, state) => {
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&code=stale-packaged-code`,
      );
      globalThis.__e2eExternalUrl = null;
    }, canceledState);
    assert.equal(
      await mainWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("account"),
      ),
      false,
    );
    await mainWindow
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    const authorizationUrl = await externalUrlFromDesktop(application);
    const retryState = new URL(authorizationUrl).searchParams.get("state");
    assert.ok(retryState);
    assert.notEqual(retryState, canceledState);
    const browserWindowPromise = application.waitForEvent("window");
    await application.evaluate(({ BrowserWindow }, url) => {
      const browserWindow = new BrowserWindow({
        show: true,
        width: 1000,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      browserWindow.loadURL(url);
    }, authorizationUrl);
    const browserWindow = await browserWindowPromise;
    await application.evaluate(({ BrowserWindow }) => {
      const loginWindow = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes("/login"),
      );
      if (!loginWindow) throw new Error("Packaged login window was not found");
      const captureCallback = (event, url) => {
        if (!url.startsWith("kitezh://oauth/callback")) return;
        // This harness injects delivery below; do not also launch a second,
        // default-profile process through the operating-system handler.
        event.preventDefault();
        globalThis.__e2eCallbackUrl = url;
      };
      loginWindow.webContents.on("will-navigate", captureCallback);
      loginWindow.webContents.on("will-redirect", captureCallback);
    });

    await browserWindow.locator('input[name="username"]').fill("admin");
    await browserWindow.locator('input[name="password"]').fill("admin");
    await browserWindow.getByRole("button", { name: /Sign in|Giriş/i }).click();

    const callbackUrl = await callbackUrlFromBrowser(application);
    await application.evaluate(({ app }, url) => {
      app.emit("open-url", { preventDefault() {} }, url);
    }, callbackUrl);

    let profileResponse;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      profileResponse = await accountProfile(mainWindow);
      if (profileResponse.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(profileResponse?.status, 200);
    assert.equal(
      await mainWindow.url(),
      "app://renderer/native?console=account",
    );
    assert.equal(
      await mainWindow
        .getByRole("heading", { name: "Account Console" })
        .count(),
      1,
    );
    await mainWindow
      .getByRole("heading", { name: "First name & Last name" })
      .waitFor();
    assert.equal(
      await mainWindow
        .getByRole("heading", { name: "First name & Last name" })
        .count(),
      1,
    );
    assert.equal(
      await mainWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("account"),
      ),
      true,
    );
    assert.match(packageVersion, /^\d+\.\d+\.\d+$/);

    await mainWindow
      .getByRole("button", { name: "Security", exact: true })
      .click();
    await mainWindow.getByText("GitHub", { exact: true }).waitFor();
    await application.evaluate(() => {
      globalThis.__e2eExternalUrl = null;
    });
    const connectProvider = mainWindow.getByRole("button", {
      name: "Connect in browser",
    });
    await connectProvider.click();
    await connectProvider.locator(".spinner").waitFor();
    assert.equal(await connectProvider.isDisabled(), true);
    assert.equal(await connectProvider.locator(".spinner").count(), 1);
    const socialAuthorizationUrl = await externalUrlFromDesktop(application);
    assert.equal(
      new URL(socialAuthorizationUrl).pathname,
      "/account/social-links/github/desktop/authorize",
    );
    assert.equal(
      new URL(socialAuthorizationUrl).searchParams.get("transaction"),
      "packaged-transaction",
    );
    const socialStartRequests = await application.evaluate(
      () => globalThis.__socialLinkStartRequests,
    );
    assert.equal(socialStartRequests.length, 1);
    assert.deepEqual(Object.keys(socialStartRequests[0].body).sort(), [
      "codeChallenge",
      "state",
    ]);
    assert.match(
      socialStartRequests[0].body.codeChallenge,
      /^[A-Za-z0-9_-]{43}$/,
    );
    await application.evaluate(({ app }, state) => {
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://social-link/callback?state=${state}&code=packaged-social-link-code`,
      );
    }, socialStartRequests[0].body.state);
    await mainWindow.getByText("Connected", { exact: true }).waitFor();
    const socialLinkCompletions = await application.evaluate(
      () => globalThis.__socialLinkCompletions,
    );
    assert.equal(socialLinkCompletions.length, 1);
    assert.equal(socialLinkCompletions[0].code, "packaged-social-link-code");
    assert.match(socialLinkCompletions[0].codeVerifier, /^[A-Za-z0-9_-]{43}$/);

    const sensitiveDiagnostic =
      "Authorization: Bearer PACKAGED_ACCESS email=packaged@example.test refresh_token=PACKAGED_REFRESH";
    await application.evaluate((message) => {
      process.emit("unhandledRejection", new Error(message));
      process.emit("uncaughtExceptionMonitor", new Error(message));
    }, sensitiveDiagnostic);
    const packagedDiagnostics = await mainWindow.evaluate(() =>
      window.desktopApi.diagnostics.get(),
    );
    const packagedDiagnosticText = packagedDiagnostics.events.join("\n");
    assert.equal(packagedDiagnostics.packaged, true);
    assert.match(packagedDiagnosticText, /unhandled-rejection/);
    assert.match(packagedDiagnosticText, /uncaught-exception/);
    assert.doesNotMatch(
      packagedDiagnosticText,
      /PACKAGED_ACCESS|packaged@example\.test|PACKAGED_REFRESH/,
    );
    const settingsWindowPromise = application.waitForEvent("window");
    const settingsMenuItemFound = await application.evaluate(({ Menu }) => {
      const applicationMenu = Menu.getApplicationMenu();
      const settings = applicationMenu?.items[0]?.submenu?.items.find(
        (item) => item.label === "Settings…",
      );
      settings?.click();
      return Boolean(settings);
    });
    assert.equal(settingsMenuItemFound, true);
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();
    await settingsWindow.getByRole("button", { name: "Diagnostics" }).click();
    await settingsWindow.waitForFunction(() => {
      const text = document.querySelector("#desktop-diagnostics")?.textContent;
      return (
        text?.includes("unhandled-rejection") &&
        text?.includes("uncaught-exception")
      );
    });
    const diagnosticsPreview = await settingsWindow
      .locator("#desktop-diagnostics")
      .innerText();
    assert.doesNotMatch(
      diagnosticsPreview,
      /PACKAGED_ACCESS|packaged@example\.test|PACKAGED_REFRESH/,
    );
    await settingsWindow.evaluate(() => {
      globalThis.__diagnosticsCopyCount = 0;
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async () => {
          globalThis.__diagnosticsCopyCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 350));
        },
      });
    });
    const copyDiagnostics = settingsWindow.locator("#desktop-copy-diagnostics");
    await copyDiagnostics.click();
    assert.equal(await copyDiagnostics.isDisabled(), true);
    assert.equal(await copyDiagnostics.getAttribute("aria-busy"), "true");
    assert.equal(await copyDiagnostics.locator(".inline-spinner").count(), 1);
    await copyDiagnostics.dispatchEvent("click");
    assert.equal(
      await settingsWindow.evaluate(() => globalThis.__diagnosticsCopyCount),
      1,
    );
    await settingsWindow.getByText("Copied", { exact: true }).waitFor();

    await application.close();
    application = await launchPackaged();
    const restartedWindow = await nativeMainWindow(application);
    await restartedWindow
      .getByRole("heading", { name: "Account Console" })
      .waitFor();
    assert.equal(
      await restartedWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("account"),
      ),
      true,
    );
    assert.equal((await accountProfile(restartedWindow)).status, 200);
    await application.evaluate(({ shell }) => {
      shell.openExternal = async (url) => {
        globalThis.__e2eLogoutPath = new URL(url).pathname;
      };
    });
    await restartedWindow
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await restartedWindow.locator(".login-card").waitFor();
    assert.equal(
      await application.evaluate(() => globalThis.__e2eLogoutPath),
      "/connect/logout",
    );
    assert.equal(
      await restartedWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("account"),
      ),
      false,
    );
  } finally {
    await application.close();
  }
});

test("keeps packaged Admin authentication in its isolated session namespace", async () => {
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-packaged-admin-e2e-"),
  );
  await writeFile(
    path.join(userDataDirectory, "desktop-language-mode.json"),
    "en",
  );
  await writeFile(path.join(userDataDirectory, "desktop-language.json"), "en");

  let application;
  let mainWindow;
  let packagedRoleName;
  let packagedScopeId;
  let packagedLocalizationMessageId;

  application = await electron.launch({
    executablePath: packagedExecutable,
    args: [`--user-data-dir=${userDataDirectory}`],
    env: {
      ...process.env,
      DESKTOP_API_BASE_URL:
        process.env.DESKTOP_API_BASE_URL ?? "http://localhost:9090",
      DESKTOP_AUTO_UPDATE: "false",
    },
  });

  try {
    await application.evaluate(({ shell }) => {
      shell.openExternal = async (url) => {
        globalThis.__e2eExternalUrl = url;
      };
    });
    mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await mainWindow
      .getByRole("button", { name: "Administration Console" })
      .click();

    const authorizationUrl = await externalUrlFromDesktop(application);
    const browserWindowPromise = application.waitForEvent("window");
    await application.evaluate(({ BrowserWindow }, url) => {
      const browserWindow = new BrowserWindow({
        show: true,
        width: 1000,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      browserWindow.loadURL(url);
    }, authorizationUrl);
    const browserWindow = await browserWindowPromise;
    await application.evaluate(({ BrowserWindow }) => {
      const loginWindow = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes("/login"),
      );
      if (!loginWindow) throw new Error("Packaged login window was not found");
      const captureCallback = (event, url) => {
        if (!url.startsWith("kitezh://oauth/callback")) return;
        event.preventDefault();
        globalThis.__e2eCallbackUrl = url;
      };
      loginWindow.webContents.on("will-navigate", captureCallback);
      loginWindow.webContents.on("will-redirect", captureCallback);
    });

    await browserWindow.locator('input[name="username"]').fill("admin");
    await browserWindow.locator('input[name="password"]').fill("admin");
    await browserWindow.getByRole("button", { name: /Sign in|Giriş/i }).click();
    const callbackUrl = await callbackUrlFromBrowser(application);
    await application.evaluate(({ app }, url) => {
      app.emit("open-url", { preventDefault() {} }, url);
    }, callbackUrl);

    let dashboardResponse;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      dashboardResponse = await mainWindow.evaluate(() =>
        window.desktopApi.api.request({
          console: "admin",
          path: "/api/admin/dashboard",
        }),
      );
      if (dashboardResponse.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(dashboardResponse?.status, 200);
    assert.equal(await mainWindow.url(), "app://renderer/native?console=admin");
    assert.equal(
      await mainWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("admin"),
      ),
      true,
    );
    assert.equal(
      await mainWindow.evaluate(() =>
        window.desktopApi.auth.hasSession("account"),
      ),
      false,
    );
    const accountResponse = await mainWindow.evaluate(() =>
      window.desktopApi.api.request({
        console: "account",
        path: "/api/account/profile",
      }),
    );
    assert.equal(accountResponse.status, 401);
    assert.equal(accountResponse.kind, "unauthorized");

    const staleScopeCleanup = await mainWindow.evaluate(async () => {
      const listed = await window.desktopApi.api.request({
        console: "admin",
        path: "/api/admin/client-scopes?q=packaged-scope-&page=0&size=100&sort=name,asc",
      });
      if (listed.status !== 200) return listed.status;
      for (const scope of listed.body.content ?? []) {
        if (!scope.name.startsWith("packaged-scope-")) continue;
        const deleted = await window.desktopApi.api.request({
          console: "admin",
          method: "DELETE",
          path: `/api/admin/client-scopes/${encodeURIComponent(scope.id)}`,
        });
        if (deleted.status !== 204 && deleted.status !== 404)
          return deleted.status;
      }
      return 200;
    });
    assert.equal(staleScopeCleanup, 200);

    await mainWindow
      .getByRole("button", { name: "Client scopes", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Client scopes", exact: true })
      .waitFor();
    await mainWindow.getByText("OpenID", { exact: true }).waitFor();
    const packagedScopes = mainWindow.locator("[data-client-scope-id]");
    assert.ok((await packagedScopes.count()) > 0);
    assert.equal(
      await mainWindow
        .getByRole("button", { name: "Manage role mappings" })
        .count(),
      0,
    );

    packagedRoleName = `ROLE_PACKAGED_E2E_${Date.now()}`;
    await mainWindow
      .getByRole("button", { name: "Roles", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Roles", exact: true })
      .waitFor();
    await mainWindow
      .locator(".topbar")
      .getByRole("button", { name: "Create role", exact: true })
      .click();
    const roleCreateForm = mainWindow.locator(
      'form[data-form="admin-role-create"]',
    );
    await roleCreateForm.locator('[name="name"]').fill(packagedRoleName);
    await roleCreateForm
      .locator('[name="description"]')
      .fill("Packaged Windows role");
    await roleCreateForm
      .getByRole("button", { name: "Create role", exact: true })
      .click();
    await mainWindow.getByText("Role created.", { exact: true }).waitFor();

    const roleRow = mainWindow.locator(
      `article[data-role-name="${packagedRoleName}"]`,
    );
    await roleRow.waitFor();
    const roleDescription = roleRow.locator('[name="description"]');
    await roleDescription.fill("Packaged Windows role updated");
    await roleRow.getByRole("button", { name: "Save", exact: true }).click();
    await mainWindow
      .getByText("Role description updated.", { exact: true })
      .waitFor();
    assert.equal(
      await roleRow.locator('[name="description"]').inputValue(),
      "Packaged Windows role updated",
    );

    await mainWindow
      .getByRole("button", { name: "Client scopes", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Client scopes", exact: true })
      .waitFor();
    await mainWindow
      .locator(".topbar")
      .getByRole("button", { name: "Create client scope", exact: true })
      .click();
    const scopeName = `packaged-scope-${Date.now()}`;
    const scopeCreateForm = mainWindow.locator(
      'form[data-form="admin-client-scope-create"]',
    );
    await scopeCreateForm.locator('[name="name"]').fill(scopeName);
    await scopeCreateForm
      .locator('[name="displayName"]')
      .fill("Packaged role mapping scope");
    await scopeCreateForm
      .getByRole("button", { name: "Create client scope", exact: true })
      .click();
    await mainWindow
      .getByText("Client scope created.", { exact: true })
      .waitFor();
    const scopeLookup = await mainWindow.evaluate(async (name) => {
      const response = await window.desktopApi.api.request({
        console: "admin",
        path: `/api/admin/client-scopes?q=${encodeURIComponent(name)}&page=0&size=20&sort=name,asc`,
      });
      return response;
    }, scopeName);
    assert.equal(scopeLookup.status, 200);
    const createdScope = scopeLookup.body.content.find(
      (scope) => scope.name === scopeName,
    );
    assert.ok(createdScope);
    packagedScopeId = createdScope.id;

    await mainWindow
      .getByRole("button", { name: "Roles", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Roles", exact: true })
      .waitFor();
    await mainWindow
      .getByRole("button", { name: "Client scopes", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Client scopes", exact: true })
      .waitFor();
    const scopeSearch = mainWindow.locator("#admin-client-scope-search");
    await scopeSearch.locator('[name="q"]').fill(scopeName);
    await scopeSearch.locator('button[type="submit"]').click();
    const scopeRow = mainWindow.locator(
      `[data-client-scope-id="${packagedScopeId}"]`,
    );
    await scopeRow.waitFor();
    assert.equal(
      await scopeRow
        .locator('[data-form="admin-client-scope-edit"]')
        .getAttribute("data-scope-name"),
      scopeName,
    );
    await scopeRow
      .getByRole("button", { name: "Manage role mappings", exact: true })
      .click();
    const roleMappings = scopeRow.locator(
      "[data-client-scope-role-mappings-panel]",
    );
    await roleMappings.waitFor();
    const roleCandidateSearch = roleMappings.locator(
      'form[data-form="admin-client-scope-role-candidate-search"][data-role-kind="applicationRoles"]',
    );
    await roleCandidateSearch.locator('[name="q"]').fill(packagedRoleName);
    await roleCandidateSearch.locator('button[type="submit"]').click();
    const packagedRoleCandidate = roleMappings.getByRole("checkbox", {
      name: new RegExp(packagedRoleName),
    });
    await packagedRoleCandidate.waitFor();
    await packagedRoleCandidate.check();
    await application.evaluate(() => {
      globalThis.__packagedRoleMappingStatuses = [];
      globalThis.__packagedPolicyStatuses = [];
      globalThis.__packagedBrandingStatuses = [];
      globalThis.__packagedLocalizationStatuses = [];
      globalThis.__packagedLocalizationPolicyStatuses = [];
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        const requestUrl = new URL(String(input));
        const method = String(init?.method ?? "GET").toUpperCase();
        if (
          /\/api\/admin\/client-scopes\/[^/]+\/role-mappings$/.test(
            requestUrl.pathname,
          )
        ) {
          globalThis.__packagedRoleMappingStatuses.push({
            method,
            status: response.status,
          });
        }
        if (
          method === "PUT" &&
          [
            "/api/admin/settings/ciba-policy",
            "/api/admin/settings/offline-access",
          ].includes(requestUrl.pathname)
        ) {
          globalThis.__packagedPolicyStatuses.push({
            path: requestUrl.pathname,
            status: response.status,
          });
        }
        if (
          method === "PUT" &&
          requestUrl.pathname === "/api/admin/settings/branding"
        ) {
          globalThis.__packagedBrandingStatuses.push(response.status);
        }
        if (
          ["POST", "PUT", "DELETE"].includes(method) &&
          /^\/api\/admin\/settings\/localization\/messages(?:\/[1-9]\d*)?$/.test(
            requestUrl.pathname,
          )
        ) {
          globalThis.__packagedLocalizationStatuses.push({
            method,
            status: response.status,
          });
        }
        if (
          method === "PUT" &&
          requestUrl.pathname === "/api/admin/settings/localization"
        ) {
          globalThis.__packagedLocalizationPolicyStatuses.push(response.status);
        }
        return response;
      };
    });
    await roleMappings
      .getByRole("button", { name: "Save", exact: true })
      .click();
    let mappingStatuses = [];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      mappingStatuses = await application.evaluate(
        () => globalThis.__packagedRoleMappingStatuses,
      );
      if (mappingStatuses.some(({ method }) => method === "PUT")) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.deepEqual(mappingStatuses, [{ method: "PUT", status: 200 }]);
    await mainWindow
      .getByText("Client scope role mappings updated.", { exact: true })
      .waitFor();
    const savedMappings = await mainWindow.evaluate(async (scopeId) => {
      const response = await window.desktopApi.api.request({
        console: "admin",
        path: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
      });
      return response;
    }, packagedScopeId);
    assert.equal(savedMappings.status, 200);
    assert.ok(savedMappings.body.applicationRoles.includes(packagedRoleName));

    await mainWindow
      .getByRole("button", { name: "Policies", exact: true })
      .click();
    await mainWindow.getByRole("heading", { name: "CIBA policy" }).waitFor();
    const cibaForm = mainWindow.locator('form[data-form="admin-ciba-policy"]');
    const cibaLifespan = await cibaForm
      .locator('[name="requestLifespanSeconds"]')
      .inputValue();
    const cibaSave = cibaForm.getByRole("button", { name: "Save", exact: true });
    await cibaSave.click();
    await mainWindow
      .getByText("Policy settings saved.", { exact: true })
      .waitFor();

    const offlineForm = mainWindow.locator(
      'form[data-form="admin-offline-access-policy"]',
    );
    const offlineIdleTimeout = await offlineForm
      .locator('[name="idleTimeout"]')
      .inputValue();
    const offlineSave = offlineForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await offlineSave.click();
    await mainWindow
      .getByText("Policy settings saved.", { exact: true })
      .waitFor();
    const policyStatuses = await application.evaluate(
      () => globalThis.__packagedPolicyStatuses,
    );
    assert.deepEqual(policyStatuses, [
      { path: "/api/admin/settings/ciba-policy", status: 200 },
      { path: "/api/admin/settings/offline-access", status: 200 },
    ]);
    const persistedPolicies = await mainWindow.evaluate(async () =>
      Promise.all([
        window.desktopApi.api.request({
          console: "admin",
          path: "/api/admin/settings/ciba-policy",
        }),
        window.desktopApi.api.request({
          console: "admin",
          path: "/api/admin/settings/offline-access",
        }),
      ]),
    );
    assert.equal(persistedPolicies[0].status, 200);
    assert.equal(persistedPolicies[0].body.requestLifespanSeconds, Number(cibaLifespan));
    assert.equal(persistedPolicies[1].status, 200);
    assert.equal(persistedPolicies[1].body.idleTimeout, offlineIdleTimeout);

    await mainWindow
      .getByRole("button", { name: "Server & branding", exact: true })
      .click();
    await mainWindow.getByRole("heading", { name: "Branding", exact: true }).waitFor();
    const brandingForm = mainWindow.locator('form[data-form="admin-branding"]');
    const brandingValues = {};
    for (const name of [
      "applicationName",
      "primaryColor",
      "accentColor",
      "backgroundColor",
    ]) {
      brandingValues[name] = await brandingForm.locator(`[name="${name}"]`).inputValue();
    }
    await brandingForm
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await mainWindow
      .getByText("Branding settings saved.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__packagedBrandingStatuses),
      [200],
    );
    const persistedBranding = await mainWindow.evaluate(() =>
      window.desktopApi.api.request({
        console: "admin",
        path: "/api/admin/settings/branding",
      }),
    );
    assert.equal(persistedBranding.status, 200);
    for (const [name, value] of Object.entries(brandingValues)) {
      assert.equal(persistedBranding.body[name], value);
    }

    await mainWindow
      .getByRole("button", { name: "Localization", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Localization settings", exact: true })
      .waitFor();
    const localizationPolicyForm = mainWindow.locator(
      'form[data-form="admin-localization-settings"]',
    );
    const localizationEnabled = await localizationPolicyForm
      .locator('[name="internationalizationEnabled"]')
      .isChecked();
    const defaultLocale = await localizationPolicyForm
      .locator('[name="defaultLocale"]')
      .inputValue();
    const supportedLocales = await localizationPolicyForm
      .locator('[name="supportedLocales"]:checked')
      .evaluateAll((inputs) => inputs.map((input) => input.value).sort());
    await localizationPolicyForm
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await mainWindow
      .getByText("Localization settings saved.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__packagedLocalizationPolicyStatuses,
      ),
      [200],
    );
    const persistedLocalizationPolicy = await mainWindow.evaluate(() =>
      window.desktopApi.api.request({
        console: "admin",
        path: "/api/admin/settings/localization",
      }),
    );
    assert.equal(persistedLocalizationPolicy.status, 200);
    assert.equal(
      persistedLocalizationPolicy.body.internationalizationEnabled,
      localizationEnabled,
    );
    assert.equal(persistedLocalizationPolicy.body.defaultLocale, defaultLocale);
    assert.deepEqual(
      [...persistedLocalizationPolicy.body.supportedLocales].sort(),
      supportedLocales,
    );

    const messageKey = `native.packaged.e2e.${Date.now()}`;
    const createMessageForm = mainWindow.locator(
      'form[data-form="admin-localization-message-create"]',
    );
    await createMessageForm.locator('[name="locale"]').selectOption("en");
    await createMessageForm.locator('[name="bundle"]').selectOption("admin");
    await createMessageForm.locator('[name="messageKey"]').fill(messageKey);
    await createMessageForm
      .locator('[name="messageValue"]')
      .fill("Packaged message before edit");
    await createMessageForm
      .getByRole("button", { name: "Create message override", exact: true })
      .click();
    await mainWindow
      .getByText("Message override created.", { exact: true })
      .waitFor();
    const messageLookup = await mainWindow.evaluate(async (key) =>
      window.desktopApi.api.request({
        console: "admin",
        path: `/api/admin/settings/localization/messages?q=${encodeURIComponent(key)}&page=0&size=20&sort=locale,asc`,
      }),
    messageKey);
    assert.equal(messageLookup.status, 200);
    const createdMessage = messageLookup.body.content.find(
      (message) => message.messageKey === messageKey,
    );
    assert.ok(createdMessage);
    packagedLocalizationMessageId = createdMessage.id;
    const messageForm = mainWindow.locator(
      `form[data-form="admin-localization-message"][data-id="${packagedLocalizationMessageId}"]`,
    );
    await messageForm
      .locator('[name="messageValue"]')
      .fill("Packaged message after edit");
    await messageForm
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await mainWindow
      .getByText("Message override saved.", { exact: true })
      .waitFor();
    const updatedMessage = await mainWindow.evaluate(async (key) =>
      window.desktopApi.api.request({
        console: "admin",
        path: `/api/admin/settings/localization/messages?q=${encodeURIComponent(key)}&page=0&size=20&sort=locale,asc`,
      }),
    messageKey);
    assert.equal(updatedMessage.status, 200);
    assert.equal(
      updatedMessage.body.content[0].messageValue,
      "Packaged message after edit",
    );
    const messageRow = messageForm.locator("..");
    await messageRow.getByRole("button", { name: "Delete", exact: true }).click();
    await messageRow
      .getByText("Delete this message override?", { exact: true })
      .waitFor();
    await messageRow
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await mainWindow
      .getByText("Message override deleted.", { exact: true })
      .waitFor();
    packagedLocalizationMessageId = null;
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__packagedLocalizationStatuses,
      ),
      [
        { method: "POST", status: 201 },
        { method: "PUT", status: 200 },
        { method: "DELETE", status: 204 },
      ],
    );

    await mainWindow
      .getByRole("button", { name: "Roles", exact: true })
      .click();
    await mainWindow
      .getByRole("heading", { name: "Roles", exact: true })
      .waitFor();
    const updatedRoleRow = mainWindow.locator(
      `article[data-role-name="${packagedRoleName}"]`,
    );
    await updatedRoleRow.waitFor();
    const roleDelete = updatedRoleRow.getByRole("button", {
      name: "Delete role",
      exact: true,
    });
    await roleDelete.click();
    await updatedRoleRow.getByText(/Delete this role\?/).waitFor();
    await updatedRoleRow
      .getByRole("button", { name: "Delete role", exact: true })
      .click();
    await mainWindow.getByText("Role deleted.", { exact: true }).waitFor();
    await updatedRoleRow.waitFor({ state: "detached" });
    packagedRoleName = null;
  } finally {
    if (application) {
      try {
        if (packagedLocalizationMessageId && mainWindow) {
          const cleanup = await mainWindow.evaluate(
            async (messageId) =>
              window.desktopApi.api.request({
                console: "admin",
                method: "DELETE",
                path: `/api/admin/settings/localization/messages/${messageId}`,
              }),
            packagedLocalizationMessageId,
          );
          if (cleanup.status !== 204 && cleanup.status !== 404)
            throw new Error(
              `Packaged message cleanup failed with status ${cleanup.status}`,
            );
        }
        if (packagedScopeId && mainWindow) {
          const cleanup = await mainWindow.evaluate(
            async (scopeId) =>
              window.desktopApi.api.request({
                console: "admin",
                method: "DELETE",
                path: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}`,
              }),
            packagedScopeId,
          );
          if (cleanup.status !== 204 && cleanup.status !== 404)
            throw new Error(
              `Packaged client scope cleanup failed with status ${cleanup.status}`,
            );
        }
        if (packagedRoleName && mainWindow) {
          const cleanup = await mainWindow.evaluate(
            async (name) =>
              window.desktopApi.api.request({
                console: "admin",
                method: "DELETE",
                path: `/api/admin/roles/${encodeURIComponent(name)}`,
              }),
            packagedRoleName,
          );
          if (cleanup.status !== 204 && cleanup.status !== 404)
            throw new Error(
              `Packaged role cleanup failed with status ${cleanup.status}`,
            );
        }
      } finally {
        await application.close();
      }
    }
  }
});
