import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

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

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const checksumInput = Buffer.concat([name, data]);
  let checksum = 0xffffffff;
  for (const byte of checksumInput) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, checksumInput, crc]);
}

function onePixelPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function launchDesktop({
  devTools = false,
  autoUpdate = "false",
  updatePreviewState,
  updatePreviewVersion = "0.1.1",
  updatePreviewAutomatic = false,
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
      DESKTOP_AUTO_UPDATE: autoUpdate,
      DESKTOP_DEVTOOLS: devTools ? "true" : "false",
      ...(updatePreviewState
        ? {
            DESKTOP_UPDATE_PREVIEW: "true",
            DESKTOP_UPDATE_PREVIEW_STATE: updatePreviewState,
            DESKTOP_UPDATE_PREVIEW_VERSION: updatePreviewVersion,
            ...(updatePreviewAutomatic
              ? { DESKTOP_UPDATE_PREVIEW_AUTOMATIC: "true" }
              : {}),
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

test("opens only exact approved external paths and rejects unsafe redirects", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__openedExternalUrls = [];
      shell.openExternal = async (url) => {
        globalThis.__openedExternalUrls.push(url);
      };
    });
    const window = await nativeMainWindow(application);
    const outcomes = await window.evaluate(async () => {
      const urls = [
        "https://github.com/login/oauth/authorize?client_id=demo",
        "https://github.com/arbitrary/path",
        "https://github.com/login/oauth/authorize?redirect_uri=https%3A%2F%2Fevil.example%2Fcallback",
      ];
      return Promise.all(
        urls.map(async (url) => {
          try {
            await window.desktopApi.openExternal(url);
            return true;
          } catch {
            return false;
          }
        }),
      );
    });
    assert.deepEqual(outcomes, [true, false, false]);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__openedExternalUrls),
      ["https://github.com/login/oauth/authorize?client_id=demo"],
    );
  } finally {
    await application.close();
  }
});

test("native popup and navigation handlers deny untrusted destinations", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__popupExternalUrls = [];
      shell.openExternal = async (url) => {
        globalThis.__popupExternalUrls.push(url);
      };
    });
    const window = await nativeMainWindow(application);
    const initialWindowUrl = await window.url();
    const popupsDenied = await window.evaluate(() => {
      const approved = window.open(
        "https://github.com/login/oauth/authorize?client_id=desktop-e2e",
        "_blank",
      );
      const unapproved = window.open(
        "https://github.com/arbitrary/path",
        "_blank",
      );
      return approved === null && unapproved === null;
    });
    assert.equal(popupsDenied, true);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const opened = await application.evaluate(
        () => globalThis.__popupExternalUrls.length,
      );
      if (opened > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.deepEqual(
      await application.evaluate(() => globalThis.__popupExternalUrls),
      ["https://github.com/login/oauth/authorize?client_id=desktop-e2e"],
    );
    const windowUrls = await Promise.all(
      application.windows().map((candidate) => candidate.url()),
    );
    assert.equal(
      windowUrls.some((url) => url.startsWith("https://github.com/")),
      false,
      `An external URL loaded in an app window: ${windowUrls.join(", ")}`,
    );

    await window.evaluate(() => {
      window.location.assign("https://github.com/arbitrary/path");
    });
    await window.waitForTimeout(100);
    assert.equal(await window.url(), initialWindowUrl);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__popupExternalUrls),
      ["https://github.com/login/oauth/authorize?client_id=desktop-e2e"],
    );
  } finally {
    await application.close();
  }
});

test("keeps native sign-in busy until callback and rejects duplicate authorization", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__authorizationUrls = [];
      shell.openExternal = async (url) => {
        globalThis.__authorizationUrls.push(url);
        globalThis.__pendingAuthorizationUrl = url;
      };
    });
    const window = await nativeMainWindow(application);
    await window.evaluate(() => {
      const originalSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) =>
        originalSetTimeout(
          callback,
          delay === 300_000 ? 1_000 : delay,
          ...args,
        );
    });
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
    const originalAuthorizationUrl = await application.evaluate(
      () => globalThis.__pendingAuthorizationUrl,
    );
    const rendererTransactionRejected = await window.evaluate(async () => {
      try {
        await window.desktopApi.auth.startLogin({
          console: "admin",
          authorizationUrl:
            "http://127.0.0.1:9090/oauth2/authorize?client_id=desktop-admin-console",
          state: "renderer-controlled-state-1234567890",
          codeVerifier:
            "renderer-controlled-verifier-1234567890123456789012345678901234567890",
          clientId: "desktop-admin-console",
          redirectUri: "kitezh://oauth/callback",
        });
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(rendererTransactionRejected, true);
    assert.equal(
      await application.evaluate(() => globalThis.__pendingAuthorizationUrl),
      originalAuthorizationUrl,
    );
    await window.getByText("Sign-in timed out. Try again.").waitFor();
    assert.equal(await signIn.isEnabled(), true);
    await signIn.click();
    await window.waitForTimeout(100);
    const authorizationUrls = await application.evaluate(
      () => globalThis.__authorizationUrls,
    );
    assert.equal(authorizationUrls.length, 2);
    assert.notEqual(
      new URL(authorizationUrls[0]).searchParams.get("state"),
      new URL(authorizationUrls[1]).searchParams.get("state"),
    );
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

test("cancels a pending system-browser sign-in and rejects its stale callback", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__cancelAuthorizationUrls = [];
      shell.openExternal = async (url) => {
        globalThis.__cancelAuthorizationUrls.push(url);
        globalThis.__pendingAuthorizationUrl = url;
      };
    });
    const window = await nativeMainWindow(application);
    await window
      .getByRole("button", { name: "Account Console", exact: true })
      .click();
    const signIn = window.getByRole("button", { name: "Sign in", exact: true });
    await signIn.waitFor();
    const firstAuthorizationUrl = await application.evaluate(
      () => globalThis.__pendingAuthorizationUrl,
    );
    const firstState = new URL(firstAuthorizationUrl).searchParams.get("state");
    assert.ok(firstState);

    const cancelSignIn = window.getByRole("button", {
      name: "Cancel sign-in",
      exact: true,
    });
    await cancelSignIn.click();
    await cancelSignIn.locator(".spinner").waitFor({ state: "visible" });
    assert.equal(await cancelSignIn.isDisabled(), true);
    assert.equal(await cancelSignIn.getAttribute("aria-busy"), "true");
    await cancelSignIn.evaluate((button) => button.click());
    await window
      .getByText("Sign-in canceled. You can try again.", { exact: true })
      .waitFor();
    assert.equal(await signIn.isEnabled(), true);
    assert.equal(
      await window.getByRole("button", { name: "Cancel sign-in" }).count(),
      0,
    );

    await application.evaluate(({ app }, state) => {
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&code=stale-canceled-code`,
      );
    }, firstState);
    assert.equal(
      await window.evaluate(() => window.desktopApi.auth.hasSession("account")),
      false,
    );

    await signIn.click();
    await signIn.locator(".spinner").waitFor({ state: "visible" });
    const authorizationUrls = await application.evaluate(
      () => globalThis.__cancelAuthorizationUrls,
    );
    assert.equal(authorizationUrls.length, 2);
    const retryState = new URL(authorizationUrls[1]).searchParams.get("state");
    assert.ok(retryState);
    assert.notEqual(retryState, firstState);
    await application.evaluate(({ app }, state) => {
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&error=access_denied`,
      );
    }, retryState);
    await window.getByRole("alert").waitFor();
    assert.equal(await signIn.isEnabled(), true);
  } finally {
    await application.close();
  }
});

test("preserves Account profile drafts offline and completes native social linking", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__accountWrites = [];
      globalThis.__socialLinkRequests = [];
      globalThis.__socialLinkCompletions = [];
      globalThis.__socialLinkCompleted = false;
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
        if (
          requestUrl.pathname === "/api/account/mfa/setup" &&
          method === "POST"
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return new Response(
            JSON.stringify({ secret: "test-totp-secret", digits: 6 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (requestUrl.pathname === "/api/account/mfa/recovery-codes")
          return new Response(
            JSON.stringify({ available: true, remaining: 0 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        if (requestUrl.pathname === "/api/account/social-links")
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
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        if (
          requestUrl.pathname ===
            "/api/account/social-links/github/desktop/start" &&
          method === "POST"
        ) {
          const body = JSON.parse(String(init.body));
          globalThis.__socialLinkRequests.push({
            path: requestUrl.pathname,
            body,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return new Response(
            JSON.stringify({
              state: body.state,
              authorizationUrl:
                "http://127.0.0.1:9090/account/social-links/github/desktop/authorize?transaction=server-transaction",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            },
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
    await window
      .getByRole("status")
      .getByText(
        "Offline mode: safe mutations are disabled until connectivity returns.",
        { exact: true },
      )
      .waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("status")
      .getByText(
        "Çevrimdışı mod: güvenli değişiklikler bağlantı gelene kadar devre dışı.",
        { exact: true },
      )
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window
      .getByRole("status")
      .getByText(
        "Offline mode: safe mutations are disabled until connectivity returns.",
        { exact: true },
      )
      .waitFor();
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
    const setupAuthenticator = window.getByRole("button", {
      name: "Set up authenticator",
    });
    await setupAuthenticator.click();
    assert.equal(await setupAuthenticator.isDisabled(), true);
    assert.equal(await setupAuthenticator.locator(".spinner").count(), 1);
    const securityPasswordForm = window.locator('form[data-form="password"]');
    const deleteAccountForm = window.locator('form[data-form="delete"]');
    await securityPasswordForm
      .locator('[name="currentPassword"]')
      .fill("TEMPORARY_CURRENT_PASSWORD");
    await securityPasswordForm
      .locator('[name="newPassword"]')
      .fill("TEMPORARY_NEW_PASSWORD");
    await securityPasswordForm
      .locator('[name="confirmPassword"]')
      .fill("TEMPORARY_NEW_PASSWORD");
    await deleteAccountForm
      .locator('[name="deletePassword"]')
      .fill("TEMPORARY_DELETE_PASSWORD");
    await window.locator('[name="mfaCode"]').fill("123456");
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
        .getByRole("button", { name: "Enable two-factor authentication" })
        .isDisabled(),
      true,
    );
    assert.equal(
      await window
        .getByRole("button", { name: "Delete account", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await securityPasswordForm
        .locator('[name="currentPassword"]')
        .inputValue(),
      "",
    );
    assert.equal(
      await securityPasswordForm.locator('[name="newPassword"]').inputValue(),
      "",
    );
    assert.equal(
      await securityPasswordForm
        .locator('[name="confirmPassword"]')
        .inputValue(),
      "",
    );
    assert.equal(
      await deleteAccountForm.locator('[name="deletePassword"]').inputValue(),
      "",
    );
    assert.equal(await window.locator('[name="mfaCode"]').inputValue(), "");
    assert.deepEqual(
      await application.evaluate(() => globalThis.__accountWrites),
      accountWrites,
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    const connectProvider = window.getByRole("button", {
      name: "Connect in browser",
    });
    await connectProvider.click();
    assert.equal(await connectProvider.isDisabled(), true);
    assert.equal(await connectProvider.locator(".spinner").count(), 1);
    await connectProvider.dispatchEvent("click");
    await window
      .getByRole("status")
      .getByText("Complete the provider sign-in in your browser.")
      .waitFor();
    const socialStartRequests = await application.evaluate(
      () => globalThis.__socialLinkRequests,
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
    const authorizeUrl = await application.evaluate(
      () => globalThis.__pendingAuthorizationUrl,
    );
    assert.equal(
      new URL(authorizeUrl).pathname,
      "/account/social-links/github/desktop/authorize",
    );
    assert.equal(
      new URL(authorizeUrl).searchParams.get("transaction"),
      "server-transaction",
    );
    await application.evaluate(({ app }) => {
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://social-link/callback?state=${globalThis.__socialLinkRequests[0].body.state}&code=test-social-link-code`,
      );
    });
    await window
      .getByRole("status")
      .getByText("Social account link was added.")
      .waitFor();
    await window.getByText("Connected", { exact: true }).waitFor();
    const socialLinkCompletions = await application.evaluate(
      () => globalThis.__socialLinkCompletions,
    );
    assert.equal(socialLinkCompletions.length, 1);
    assert.equal(socialLinkCompletions[0].code, "test-social-link-code");
    assert.match(socialLinkCompletions[0].codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  } finally {
    await application.close();
  }
});

test("creates and updates native OIDC and SAML providers without retaining credentials", async () => {
  const application = await launchDesktop();
  try {
    await application.evaluate(({ shell }) => {
      globalThis.__adminAccessFlags = {
        isAdmin: true,
        queryUsers: true,
        viewUsers: true,
        manageUsers: true,
        viewRoles: true,
        manageRoles: true,
        queryGroups: true,
        viewGroups: true,
        manageGroups: true,
        queryClients: true,
        viewClients: true,
        manageClients: true,
        viewSessions: true,
        manageSessions: true,
        viewConsents: true,
        manageConsents: true,
        viewEvents: true,
        manageEvents: true,
        viewKeys: true,
        manageKeys: true,
      };
      globalThis.__authorizationOpens = 0;
      shell.openExternal = async (url) => {
        globalThis.__authorizationOpens += 1;
        globalThis.__pendingAuthorizationUrl = url;
      };
      globalThis.__oidcProvider = {
        id: "provider-1",
        providerType: "oidc",
        registrationId: "google",
        displayName: "Google",
        alias: "google",
        iconKey: "generic",
        shortStateParameter: false,
        caseSensitiveUsername: false,
        enabled: true,
        configured: true,
        clientId: "google-client",
        clientSecretConfigured: true,
        hideOnLogin: false,
        accountLinkingOnly: false,
        trustEmail: true,
        mfaRequired: false,
        requiredClaims: "sub",
        storeTokens: false,
        storedTokensReadable: false,
        guiOrder: 1,
        showInAccountConsole: "always",
        syncMode: "import",
        authorizationUri: "https://accounts.example/authorize",
        tokenUri: "https://accounts.example/token",
        userInfoUri: "https://accounts.example/userinfo",
        jwkSetUri: "https://accounts.example/jwks",
        issuerUri: "https://accounts.example",
        clientAuthenticationMethod: "client_secret_basic",
        scopes: "openid profile email",
        userNameAttribute: "sub",
        mapperCount: 0,
      };
      globalThis.__samlProvider = {
        id: "provider-saml",
        providerType: "saml",
        registrationId: "saml-existing",
        displayName: "Existing SAML",
        alias: "saml-existing",
        iconKey: "generic",
        enabled: true,
        configured: true,
        clientSecretConfigured: false,
        samlMetadataUri: "https://idp.example/metadata",
        samlAssertingPartyEntityId: "https://idp.example/entity",
        samlSingleSignOnServiceUrl: "https://idp.example/sso",
        samlSingleLogoutServiceUrl: "https://idp.example/slo",
        samlIdpCertificate:
          "-----BEGIN CERTIFICATE-----\nIDP_CERT\n-----END CERTIFICATE-----",
        samlSigningPrivateKeyConfigured: true,
        samlSigningCertificate:
          "-----BEGIN CERTIFICATE-----\nSP_CERT\n-----END CERTIFICATE-----",
        samlServiceProviderEntityId: "https://kitezh.example/saml",
        samlSignAuthnRequests: true,
        samlWantAssertionsSigned: true,
        samlNameIdFormat:
          "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        samlPrincipalAttribute: "NameID",
        samlEmailAttribute: "email",
        samlFirstNameAttribute: "givenName",
        samlLastNameAttribute: "sn",
        samlGroupsAttribute: "groups",
        samlDecryptionPrivateKeyConfigured: true,
        samlDecryptionCertificate:
          "-----BEGIN CERTIFICATE-----\nDEC_CERT\n-----END CERTIFICATE-----",
        samlSignatureAlgorithm:
          "https://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
        samlAuthnRequestBinding: "REDIRECT",
        samlResponseBinding: "POST",
        samlLogoutBinding: "REDIRECT",
        samlForceAuthentication: false,
        samlPassSubject: false,
        mapperCount: 0,
      };
      globalThis.__createdSamlProvider = null;
      globalThis.__oidcRequestSummaries = [];
      globalThis.__samlRequestSummaries = [];
      globalThis.__providerCalls = [];
      globalThis.fetch = async (url, init) => {
        const requestUrl = new URL(String(url));
        const requestMethod = String(init?.method ?? "GET").toUpperCase();
        if (requestUrl.pathname.startsWith("/api/admin/identity-providers"))
          globalThis.__providerCalls.push({
            method: requestMethod,
            path: requestUrl.pathname,
          });
        if (requestUrl.pathname === "/oauth2/token")
          return new Response(
            JSON.stringify({
              access_token: "test-admin-access-token",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/admin/whoami")
          return new Response(
            JSON.stringify({ access: globalThis.__adminAccessFlags }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/admin/dashboard")
          return new Response(
            JSON.stringify({ clients: 1, users: 1, sessions: 0, consents: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname === "/api/admin/identity-providers") {
          if (requestMethod === "GET")
            return new Response(
              JSON.stringify({
                content: [globalThis.__oidcProvider, globalThis.__samlProvider],
                number: 0,
                totalPages: 1,
                totalElements: 1,
                size: 20,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          const body = JSON.parse(init?.body ?? "{}");
          if (body.providerType === "saml") {
            globalThis.__samlRequestSummaries.push({
              method: requestMethod,
              registrationId: body.registrationId,
              alias: body.alias,
              metadataUri: body.samlMetadataUri,
              signAuthnRequests: body.samlSignAuthnRequests,
              signingKeyProvided: Boolean(body.samlSigningPrivateKey),
              decryptionKeyProvided: Boolean(body.samlDecryptionPrivateKey),
              idpCertificate: body.samlIdpCertificate,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            const saved = {
              ...globalThis.__samlProvider,
              ...body,
              id: "provider-saml-new",
              samlSigningPrivateKeyConfigured: Boolean(
                body.samlSigningPrivateKey,
              ),
              samlDecryptionPrivateKeyConfigured: Boolean(
                body.samlDecryptionPrivateKey,
              ),
              configured: true,
            };
            delete saved.samlSigningPrivateKey;
            delete saved.samlDecryptionPrivateKey;
            globalThis.__createdSamlProvider = saved;
            return new Response(JSON.stringify(saved), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          }
          globalThis.__oidcRequestSummaries.push({
            method: requestMethod,
            registrationId: body.registrationId,
            alias: body.alias,
            authorizationUri: body.authorizationUri,
            clientAuthenticationMethod: body.clientAuthenticationMethod,
            secretProvided: Boolean(body.clientSecret),
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.alias === "rejected-oidc")
            return new Response(
              JSON.stringify({
                detail: "Choose another provider alias.",
                violations: [
                  { field: "alias", message: "Choose another provider alias." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          const saved = {
            ...globalThis.__oidcProvider,
            ...body,
            id: "provider-new",
            clientSecretConfigured: true,
            configured: true,
          };
          delete saved.clientSecret;
          globalThis.__oidcProvider = saved;
          return new Response(JSON.stringify(saved), {
            status: requestMethod === "POST" ? 201 : 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          requestUrl.pathname ===
          `/api/admin/identity-providers/${globalThis.__oidcProvider.id}`
        ) {
          if (requestMethod === "GET")
            return new Response(JSON.stringify(globalThis.__oidcProvider), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__oidcRequestSummaries.push({
              method: requestMethod,
              registrationId: body.registrationId,
              alias: body.alias,
              authorizationUri: body.authorizationUri,
              clientAuthenticationMethod: body.clientAuthenticationMethod,
              secretProvided: Boolean(body.clientSecret),
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            const saved = {
              ...globalThis.__oidcProvider,
              ...body,
              clientSecretConfigured: true,
              configured: true,
            };
            delete saved.clientSecret;
            globalThis.__oidcProvider = saved;
            return new Response(JSON.stringify(saved), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        if (
          requestUrl.pathname === "/api/admin/identity-providers/provider-saml"
        ) {
          if (requestMethod === "GET")
            return new Response(JSON.stringify(globalThis.__samlProvider), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__samlRequestSummaries.push({
              method: requestMethod,
              registrationId: body.registrationId,
              alias: body.alias,
              metadataUri: body.samlMetadataUri,
              signAuthnRequests: body.samlSignAuthnRequests,
              signingKeyProvided: Boolean(body.samlSigningPrivateKey),
              decryptionKeyProvided: Boolean(body.samlDecryptionPrivateKey),
              idpCertificate: body.samlIdpCertificate,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            const saved = { ...globalThis.__samlProvider, ...body };
            delete saved.samlSigningPrivateKey;
            delete saved.samlDecryptionPrivateKey;
            globalThis.__samlProvider = saved;
            return new Response(JSON.stringify(saved), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        throw new Error("Unexpected OIDC provider E2E API request");
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
    await application.evaluate(({ app }) => {
      const state = new URL(
        globalThis.__pendingAuthorizationUrl,
      ).searchParams.get("state");
      app.emit(
        "open-url",
        { preventDefault() {} },
        `kitezh://oauth/callback?state=${state}&code=oidc-provider-e2e-code`,
      );
    });
    await window
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    const providersNavigation = window.getByRole("button", {
      name: "Identity providers",
      exact: true,
    });
    if ((await providersNavigation.count()) === 0)
      assert.fail(
        `Admin navigation was not rendered: ${await window.locator("body").innerText()}`,
      );
    await providersNavigation.click();
    await window.getByText("Google", { exact: true }).waitFor();
    assert.equal(
      await window
        .locator('[data-identity-provider-id="provider-1"]')
        .getByRole("button", { name: "Edit connection", exact: true })
        .count(),
      1,
    );

    await window.getByRole("button", { name: "Add OIDC provider" }).click();
    const createForm = window.locator(
      'form[data-form="admin-identity-provider-connection"]',
    );
    await createForm.waitFor();
    await createForm.locator('[name="registrationId"]').fill("native-oidc");
    await createForm.locator('[name="displayName"]').fill("Native OIDC");
    await createForm.locator('[name="alias"]').fill("native-oidc");
    await createForm.locator('[name="clientId"]').fill("native-client");
    await createForm
      .locator('[name="clientSecret"]')
      .fill("OIDC_SECRET_MUST_NOT_PERSIST");
    await createForm
      .locator('[name="authorizationUri"]')
      .fill("https://issuer.example/authorize");
    await createForm
      .locator('[name="tokenUri"]')
      .fill("https://issuer.example/token");
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    const createButton = createForm.getByRole("button", {
      name: "Add OIDC provider",
      exact: true,
    });
    assert.equal(await createButton.isDisabled(), true);
    assert.equal(
      await createForm.locator('[name="clientSecret"]').inputValue(),
      "",
    );
    assert.equal(
      await createForm.locator('[name="registrationId"]').inputValue(),
      "native-oidc",
    );
    await createForm.dispatchEvent("submit");
    assert.deepEqual(
      await application.evaluate(() => globalThis.__oidcRequestSummaries),
      [],
    );

    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await createForm
      .locator('[name="clientSecret"]')
      .fill("OIDC_SECRET_MUST_NOT_PERSIST");
    await createForm
      .locator('[name="authorizationUri"]')
      .fill("http://untrusted.example/authorize");
    await createButton.click();
    await createForm
      .getByText("Enter absolute URIs without fragments.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__oidcRequestSummaries),
      [],
    );
    await createForm
      .locator('[name="clientSecret"]')
      .fill("OIDC_SECRET_MUST_NOT_PERSIST");
    await createForm
      .locator('[name="authorizationUri"]')
      .fill("https://issuer.example/authorize");
    await createForm.locator('[name="alias"]').fill("rejected-oidc");
    await createButton.click();
    assert.equal(await createButton.isDisabled(), true);
    assert.equal(await createButton.locator(".spinner").count(), 1);
    await createForm
      .getByText("Choose another provider alias.", { exact: true })
      .waitFor();
    assert.equal(
      await createForm.locator('[name="clientSecret"]').inputValue(),
      "",
    );
    assert.equal(
      await createForm.locator('[name="displayName"]').inputValue(),
      "Native OIDC",
    );

    await createForm.locator('[name="alias"]').fill("native-oidc");
    await createForm
      .locator('[name="clientSecret"]')
      .fill("OIDC_SECRET_MUST_NOT_PERSIST");
    await createButton.click();
    assert.equal(await createButton.isDisabled(), true);
    assert.equal(await createButton.locator(".spinner").count(), 1);
    await createForm.dispatchEvent("submit");
    await window.getByText("OIDC provider created.", { exact: true }).waitFor();
    const requestSummaries = await application.evaluate(
      () => globalThis.__oidcRequestSummaries,
    );
    assert.deepEqual(requestSummaries, [
      {
        method: "POST",
        registrationId: "native-oidc",
        alias: "rejected-oidc",
        authorizationUri: "https://issuer.example/authorize",
        clientAuthenticationMethod: "client_secret_basic",
        secretProvided: true,
      },
      {
        method: "POST",
        registrationId: "native-oidc",
        alias: "native-oidc",
        authorizationUri: "https://issuer.example/authorize",
        clientAuthenticationMethod: "client_secret_basic",
        secretProvided: true,
      },
    ]);

    await window.getByRole("button", { name: "Turkish", exact: true }).click();
    const createdProvider = window.locator(
      '[data-identity-provider-id="provider-new"]',
    );
    await createdProvider
      .getByRole("button", { name: "Bağlantıyı düzenle", exact: true })
      .click();
    const editForm = createdProvider.locator(
      'form[data-form="admin-identity-provider-connection"]',
    );
    await editForm.waitFor();
    assert.equal(
      await editForm.locator('[name="clientSecret"]').inputValue(),
      "",
    );
    await editForm
      .locator('[name="authorizationUri"]')
      .fill("https://issuer.example/v2/authorize");
    const saveButton = editForm.locator('button[type="submit"]');
    assert.equal(await saveButton.count(), 1, await editForm.innerText());
    assert.match(await saveButton.innerText(), /Kaydet/);
    await saveButton.click();
    await window
      .getByText("Sağlayıcı bağlantısı güncellendi.", { exact: true })
      .waitFor();
    const finalRequests = await application.evaluate(
      () => globalThis.__oidcRequestSummaries,
    );
    assert.equal(finalRequests.at(-1).method, "PUT");
    assert.equal(
      finalRequests.at(-1).authorizationUri,
      "https://issuer.example/v2/authorize",
    );
    assert.equal(finalRequests.at(-1).secretProvided, false);
    assert.equal(
      await window.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage]).includes(
          "OIDC_SECRET_MUST_NOT_PERSIST",
        ),
      ),
      false,
    );
    assert.equal(
      JSON.stringify(finalRequests).includes("OIDC_SECRET_MUST_NOT_PERSIST"),
      false,
    );

    await window
      .getByRole("button", { name: "SAML sağlayıcısı ekle", exact: true })
      .click();
    const samlCreateForm = window.locator(
      'form[data-form="admin-saml-identity-provider-connection"]',
    );
    await samlCreateForm.waitFor();
    await samlCreateForm.locator('[name="registrationId"]').fill("native-saml");
    await samlCreateForm.locator('[name="displayName"]').fill("Native SAML");
    await samlCreateForm.locator('[name="alias"]').fill("native-saml");
    await samlCreateForm
      .locator('[name="samlMetadataUri"]')
      .fill("http://untrusted.example/metadata");
    await samlCreateForm
      .locator('[name="samlSigningCertificate"]')
      .fill(
        "-----BEGIN CERTIFICATE-----\nSIGNING_CERT\n-----END CERTIFICATE-----",
      );
    await samlCreateForm
      .locator('[name="samlSigningPrivateKey"]')
      .fill(
        "-----BEGIN PRIVATE KEY-----\nSIGNING_KEY_SENTINEL\n-----END PRIVATE KEY-----",
      );
    await samlCreateForm.locator('[name="samlSignAuthnRequests"]').check();
    await samlCreateForm
      .locator('[name="samlDecryptionCertificate"]')
      .fill(
        "-----BEGIN CERTIFICATE-----\nDECRYPTION_CERT\n-----END CERTIFICATE-----",
      );
    await samlCreateForm
      .locator('[name="samlDecryptionPrivateKey"]')
      .fill(
        "-----BEGIN PRIVATE KEY-----\nDECRYPTION_KEY_SENTINEL\n-----END PRIVATE KEY-----",
      );
    const samlCreateButton = samlCreateForm.getByRole("button", {
      name: "SAML sağlayıcısı ekle",
      exact: true,
    });
    await samlCreateButton.click();
    await samlCreateForm
      .getByText("Parça içermeyen mutlak URI girin.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__samlRequestSummaries),
      [],
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    assert.equal(
      await samlCreateForm
        .locator('[name="samlSigningPrivateKey"]')
        .inputValue(),
      "",
    );
    assert.equal(
      await samlCreateForm
        .locator('[name="samlDecryptionPrivateKey"]')
        .inputValue(),
      "",
    );
    assert.equal(
      await samlCreateForm.locator('[name="registrationId"]').inputValue(),
      "native-saml",
    );
    await samlCreateForm.dispatchEvent("submit");
    assert.deepEqual(
      await application.evaluate(() => globalThis.__samlRequestSummaries),
      [],
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await samlCreateForm
      .locator('[name="samlMetadataUri"]')
      .fill("https://idp.example/metadata");
    await samlCreateForm
      .locator('[name="samlSigningPrivateKey"]')
      .fill(
        "-----BEGIN PRIVATE KEY-----\nSIGNING_KEY_SENTINEL\n-----END PRIVATE KEY-----",
      );
    await samlCreateForm
      .locator('[name="samlDecryptionPrivateKey"]')
      .fill(
        "-----BEGIN PRIVATE KEY-----\nDECRYPTION_KEY_SENTINEL\n-----END PRIVATE KEY-----",
      );
    await samlCreateButton.click();
    assert.equal(
      await samlCreateButton.isDisabled(),
      true,
      await samlCreateForm.innerText(),
    );
    assert.equal(await samlCreateButton.locator(".spinner").count(), 1);
    await samlCreateForm.dispatchEvent("submit");
    await window
      .getByText("SAML sağlayıcısı oluşturuldu.", { exact: true })
      .waitFor();
    const samlRequests = await application.evaluate(
      () => globalThis.__samlRequestSummaries,
    );
    assert.equal(samlRequests.length, 1);
    assert.deepEqual(samlRequests[0], {
      method: "POST",
      registrationId: "native-saml",
      alias: "native-saml",
      metadataUri: "https://idp.example/metadata",
      signAuthnRequests: true,
      signingKeyProvided: true,
      decryptionKeyProvided: true,
      idpCertificate: null,
    });
    assert.equal(
      JSON.stringify(samlRequests).includes("SIGNING_KEY_SENTINEL"),
      false,
    );
    assert.equal(
      JSON.stringify(samlRequests).includes("DECRYPTION_KEY_SENTINEL"),
      false,
    );
    assert.equal(
      await window.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage]).includes(
          "SIGNING_KEY_SENTINEL",
        ),
      ),
      false,
    );

    const existingSaml = window.locator(
      '[data-identity-provider-id="provider-saml"]',
    );
    await existingSaml
      .getByRole("button", {
        name: "SAML yapılandırmasını düzenle",
        exact: true,
      })
      .click();
    const samlEditForm = existingSaml.locator(
      'form[data-form="admin-saml-identity-provider-connection"]',
    );
    await samlEditForm.waitFor();
    assert.equal(
      await samlEditForm.locator('[name="samlSigningPrivateKey"]').inputValue(),
      "",
    );
    assert.equal(
      await samlEditForm
        .locator('[name="samlDecryptionPrivateKey"]')
        .inputValue(),
      "",
    );
    assert.match(
      await samlEditForm.locator('[name="samlIdpCertificate"]').inputValue(),
      /BEGIN CERTIFICATE/,
    );
    await samlEditForm
      .locator('[name="samlMetadataUri"]')
      .fill("https://idp.example/v2/metadata");
    const samlSaveButton = samlEditForm.locator('button[type="submit"]');
    await samlSaveButton.click();
    assert.equal(await samlSaveButton.isDisabled(), true);
    assert.equal(await samlSaveButton.locator(".spinner").count(), 1);
    await samlEditForm.dispatchEvent("submit");
    await window
      .getByText("Sağlayıcı bağlantısı güncellendi.", { exact: true })
      .waitFor();
    const editedSamlRequests = await application.evaluate(
      () => globalThis.__samlRequestSummaries,
    );
    assert.deepEqual(editedSamlRequests.at(-1), {
      method: "PUT",
      registrationId: "saml-existing",
      alias: "saml-existing",
      metadataUri: "https://idp.example/v2/metadata",
      signAuthnRequests: true,
      signingKeyProvided: false,
      decryptionKeyProvided: false,
      idpCertificate:
        "-----BEGIN CERTIFICATE-----\nIDP_CERT\n-----END CERTIFICATE-----",
    });
    assert.equal(JSON.stringify(editedSamlRequests).includes("IDP_CERT"), true);
    const providerCalls = await application.evaluate(
      () => globalThis.__providerCalls,
    );
    assert.equal(
      providerCalls.some(
        (call) =>
          call.method === "POST" &&
          call.path === "/api/admin/identity-providers",
      ),
      true,
    );
    assert.equal(
      providerCalls.some(
        (call) =>
          call.method === "GET" &&
          call.path === "/api/admin/identity-providers/provider-saml",
      ),
      true,
    );
    assert.equal(
      providerCalls.some(
        (call) =>
          call.method === "PUT" &&
          call.path === "/api/admin/identity-providers/provider-saml",
      ),
      true,
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
      globalThis.__adminAccessFlags = {
        isAdmin: true,
        queryUsers: true,
        viewUsers: true,
        manageUsers: true,
        viewRoles: true,
        manageRoles: true,
        queryGroups: true,
        viewGroups: true,
        manageGroups: true,
        queryClients: true,
        viewClients: true,
        manageClients: true,
        viewSessions: true,
        manageSessions: true,
        viewConsents: true,
        manageConsents: true,
        viewEvents: true,
        manageEvents: true,
        viewKeys: true,
        manageKeys: true,
      };
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
        if (requestUrl.pathname === "/api/admin/whoami")
          return new Response(
            JSON.stringify({ access: globalThis.__adminAccessFlags }),
            { status: 200, headers: { "Content-Type": "application/json" } },
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
          /^\/api\/admin\/users\/[1-9]\d*\/enabled$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminUserEnabledRequests ??= [];
          globalThis.__adminUserEnabledRequests.push({
            id,
            enabled: body.enabled,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__userEnabledStates ??= {};
          globalThis.__userEnabledStates[id] = body.enabled;
          return new Response(null, { status: 204 });
        }
        if (
          requestUrl.pathname === "/api/admin/users/bulk" &&
          requestMethod === "POST"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminBulkUserRequests ??= [];
          globalThis.__adminBulkUserRequests.push({
            action: body.action,
            userIds: body.userIds,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.action === "ENABLE" || body.action === "DISABLE") {
            globalThis.__userEnabledStates ??= {};
            for (const id of body.userIds ?? [])
              globalThis.__userEnabledStates[id] = body.action === "ENABLE";
          }
          return new Response(
            JSON.stringify({
              action: body.action,
              affectedCount: body.userIds?.length ?? 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/totp$/.test(requestUrl.pathname) &&
          requestMethod === "DELETE"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          globalThis.__adminTotpResetRequests ??= [];
          globalThis.__adminTotpResetRequests.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/execute-actions-email$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          const actions = JSON.parse(init?.body ?? "[]");
          globalThis.__adminActionEmailRequests ??= [];
          globalThis.__adminActionEmailRequests.push({
            id,
            actions,
            lifespan: requestUrl.searchParams.get("lifespan"),
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/unlock$/.test(requestUrl.pathname) &&
          requestMethod === "POST"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          globalThis.__adminUserUnlockRequests ??= [];
          globalThis.__adminUserUnlockRequests.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__userUnlockedStates ??= {};
          globalThis.__userUnlockedStates[id] = true;
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/password$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminPasswordResetRequests ??= [];
          globalThis.__adminPasswordResetRequests.push({
            id,
            passwordLength: String(body.password ?? "").length,
            temporary: body.temporary,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.password === "Rejected-password12!")
            return new Response(
              JSON.stringify({
                detail: "Correct the password.",
                violations: [
                  {
                    field: "password",
                    message: "Choose a different password.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/profile-attributes$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "GET"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          globalThis.__adminProfileAttributeReads ??= [];
          globalThis.__adminProfileAttributeReads.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              definitions: [
                {
                  name: "department",
                  displayName: "Department",
                  type: "STRING",
                  required: true,
                  multivalued: false,
                  minLength: 3,
                  maxLength: 40,
                  enabled: true,
                  builtIn: false,
                },
                {
                  name: "skills",
                  displayName: "Skills",
                  type: "STRING",
                  required: false,
                  multivalued: true,
                  maxLength: 40,
                  enabled: true,
                  builtIn: false,
                },
                {
                  name: "firstName",
                  displayName: "Built-in first name",
                  type: "STRING",
                  required: false,
                  multivalued: false,
                  enabled: true,
                  builtIn: true,
                },
              ],
              attributes: { department: ["Research"], skills: ["java"] },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/profile-attributes$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-2));
          const body = JSON.parse(init?.body ?? "{}");
          const attributes = body.attributes ?? {};
          globalThis.__adminProfileAttributeWrites ??= [];
          globalThis.__adminProfileAttributeWrites.push({
            id,
            names: Object.keys(attributes).sort(),
            departmentCount: attributes.department?.length ?? 0,
            departmentLength: attributes.department?.[0]?.length ?? 0,
            skillsCount: attributes.skills?.length ?? 0,
            skillsLength: attributes.skills?.join("").length ?? 0,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (attributes.department?.[0] === "Rejected Department")
            return new Response(
              JSON.stringify({
                detail: "Correct the profile attributes.",
                violations: [
                  {
                    field: "attributes.department",
                    message: "Choose another department.",
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
              definitions: [
                {
                  name: "department",
                  displayName: "Department",
                  type: "STRING",
                  required: true,
                  multivalued: false,
                  minLength: 3,
                  maxLength: 40,
                  enabled: true,
                  builtIn: false,
                },
                {
                  name: "skills",
                  displayName: "Skills",
                  type: "STRING",
                  required: false,
                  multivalued: true,
                  maxLength: 40,
                  enabled: true,
                  builtIn: false,
                },
              ],
              attributes,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/avatar$/.test(requestUrl.pathname) &&
          requestMethod === "PUT"
        ) {
          const userId = Number(requestUrl.pathname.split("/").at(-2));
          const file = init?.body?.get("file");
          globalThis.__adminAvatarWrites ??= [];
          globalThis.__adminAvatarWrites.push({
            userId,
            contentType: file?.type,
            size: file?.size,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              avatarUrl: "/avatars/00000000-0000-4000-8000-000000000007?v=1",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/avatar$/.test(requestUrl.pathname) &&
          requestMethod === "DELETE"
        ) {
          const userId = Number(requestUrl.pathname.split("/").at(-2));
          globalThis.__adminAvatarDeletes ??= [];
          globalThis.__adminAvatarDeletes.push(userId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/webauthn\/credentials$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "GET"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-3));
          globalThis.__adminPasskeyListRequests ??= [];
          globalThis.__adminPasskeyListRequests.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              content: [
                {
                  credentialId: "e2e_credential_123",
                  label: "Office security key",
                  transports: ["usb"],
                  backupEligible: false,
                  backupState: false,
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 100,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/webauthn\/credentials\/[A-Za-z0-9_-]+$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-4));
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminPasskeyMutations ??= [];
          globalThis.__adminPasskeyMutations.push({
            method: "PUT",
            userId: id,
            credentialRouteValid: true,
            label: body.label,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.label === "Rejected label")
            return new Response(
              JSON.stringify({
                detail: "Correct the passkey label.",
                violations: [
                  { field: "label", message: "Choose another label." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          return new Response(null, { status: 204 });
        }
        if (
          requestUrl.pathname === "/api/admin/profile-attributes" &&
          requestMethod === "GET"
        ) {
          return new Response(
            JSON.stringify([
              {
                name: "department",
                displayName: "Department",
                type: "STRING",
                required: false,
                multivalued: false,
                maxLength: 40,
                enabled: true,
                builtIn: false,
              },
              {
                name: "firstName",
                displayName: "Built-in first name",
                type: "STRING",
                required: false,
                multivalued: false,
                enabled: true,
                builtIn: true,
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*\/webauthn\/credentials\/[A-Za-z0-9_-]+$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-4));
          globalThis.__adminPasskeyMutations ??= [];
          globalThis.__adminPasskeyMutations.push({
            method: "DELETE",
            userId: id,
            credentialRouteValid: true,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*$/.test(requestUrl.pathname) &&
          requestMethod === "PUT"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-1));
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminUserUpdateRequests ??= [];
          globalThis.__adminUserUpdateRequests.push({ id, body });
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.firstName === "Invalid")
            return new Response(
              JSON.stringify({
                detail: "Correct the user fields.",
                violations: [
                  { field: "firstName", message: "First name is invalid." },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          globalThis.__adminUserOverrides ??= {};
          globalThis.__adminUserOverrides[id] = {
            id,
            ...body,
            authorities: body.roles,
            assignedRoles: body.roles,
            effectiveRoles: body.roles,
          };
          return new Response(
            JSON.stringify(globalThis.__adminUserOverrides[id]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          /^\/api\/admin\/users\/[1-9]\d*$/.test(requestUrl.pathname) &&
          requestMethod === "DELETE"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-1));
          globalThis.__adminUserDeleteRequests ??= [];
          globalThis.__adminUserDeleteRequests.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
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
          if (Number(requestUrl.searchParams.get("size")) === 100)
            return new Response(
              JSON.stringify({
                content: [
                  { id: 1, username: "admin" },
                  { id: 2, username: "user" },
                ],
                number: 0,
                totalPages: 1,
                totalElements: 2,
                size: 100,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
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
              firstName: username === "admin" ? "Admin" : "Alice",
              lastName: "Example",
              email: `${username}@example.test`,
              emailVerified: true,
              enabled: globalThis.__userEnabledStates?.[page + 1] ?? true,
              locked:
                username === "alice-2" &&
                !globalThis.__userUnlockedStates?.[page + 1],
              totpEnabled: username === "alice-2",
              authorities: ["ROLE_USER"],
              assignedRoles: ["ROLE_USER"],
              effectiveRoles: ["ROLE_USER"],
            },
          ];
          content[0] = {
            ...content[0],
            ...(globalThis.__adminUserOverrides?.[page + 1] ?? {}),
          };
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
          requestMethod === "DELETE"
        ) {
          const roleName = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminRoleDeleteRequests ??= [];
          globalThis.__adminRoleDeleteRequests.push(roleName);
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__createdRoles = (globalThis.__createdRoles ?? []).filter(
            (role) => role.name !== roleName,
          );
          return new Response(null, { status: 204 });
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
          if (requestUrl.searchParams.get("size") !== "100")
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
                  {
                    name: "ROLE_USER_VIEWER",
                    description: "User viewer role",
                  },
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
        if (
          /^\/api\/admin\/groups\/[1-9]\d*\/name$/.test(requestUrl.pathname) &&
          requestMethod === "PUT"
        ) {
          const groupId = Number(requestUrl.pathname.split("/")[4]);
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminGroupRenameRequests ??= [];
          globalThis.__adminGroupRenameRequests.push({ id: groupId, body });
          await new Promise((resolve) => setTimeout(resolve, 350));
          const group = (globalThis.__createdGroups ?? []).find(
            (item) => item.id === groupId,
          );
          if (group) {
            group.name = body.name;
            group.path = `Organization / ${body.name}`;
          }
          return new Response(
            JSON.stringify({ id: groupId, name: body.name }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          /^\/api\/admin\/groups\/[1-9]\d*\/roles$/.test(requestUrl.pathname) &&
          requestMethod === "PUT"
        ) {
          const groupId = Number(requestUrl.pathname.split("/")[4]);
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminGroupRoleRequests ??= [];
          globalThis.__adminGroupRoleRequests.push({ id: groupId, body });
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__groupRoleUpdates ??= {};
          globalThis.__groupRoleUpdates[groupId] = body.roles;
          return new Response(
            JSON.stringify({ id: groupId, roles: body.roles }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          /^\/api\/admin\/groups\/[1-9]\d*\/(?:users|available-users)$/.test(
            requestUrl.pathname,
          )
        ) {
          const groupId = Number(requestUrl.pathname.split("/")[4]);
          globalThis.__adminGroupMemberRequests ??= [];
          globalThis.__adminGroupMemberRequests.push({
            method: requestMethod,
            path: requestUrl.pathname,
            search: requestUrl.search,
          });
          globalThis.__adminGroupMembers ??= [];
          if (requestMethod === "POST") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminGroupMembers.push({
              id: body.userId,
              username: "native-member",
              enabled: true,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            return new Response(JSON.stringify({ id: groupId }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (requestMethod === "GET") {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const available = requestUrl.pathname.endsWith("available-users");
            const content = available
              ? globalThis.__adminGroupMembers.length
                ? []
                : [{ id: 7, username: "native-member", enabled: true }]
              : globalThis.__adminGroupMembers;
            return new Response(
              JSON.stringify({ content, number: 0, totalPages: 1 }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }
        if (
          /^\/api\/admin\/groups\/[1-9]\d*\/users\/[1-9]\d*$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const parts = requestUrl.pathname.split("/");
          const groupId = Number(parts[4]);
          const userId = Number(parts[6]);
          globalThis.__adminGroupMemberRequests ??= [];
          globalThis.__adminGroupMemberRequests.push({
            method: requestMethod,
            path: requestUrl.pathname,
            search: requestUrl.search,
          });
          globalThis.__adminGroupMembers = (
            globalThis.__adminGroupMembers ?? []
          ).filter((user) => user.id !== userId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(JSON.stringify({ id: groupId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (
          /^\/api\/admin\/groups\/[1-9]\d*$/.test(requestUrl.pathname) &&
          requestMethod === "DELETE"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-1));
          globalThis.__adminGroupDeleteRequests ??= [];
          globalThis.__adminGroupDeleteRequests.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__createdGroups = (
            globalThis.__createdGroups ?? []
          ).filter((group) => group.id !== id);
          return new Response(null, { status: 204 });
        }
        const groupPermissionsMatch = requestUrl.pathname.match(
          /^\/api\/admin\/groups\/([1-9]\d*)\/permissions$/,
        );
        if (groupPermissionsMatch) {
          const groupId = Number(groupPermissionsMatch[1]);
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminGroupPermissionRequests ??= [];
            globalThis.__adminGroupPermissionRequests.push({
              id: groupId,
              body,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            const usernames = { 1: "admin", 2: "user" };
            globalThis.__groupPermissions ??= {};
            globalThis.__groupPermissions[groupId] = body.permissions.map(
              ({ userId, permission }) => ({
                userId,
                username: usernames[userId] ?? `user-${userId}`,
                permission,
              }),
            );
            return new Response(
              JSON.stringify(globalThis.__groupPermissions[groupId]),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(
            JSON.stringify(
              globalThis.__groupPermissions?.[groupId] ?? [
                { userId: 2, username: "user", permission: "VIEW" },
              ],
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
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
            const groupId = body.parentId ? 100 : 99;
            const parent = body.parentId
              ? globalThis.__createdGroups.find(
                  (group) => group.id === body.parentId,
                )
              : null;
            const parentPath =
              parent?.path ??
              (body.parentId === 1 ? "Organization / finance" : "Organization");
            globalThis.__createdGroups.push({
              id: groupId,
              name: body.name,
              parentId: body.parentId ?? null,
              path: `${parentPath} / ${body.name}`,
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
          for (const group of content) {
            const updatedRoles = globalThis.__groupRoleUpdates?.[group.id];
            if (updatedRoles) {
              group.roles = updatedRoles;
              group.effectiveRoles = updatedRoles;
            }
          }
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
          /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings\/(?:application-roles|client-roles)$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "GET"
        ) {
          const clientRoles = requestUrl.pathname.endsWith("/client-roles");
          globalThis.__clientScopeRoleCandidateRequests ??= [];
          globalThis.__clientScopeRoleCandidateRequests.push({
            path: requestUrl.pathname,
            query: Object.fromEntries(requestUrl.searchParams),
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          const content = clientRoles
            ? [
                {
                  id: 21,
                  clientId: "admin-console",
                  name: "manage_users",
                  description: "Manage users",
                },
              ]
            : [
                { name: "ROLE_USER", description: "Basic access" },
                { name: "ROLE_SCOPE_READER", description: "Read scoped data" },
              ];
          return new Response(
            JSON.stringify({
              content,
              number: Number(requestUrl.searchParams.get("page") ?? 0),
              totalPages: 1,
              totalElements: content.length,
              size: 20,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings$/.test(
            requestUrl.pathname,
          )
        ) {
          const scopeId = requestUrl.pathname.split("/").at(-2);
          globalThis.__clientScopeRoleMappings ??= {
            [scopeId]: {
              applicationRoles: ["ROLE_USER"],
              clientRoleIds: [11],
            },
          };
          if (requestMethod === "GET") {
            await new Promise((resolve) => setTimeout(resolve, 350));
            return new Response(
              JSON.stringify({
                applicationRoles:
                  globalThis.__clientScopeRoleMappings[scopeId]
                    ?.applicationRoles ?? [],
                clientRoles: (
                  globalThis.__clientScopeRoleMappings[scopeId]
                    ?.clientRoleIds ?? []
                ).map((id) => ({
                  id,
                  clientId: "existing-client",
                  name: `CLIENT_ROLE_${id}`,
                  description: "Existing client role",
                })),
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__clientScopeRoleMappingRequests ??= [];
            globalThis.__clientScopeRoleMappingRequests.push({
              id: scopeId,
              body,
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            globalThis.__clientScopeRoleMappings[scopeId] = body;
            return new Response(
              JSON.stringify({
                applicationRoles: body.applicationRoles,
                clientRoles: body.clientRoleIds.map((id) => ({
                  id,
                  clientId: id === 11 ? "existing-client" : "admin-console",
                  name: id === 11 ? "CLIENT_ROLE_11" : "manage_users",
                  description: "Client role",
                })),
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }
        if (
          /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const scopeId = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminClientScopeDeleteRequests ??= [];
          globalThis.__adminClientScopeDeleteRequests.push(scopeId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__createdClientScopes = (
            globalThis.__createdClientScopes ?? []
          ).filter((scope) => scope.id !== scopeId);
          return new Response(null, { status: 204 });
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
        if (
          requestMethod === "DELETE" &&
          /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          )
        ) {
          globalThis.__adminClientDeleteRequests ??= [];
          globalThis.__adminClientDeleteRequests.push(requestUrl.pathname);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          requestMethod === "POST" &&
          requestUrl.pathname === "/api/admin/clients"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__adminClientCreateRequests ??= [];
          globalThis.__adminClientCreateRequests.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              client: {
                id: "client-native-created",
                clientId: body.clientId,
                clientName: body.clientName,
                scopes: body.scopes,
                requireProofKey: body.requireProofKey,
              },
              clientSecret: body.clientAuthenticationMethods.includes("none")
                ? null
                : "ONE_TIME_CLIENT_SECRET_SENTINEL",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (requestUrl.pathname === "/api/admin/clients") {
          globalThis.__adminClientRequests ??= [];
          globalThis.__adminClientRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const query = requestUrl.searchParams.get("q") ?? "";
          const clientId = query ? "demo-client" : "account-console";
          const clientName =
            globalThis.__clientNativeMetadata?.clientName ??
            (query ? "Admin Console" : "Account Console");
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "client-1",
                  clientId,
                  clientName,
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
        if (requestUrl.pathname === "/api/admin/clients/client-1") {
          globalThis.__adminClientConfigurationReadRequests ??= [];
          if (requestMethod === "GET") {
            globalThis.__adminClientConfigurationReadRequests.push(true);
            await new Promise((resolve) => setTimeout(resolve, 350));
            globalThis.__adminClientConfiguration ??= {
              id: "client-1",
              clientId: "demo-client",
              clientName: "Admin Console",
              clientIdIssuedAt: "2026-01-01T00:00:00Z",
              clientSecretExpiresAt: null,
              clientAuthenticationMethods: ["none"],
              authorizationGrantTypes: [
                "authorization_code",
                "refresh_token",
                "urn:openid:params:grant-type:ciba",
              ],
              redirectUris: ["https://client.example/callback"],
              postLogoutRedirectUris: [],
              scopes: ["openid", "profile"],
              requireAuthorizationConsent: false,
              requireProofKey: true,
              requireDpop: false,
              requireDpopJkt: false,
              dpopRefreshTokenOnly: false,
              dpopSigningAlgorithms: ["RS256"],
              cibaDeliveryMode: "ping",
              cibaNotificationEndpoint: "https://client.example/ciba",
              cibaClientNotificationTokenConfigured: true,
              authorizationCodeTimeToLive: "PT5M",
              accessTokenTimeToLive: "PT5M",
              refreshTokenTimeToLive: "PT1H",
              serviceAccountEnabled: false,
              serviceAccountUsername: "private-service-account-name",
              enabled: true,
              rootUrl: "https://client.example",
              homeUrl: "https://client.example/home",
              webOrigins: ["https://client.example"],
              adminUrl: "https://client.example/admin",
              frontChannelLogout: false,
              backchannelLogout: false,
              jwkSetUrl: null,
              tokenEndpointAuthenticationSigningAlgorithm: null,
              x509CertificateSubjectDN: null,
              offlineSessionIdle: null,
              offlineSessionMax: null,
              tokenExchangeDownscopeOnly: false,
              tokenExchangeAllowDelegation: false,
              tokenExchangeAllowedAudiences: [],
            };
            return new Response(
              JSON.stringify(globalThis.__adminClientConfiguration),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            const { cibaClientNotificationToken, ...safeBody } = body;
            globalThis.__adminClientConfigurationRequests ??= [];
            globalThis.__adminClientConfigurationRequests.push({
              body: safeBody,
              cibaTokenProvided: Boolean(cibaClientNotificationToken),
            });
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.clientName === "Rejected policy")
              return new Response(
                JSON.stringify({
                  detail: "Correct the client configuration.",
                  violations: [
                    {
                      field: "clientName",
                      message: "Choose another client name.",
                    },
                  ],
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__adminClientConfiguration = {
              ...globalThis.__adminClientConfiguration,
              ...safeBody,
              cibaClientNotificationTokenConfigured:
                Boolean(cibaClientNotificationToken) ||
                globalThis.__adminClientConfiguration
                  .cibaClientNotificationTokenConfigured,
            };
            return new Response(
              JSON.stringify(globalThis.__adminClientConfiguration),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
        }
        if (
          /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/native-metadata$/.test(
            requestUrl.pathname,
          )
        ) {
          if (requestMethod === "GET")
            return new Response(
              JSON.stringify({
                id: "client-1",
                clientId: "demo-client",
                clientName:
                  globalThis.__clientNativeMetadata?.clientName ??
                  "Admin Console",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__clientNativeMetadataRequests ??= [];
            globalThis.__clientNativeMetadataRequests.push(body);
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.clientName === "Rejected client")
              return new Response(
                JSON.stringify({
                  detail: "Correct the client name.",
                  violations: [
                    {
                      field: "clientName",
                      message: "Choose another client name.",
                    },
                  ],
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__clientNativeMetadata = {
              clientName: body.clientName,
            };
            return new Response(
              JSON.stringify({
                id: "client-1",
                clientId: "demo-client",
                clientName: body.clientName,
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }
        if (
          /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/native-policy$/.test(
            requestUrl.pathname,
          )
        ) {
          globalThis.__adminProviderPolicy ??= {
            id: "provider-1",
            displayName: "Google",
            enabled: true,
            hideOnLogin: false,
            accountLinkingOnly: false,
            trustEmail: true,
            mfaRequired: false,
            guiOrder: 1,
            showInAccountConsole: "always",
            syncMode: "import",
          };
          if (requestMethod === "GET")
            return new Response(
              JSON.stringify(globalThis.__adminProviderPolicy),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          if (requestMethod === "PUT") {
            const body = JSON.parse(init?.body ?? "{}");
            globalThis.__adminProviderPolicyRequests ??= [];
            globalThis.__adminProviderPolicyRequests.push(body);
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.displayName === "Rejected policy")
              return new Response(
                JSON.stringify({
                  detail: "Correct the provider policy.",
                  violations: [
                    {
                      field: "displayName",
                      message: "Choose another provider name.",
                    },
                  ],
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            globalThis.__adminProviderPolicy = {
              ...globalThis.__adminProviderPolicy,
              ...body,
            };
            return new Response(
              JSON.stringify(globalThis.__adminProviderPolicy),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }
        if (
          /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const providerId = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminIdentityProviderDeleteRequests ??= [];
          globalThis.__adminIdentityProviderDeleteRequests.push(providerId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const mapperId = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminProviderMapperDeleteRequests ??= [];
          globalThis.__adminProviderMapperDeleteRequests.push(mapperId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers(?:\/[A-Za-z0-9_-]{1,100})?$/.test(
            requestUrl.pathname,
          ) &&
          ["POST", "PUT"].includes(requestMethod)
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          const mapperId = requestUrl.pathname.split("/").at(-1);
          if (requestMethod === "PUT") {
            globalThis.__adminProviderMapperUpdateRequests ??= [];
            globalThis.__adminProviderMapperUpdateRequests.push(body);
            if (globalThis.__adminProviderMapperUpdateRequests.length === 1) {
              await new Promise((resolve) => setTimeout(resolve, 350));
              const messageLanguage =
                init?.headers?.["Accept-Language"] === "tr" ? "tr" : "en";
              return new Response(
                JSON.stringify({
                  detail:
                    messageLanguage === "tr"
                      ? "Eşleyici alanlarını denetleyin."
                      : "Check the mapper fields.",
                  violations: [
                    {
                      field: "target",
                      message:
                        messageLanguage === "tr"
                          ? "Hedef yolu geçersiz."
                          : "Target path is invalid.",
                    },
                  ],
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/problem+json" },
                },
              );
            }
          } else {
            globalThis.__adminProviderMapperCreateRequests ??= [];
            globalThis.__adminProviderMapperCreateRequests.push(body);
          }
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              ...body,
              id: requestMethod === "POST" ? "mapper-2" : mapperId,
              providerAlias: "google",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers$/.test(
            requestUrl.pathname,
          )
        ) {
          globalThis.__adminProviderMapperRequests ??= [];
          globalThis.__adminProviderMapperRequests.push(requestUrl.search);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "mapper-1",
                  providerAlias: "google",
                  name: "email-mapper",
                  sourceClaim: "email",
                  target: "email",
                  mapperType: "user-attribute",
                  syncMode: "import",
                  addToIdToken: true,
                  addToAccessToken: true,
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
        if (
          requestUrl.pathname === "/api/admin/sessions/revoke-all" &&
          requestMethod === "POST"
        ) {
          globalThis.__adminSessionRevokeAllRequests ??= [];
          globalThis.__adminSessionRevokeAllRequests.push({
            method: requestMethod,
            body: init?.body,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (
          /^\/api\/admin\/sessions\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const sessionId = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminSessionDeleteRequests ??= [];
          globalThis.__adminSessionDeleteRequests.push(sessionId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
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
        if (
          /^\/api\/admin\/consents\/consents\/[A-Za-z0-9._~-]{1,100}\/[A-Za-z0-9._~-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          globalThis.__adminConsentRevokeRequests ??= [];
          globalThis.__adminConsentRevokeRequests.push(requestUrl.pathname);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
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
        if (
          /^\/api\/admin\/offline-sessions\/[A-Za-z0-9_-]{1,100}$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const sessionId = requestUrl.pathname.split("/").at(-1);
          globalThis.__adminOfflineSessionDeleteRequests ??= [];
          globalThis.__adminOfflineSessionDeleteRequests.push(sessionId);
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
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
        if (
          requestUrl.pathname === "/api/admin/keys/rotate" &&
          requestMethod === "POST"
        ) {
          globalThis.__adminKeyRotationRequests ??= [];
          globalThis.__adminKeyRotationRequests.push({
            method: requestMethod,
            path: requestUrl.pathname,
            bodyPresent: Boolean(init?.body),
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          globalThis.__adminKeyRotated = true;
          const rotationNumber = globalThis.__adminKeyRotationRequests.length;
          return new Response(
            JSON.stringify({
              id: "rotated-key-id",
              kid: `rsa-rotated-${rotationNumber}`,
              type: "RSA",
              algorithm: "RS256",
              use: "sig",
              active: true,
              privateKey: "SECRET_PRIVATE_KEY_NEVER_RENDER",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
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
                  kid:
                    globalThis.__adminKeyRotated &&
                    requestUrl.searchParams.get("active") !== "false"
                      ? `rsa-rotated-${globalThis.__adminKeyRotationRequests?.length ?? 1}`
                      : query
                        ? "rsa-retired"
                        : "rsa-active",
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
        if (
          requestUrl.pathname ===
            "/api/admin/settings/offline-access/revoke-all" &&
          requestMethod === "POST"
        ) {
          globalThis.__offlineAccessRevokeCount =
            (globalThis.__offlineAccessRevokeCount ?? 0) + 1;
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({
              idleTimeout: "P45D",
              maxLifespan: "P365D",
              maxLimited: true,
              revokedBefore: "2026-10-10T00:00:00Z",
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
        if (
          requestUrl.pathname === "/api/admin/settings/login/native" &&
          requestMethod === "PUT"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__nativeLoginPolicyUpdates ??= [];
          globalThis.__nativeLoginPolicyUpdates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.passwordMinimumLength === 9)
            return new Response(
              JSON.stringify({
                violations: [
                  {
                    field: "passwordMinimumLength",
                    message: "Server requires at least 10 characters.",
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
        if (requestUrl.pathname === "/api/admin/settings/login/native") {
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
          requestUrl.pathname === "/api/admin/settings/localization/messages" &&
          requestMethod === "POST"
        ) {
          const body = JSON.parse(init?.body ?? "{}");
          globalThis.__localizationMessageCreates ??= [];
          globalThis.__localizationMessageCreates.push(body);
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (body.messageKey === "invalid.key")
            return new Response(
              JSON.stringify({
                detail: "Correct the localization fields.",
                violations: [
                  {
                    field: "messageKey",
                    message: "Choose another message key.",
                  },
                ],
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/problem+json" },
              },
            );
          globalThis.__createdLocalizationMessages ??= [];
          globalThis.__createdLocalizationMessages.push({ id: 2, ...body });
          return new Response(
            JSON.stringify(globalThis.__createdLocalizationMessages.at(-1)),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          /^\/api\/admin\/settings\/localization\/messages\/[1-9]\d*$/.test(
            requestUrl.pathname,
          ) &&
          requestMethod === "DELETE"
        ) {
          const id = Number(requestUrl.pathname.split("/").at(-1));
          globalThis.__localizationMessageDeletes ??= [];
          globalThis.__localizationMessageDeletes.push(id);
          await new Promise((resolve) => setTimeout(resolve, 350));
          globalThis.__createdLocalizationMessages = (
            globalThis.__createdLocalizationMessages ?? []
          ).filter((item) => item.id !== id);
          return new Response(null, { status: 204 });
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
                ...(globalThis.__createdLocalizationMessages ?? []),
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
        buttonBorderStyle: getComputedStyle(
          document.querySelector(".primary-button"),
        ).borderTopStyle,
        buttonHasVisibleBorder:
          Number.parseFloat(
            getComputedStyle(document.querySelector(".primary-button"))
              .borderTopWidth,
          ) > 0,
      })),
      {
        background: "Canvas",
        primary: "Highlight",
        text: "CanvasText",
        buttonBorderStyle: "solid",
        buttonHasVisibleBorder: true,
      },
    );
    await window.emulateMedia({ forcedColors: "none" });
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
    const aliceRow = window.locator('article[data-user-id="2"]');
    await aliceRow.getByText("Locked", { exact: true }).waitFor();
    const selectAliceForBulk = aliceRow.locator(
      'input[data-action="admin-user-bulk-select"]',
    );
    await selectAliceForBulk.check();
    const bulkUsersPanel = window.getByRole("region", {
      name: "Selected users",
    });
    const enableSelectedUsers = bulkUsersPanel.getByRole("button", {
      name: "Enable selected",
      exact: true,
    });
    await enableSelectedUsers.click();
    await bulkUsersPanel
      .getByText("Apply this action to the selected users?", { exact: true })
      .waitFor();
    await bulkUsersPanel
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminBulkUserRequests ?? [],
      ),
      [],
    );
    await bulkUsersPanel
      .getByRole("button", { name: "Enable selected", exact: true })
      .click();
    const confirmBulkEnable = bulkUsersPanel.locator(
      'button[data-action="admin-user-bulk-confirm"]',
    );
    await confirmBulkEnable.click();
    assert.equal(await confirmBulkEnable.isDisabled(), true);
    assert.equal(await confirmBulkEnable.locator(".spinner").count(), 1);
    await window
      .getByText("Selected users updated.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminBulkUserRequests),
      [{ action: "ENABLE", userIds: [2] }],
    );
    const unlockAlice = aliceRow.getByRole("button", {
      name: "Unlock user",
      exact: true,
    });
    await unlockAlice.click();
    assert.equal(await unlockAlice.isDisabled(), true);
    assert.equal(await unlockAlice.locator(".spinner").count(), 1);
    await window.getByText("User account unlocked.", { exact: true }).waitFor();
    assert.equal(
      await aliceRow.getByText("Locked", { exact: true }).count(),
      0,
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminUserUnlockRequests),
      [2],
    );
    await aliceRow
      .getByRole("button", { name: "Edit user", exact: true })
      .click();
    const userEditForm = aliceRow.locator('form[data-form="admin-user-edit"]');
    await userEditForm.locator('[name="firstName"]').fill("Invalid");
    const userEditSubmit = userEditForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await userEditSubmit.click();
    assert.equal(await userEditSubmit.isDisabled(), true);
    assert.equal(await userEditSubmit.locator(".spinner").count(), 1);
    await userEditForm
      .getByText("First name is invalid.", { exact: true })
      .waitFor();
    assert.equal(
      await userEditForm.locator('[name="firstName"]').inputValue(),
      "Invalid",
    );
    await userEditForm.locator('[name="firstName"]').fill("Alice Updated");
    await userEditSubmit.click();
    assert.equal(await userEditSubmit.isDisabled(), true);
    assert.equal(await userEditSubmit.locator(".spinner").count(), 1);
    await window.getByText("User updated.", { exact: true }).waitFor();
    const userUpdateRequests = await application.evaluate(
      () => globalThis.__adminUserUpdateRequests,
    );
    assert.equal(userUpdateRequests.length, 2);
    assert.equal(userUpdateRequests[1].id, 2);
    assert.equal(userUpdateRequests[1].body.firstName, "Alice Updated");
    assert.deepEqual(userUpdateRequests[1].body.roles, ["ROLE_USER"]);
    assert.equal(Object.hasOwn(userUpdateRequests[1].body, "password"), false);
    const openActionEmail = aliceRow.getByRole("button", {
      name: "Send action email",
      exact: true,
    });
    await openActionEmail.click();
    const actionEmailPanel = aliceRow.getByRole("region", {
      name: "Send action email",
    });
    const actionSelect = actionEmailPanel.locator('[name="action"]');
    const lifespanSelect = actionEmailPanel.locator('[name="lifespan"]');
    const sendActionEmail = actionEmailPanel.getByRole("button", {
      name: "Send action email",
      exact: true,
    });
    await actionSelect.selectOption("VERIFY_EMAIL");
    await lifespanSelect.selectOption("86400");
    await sendActionEmail.click();
    assert.equal(await sendActionEmail.isDisabled(), true);
    assert.equal(await sendActionEmail.locator(".spinner").count(), 1);
    await window
      .getByText("Required action email sent.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminActionEmailRequests),
      [{ id: 2, actions: ["VERIFY_EMAIL"], lifespan: "86400" }],
    );
    await openActionEmail.click();
    await actionEmailPanel.waitFor();
    await actionSelect.selectOption("UPDATE_PASSWORD");
    await lifespanSelect.selectOption("43200");
    await sendActionEmail.click();
    assert.equal(await sendActionEmail.isDisabled(), true);
    assert.equal(await sendActionEmail.locator(".spinner").count(), 1);
    await window
      .getByText("Required action email sent.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminActionEmailRequests),
      [
        { id: 2, actions: ["VERIFY_EMAIL"], lifespan: "86400" },
        { id: 2, actions: ["UPDATE_PASSWORD"], lifespan: "43200" },
      ],
    );
    assert.equal(
      await application.evaluate(() =>
        globalThis.__adminActionEmailRequests.some((entry) =>
          Object.hasOwn(entry, "email"),
        ),
      ),
      false,
    );
    const manageProfileAttributes = aliceRow.getByRole("button", {
      name: "Profile attributes",
      exact: true,
    });
    await manageProfileAttributes.click();
    assert.equal(await manageProfileAttributes.isDisabled(), true);
    assert.equal(await manageProfileAttributes.locator(".spinner").count(), 1);
    const profileAttributesPanel = aliceRow.getByRole("region", {
      name: "Profile attributes",
    });
    const departmentInput = profileAttributesPanel.locator(
      '[name="attribute-department"]',
    );
    const skillsInput = profileAttributesPanel.locator(
      '[name="attribute-skills"]',
    );
    await departmentInput.waitFor();
    assert.equal(await departmentInput.inputValue(), "Research");
    assert.equal(await skillsInput.inputValue(), "java");
    assert.equal(
      await profileAttributesPanel.getByText("Built-in first name").count(),
      0,
    );
    await departmentInput.fill("Rejected Department");
    const saveProfileAttributes = profileAttributesPanel.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await saveProfileAttributes.click();
    assert.equal(await saveProfileAttributes.isDisabled(), true);
    assert.equal(await saveProfileAttributes.locator(".spinner").count(), 1);
    await profileAttributesPanel
      .getByText("Choose another department.", { exact: true })
      .waitFor();
    assert.equal(await departmentInput.inputValue(), "Rejected Department");
    await departmentInput.fill("Engineering");
    await skillsInput.fill("typescript\nsecurity");
    await saveProfileAttributes.click();
    assert.equal(await saveProfileAttributes.isDisabled(), true);
    assert.equal(await saveProfileAttributes.locator(".spinner").count(), 1);
    await window
      .getByText("Profile attributes updated.", { exact: true })
      .waitFor();
    const profileAttributeWrites = await application.evaluate(
      () => globalThis.__adminProfileAttributeWrites,
    );
    assert.deepEqual(
      profileAttributeWrites.map(
        ({
          id,
          names,
          departmentCount,
          departmentLength,
          skillsCount,
          skillsLength,
        }) => ({
          id,
          names,
          departmentCount,
          departmentLength,
          skillsCount,
          skillsLength,
        }),
      ),
      [
        {
          id: 2,
          names: ["department", "skills"],
          departmentCount: 1,
          departmentLength: "Rejected Department".length,
          skillsCount: 1,
          skillsLength: 4,
        },
        {
          id: 2,
          names: ["department", "skills"],
          departmentCount: 1,
          departmentLength: "Engineering".length,
          skillsCount: 2,
          skillsLength: 18,
        },
      ],
    );
    assert.equal(
      profileAttributeWrites.some((entry) =>
        Object.hasOwn(entry, "attributes"),
      ),
      false,
    );
    await profileAttributesPanel
      .locator('button[data-action="admin-user-profile-attributes-close"]')
      .click();
    const avatarToggle = aliceRow.getByRole("button", {
      name: "User avatar",
      exact: true,
    });
    await avatarToggle.click();
    const avatarPanel = aliceRow.locator(
      'section.card:has([data-admin-avatar-file="2"])',
    );
    await avatarPanel.waitFor();
    const uploadAvatar = avatarPanel.locator(
      'button[data-action="admin-user-avatar-upload"]',
    );
    const avatarFile = avatarPanel.locator('input[type="file"]');
    await avatarFile.setInputFiles({
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    await uploadAvatar.click();
    const avatarValidation = avatarPanel.locator('[role="alert"]');
    await avatarValidation.waitFor();
    assert.equal(
      await avatarValidation.innerText(),
      "Choose a JPEG or PNG image up to 2 MiB and 4 megapixels.",
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminAvatarWrites ?? []),
      [],
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    if ((await avatarPanel.count()) === 0) {
      await aliceRow
        .locator('button[data-action="admin-user-avatar-toggle"]')
        .click();
      await avatarPanel.waitFor();
    }
    await avatarFile.setInputFiles({
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    await uploadAvatar.click();
    await avatarValidation.waitFor();
    assert.equal(
      await avatarValidation.innerText(),
      "En fazla 2 MiB ve 4 megapiksel JPEG veya PNG seçin.",
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminAvatarWrites ?? []),
      [],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await avatarPanel.locator('input[type="file"]').setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: onePixelPng(),
    });
    await uploadAvatar.click();
    assert.equal(await uploadAvatar.isDisabled(), true);
    assert.equal(await uploadAvatar.locator(".spinner").count(), 1);
    await window.waitForFunction(() => {
      const upload = document.querySelector(
        'button[data-action="admin-user-avatar-upload"]',
      );
      return upload && !upload.disabled;
    });
    const avatarStatus = {
      panel: await avatarPanel.innerText(),
      alerts: await window.locator('[role="alert"]').allTextContents(),
      writes: await application.evaluate(
        () => globalThis.__adminAvatarWrites ?? [],
      ),
    };
    assert.equal(
      await window.getByText("Avatar updated.", { exact: true }).count(),
      1,
      JSON.stringify(avatarStatus),
    );
    await window.getByText("Avatar updated.", { exact: true }).waitFor();
    assert.equal(
      await avatarPanel.locator("img").getAttribute("src"),
      "http://127.0.0.1:9090/avatars/00000000-0000-4000-8000-000000000007?v=1",
    );
    const requestAvatarDelete = avatarPanel.locator(
      'button[data-action="admin-user-avatar-delete-request"]',
    );
    await requestAvatarDelete.click();
    await avatarPanel.getByRole("status").waitFor();
    const confirmAvatarDelete = avatarPanel.locator(
      'button[data-action="admin-user-avatar-delete-confirm"]',
    );
    await confirmAvatarDelete.click();
    assert.equal(await confirmAvatarDelete.isDisabled(), true);
    assert.equal(await confirmAvatarDelete.locator(".spinner").count(), 1);
    await window.getByText("Avatar removed.", { exact: true }).waitFor();
    assert.equal(await avatarPanel.locator("img").count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminAvatarWrites),
      [{ userId: 2, contentType: "image/png", size: 70 }],
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminAvatarDeletes),
      [2],
    );
    await avatarPanel
      .locator('button[data-action="admin-user-avatar-close"]')
      .click();
    await aliceRow
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    const passwordResetForm = aliceRow.locator(
      'form[data-form="admin-user-password-reset"]',
    );
    const passwordResetInput = passwordResetForm.locator('[name="password"]');
    await passwordResetInput.fill("Rejected-password12!");
    const passwordResetSubmit = passwordResetForm.getByRole("button", {
      name: "Set password",
      exact: true,
    });
    await passwordResetSubmit.click();
    assert.equal(await passwordResetSubmit.isDisabled(), true);
    assert.equal(await passwordResetSubmit.locator(".spinner").count(), 1);
    await passwordResetForm
      .getByText("Choose a different password.", { exact: true })
      .waitFor();
    assert.equal(await passwordResetInput.inputValue(), "");
    await passwordResetInput.fill("Strong-password12!");
    await passwordResetForm.locator('[name="temporary"]').check();
    await passwordResetSubmit.click();
    assert.equal(await passwordResetSubmit.isDisabled(), true);
    assert.equal(await passwordResetSubmit.locator(".spinner").count(), 1);
    await window.getByText("User password reset.", { exact: true }).waitFor();
    assert.equal(
      await aliceRow
        .locator('form[data-form="admin-user-password-reset"]')
        .count(),
      0,
    );
    const passwordResetRequests = await application.evaluate(
      () => globalThis.__adminPasswordResetRequests,
    );
    assert.equal(passwordResetRequests.length, 2);
    assert.deepEqual(
      passwordResetRequests.map(({ id, temporary }) => ({ id, temporary })),
      [
        { id: 2, temporary: false },
        { id: 2, temporary: true },
      ],
    );
    assert.equal(
      passwordResetRequests.some((entry) => Object.hasOwn(entry, "password")),
      false,
    );
    const managePasskeys = aliceRow.getByRole("button", {
      name: "Manage passkeys",
      exact: true,
    });
    await managePasskeys.click();
    assert.equal(await managePasskeys.isDisabled(), true);
    assert.equal(await managePasskeys.locator(".spinner").count(), 1);
    const passkeysPanel = aliceRow.getByRole("region", {
      name: "Manage passkeys",
    });
    await passkeysPanel
      .getByText("Office security key", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminPasskeyListRequests),
      [2],
    );
    await passkeysPanel
      .getByRole("button", { name: "Rename passkey", exact: true })
      .click();
    const passkeyRenameForm = passkeysPanel.locator(
      'form[data-form="admin-user-passkey-rename"]',
    );
    const passkeyLabelInput = passkeyRenameForm.locator('[name="label"]');
    const renamePasskeySubmit = passkeyRenameForm.getByRole("button", {
      name: "Rename passkey",
      exact: true,
    });
    await passkeyLabelInput.fill("Rejected label");
    await renamePasskeySubmit.click();
    assert.equal(await renamePasskeySubmit.isDisabled(), true);
    assert.equal(await renamePasskeySubmit.locator(".spinner").count(), 1);
    await passkeyRenameForm
      .getByText("Choose another label.", { exact: true })
      .waitFor();
    assert.equal(await passkeyLabelInput.inputValue(), "Rejected label");
    await passkeyLabelInput.fill("Workstation key");
    await renamePasskeySubmit.click();
    assert.equal(await renamePasskeySubmit.isDisabled(), true);
    assert.equal(await renamePasskeySubmit.locator(".spinner").count(), 1);
    await window.getByText("Passkey label updated.", { exact: true }).waitFor();
    await passkeysPanel.getByText("Workstation key", { exact: true }).waitFor();
    const deletePasskey = passkeysPanel.getByRole("button", {
      name: "Delete passkey",
      exact: true,
    });
    await deletePasskey.click();
    await passkeysPanel
      .getByText(
        "Delete this passkey? The user will no longer be able to sign in with it.",
        { exact: true },
      )
      .waitFor();
    await passkeysPanel
      .locator('button[data-action="admin-user-passkey-delete-cancel"]')
      .click();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminPasskeyMutations),
      [
        {
          method: "PUT",
          userId: 2,
          credentialRouteValid: true,
          label: "Rejected label",
        },
        {
          method: "PUT",
          userId: 2,
          credentialRouteValid: true,
          label: "Workstation key",
        },
      ],
    );
    await passkeysPanel
      .getByRole("button", { name: "Delete passkey", exact: true })
      .click();
    const confirmPasskeyDelete = passkeysPanel.getByRole("button", {
      name: "Delete passkey",
      exact: true,
    });
    await confirmPasskeyDelete.click();
    assert.equal(await confirmPasskeyDelete.isDisabled(), true);
    assert.equal(await confirmPasskeyDelete.locator(".spinner").count(), 1);
    await window.getByText("Passkey deleted.", { exact: true }).waitFor();
    await passkeysPanel
      .getByRole("status")
      .getByText("No passkeys are registered for this user.")
      .waitFor();
    const passkeyMutations = await application.evaluate(
      () => globalThis.__adminPasskeyMutations,
    );
    assert.deepEqual(passkeyMutations.at(-1), {
      method: "DELETE",
      userId: 2,
      credentialRouteValid: true,
    });
    assert.equal(
      passkeyMutations.some((entry) => Object.hasOwn(entry, "credentialId")),
      false,
    );
    await passkeysPanel
      .locator('button[data-action="admin-user-passkeys-close"]')
      .click();
    const resetAuthenticator = aliceRow.getByRole("button", {
      name: "Reset authenticator",
      exact: true,
    });
    await resetAuthenticator.click();
    await aliceRow
      .getByText(
        "Remove this user's authenticator? They will need to set it up again.",
        { exact: true },
      )
      .waitFor();
    await aliceRow.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminTotpResetRequests ?? [],
      ),
      [],
    );
    await languageToggle.click();
    const resetAuthenticatorTurkish = aliceRow.getByRole("button", {
      name: "Kimlik doğrulayıcıyı sıfırla",
      exact: true,
    });
    await resetAuthenticatorTurkish.click();
    await aliceRow
      .getByText(
        "Bu kullanıcının kimlik doğrulayıcısı kaldırılsın mı? Yeniden kurması gerekir.",
        { exact: true },
      )
      .waitFor();
    await aliceRow.getByRole("button", { name: "Vazgeç", exact: true }).click();
    await window
      .getByRole("button", { name: "İngilizce", exact: true })
      .click();
    await aliceRow
      .getByRole("button", { name: "Reset authenticator", exact: true })
      .click();
    const confirmAuthenticatorReset = aliceRow.getByRole("button", {
      name: "Reset authenticator",
      exact: true,
    });
    await confirmAuthenticatorReset.click();
    assert.equal(await confirmAuthenticatorReset.isDisabled(), true);
    assert.equal(
      await confirmAuthenticatorReset.locator(".spinner").count(),
      1,
    );
    await window
      .getByText("User authenticator reset.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminTotpResetRequests),
      [2],
    );
    await aliceRow
      .getByRole("button", { name: "Disable user", exact: true })
      .click();
    await aliceRow
      .getByText("Disable this user account? Active sessions will end.", {
        exact: true,
      })
      .waitFor();
    await aliceRow.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminUserEnabledRequests ?? [],
      ),
      [],
    );
    await aliceRow
      .getByRole("button", { name: "Disable user", exact: true })
      .click();
    const disableAlice = aliceRow.getByRole("button", {
      name: "Disable user",
      exact: true,
    });
    await disableAlice.click();
    assert.equal(await disableAlice.isDisabled(), true);
    assert.equal(await disableAlice.locator(".spinner").count(), 1);
    await window
      .getByText("User account status updated.", { exact: true })
      .waitFor();
    await aliceRow.getByText("Disabled", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminUserEnabledRequests),
      [{ id: 2, enabled: false }],
    );
    await aliceRow
      .getByRole("button", { name: "Delete user", exact: true })
      .click();
    await aliceRow
      .getByText(
        "Delete this user? Their sessions and authorizations will be revoked.",
        { exact: true },
      )
      .waitFor();
    await aliceRow.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminUserDeleteRequests ?? [],
      ),
      [],
    );
    await aliceRow
      .getByRole("button", { name: "Delete user", exact: true })
      .click();
    const confirmUserDelete = aliceRow.getByRole("button", {
      name: "Delete user",
      exact: true,
    });
    await confirmUserDelete.click();
    assert.equal(await confirmUserDelete.isDisabled(), true);
    assert.equal(await confirmUserDelete.locator(".spinner").count(), 1);
    await window.getByText("User deleted.", { exact: true }).waitFor();
    assert.equal(await aliceRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminUserDeleteRequests),
      [2],
    );
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
    await userCreateForm
      .locator('[data-profile-attribute="department"]')
      .fill("Operations");
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
    await userCreateForm
      .locator('[data-profile-attribute="department"]')
      .fill("Rejected Department");
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
    await window
      .getByText(
        "Kullanıcı oluşturuldu ancak profil özellikleri kaydedilemedi. Aşağıdan profil kaydını yeniden deneyin.",
        { exact: true },
      )
      .waitFor();
    const createProfileRecovery = window.locator(
      'form[data-form="admin-user-create"][data-created-user-id="99"]',
    );
    const retryProfileSave = createProfileRecovery.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    assert.equal(await retryProfileSave.isEnabled(), true);
    await createProfileRecovery
      .locator('[data-profile-attribute="department"]')
      .fill("Operations");
    await retryProfileSave.click();
    assert.equal(await retryProfileSave.isDisabled(), true);
    assert.equal(await retryProfileSave.locator(".spinner").count(), 1);
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
    assert.deepEqual(
      await application.evaluate(() =>
        (globalThis.__adminProfileAttributeWrites ?? []).filter(
          (entry) => entry.id === 99,
        ),
      ),
      [
        {
          id: 99,
          names: ["department"],
          departmentCount: 1,
          departmentLength: "Rejected Department".length,
          skillsCount: 0,
          skillsLength: 0,
        },
        {
          id: 99,
          names: ["department"],
          departmentCount: 1,
          departmentLength: 10,
          skillsCount: 0,
          skillsLength: 0,
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
    await roleEditForm.getByLabel("Açıklama").waitFor();
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
    await application.evaluate(async () => {
      const expected = "Kitezh — güvenli kimlik konsolu";
      const deadline = Date.now() + 1000;
      while (globalThis.__trayTooltips.at(-1) !== expected) {
        if (Date.now() >= deadline)
          throw new Error("Turkish tray label did not update");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });
    assert.equal(await window.getByText("ROLE_NATIVE_VIEWER").count(), 1);
    assert.equal(
      await application.evaluate(() => globalThis.__trayTooltips.at(-1)),
      "Kitezh — güvenli kimlik konsolu",
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Search roles" }).waitFor();
    await application.evaluate(async () => {
      const expected = "Kitezh — secure identity console";
      const deadline = Date.now() + 1000;
      while (globalThis.__trayTooltips.at(-1) !== expected) {
        if (Date.now() >= deadline)
          throw new Error("English tray label did not update");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });
    assert.equal(
      await application.evaluate(() => globalThis.__trayTooltips.at(-1)),
      "Kitezh — secure identity console",
    );
    const createdRoleRow = window.locator(
      '[data-role-name="ROLE_NATIVE_VIEWER"]',
    );
    await createdRoleRow
      .getByRole("button", { name: "Delete role", exact: true })
      .click();
    await createdRoleRow
      .getByText(
        "Delete this role? Protected roles and roles assigned to users cannot be deleted.",
        { exact: true },
      )
      .waitFor();
    await createdRoleRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminRoleDeleteRequests ?? [],
      ),
      [],
    );
    await createdRoleRow
      .getByRole("button", { name: "Delete role", exact: true })
      .click();
    const confirmRoleDelete = createdRoleRow.getByRole("button", {
      name: "Delete role",
      exact: true,
    });
    await confirmRoleDelete.click();
    assert.equal(await confirmRoleDelete.isDisabled(), true);
    assert.equal(await confirmRoleDelete.locator(".spinner").count(), 1);
    await window.getByText("Role deleted.", { exact: true }).waitFor();
    assert.equal(await createdRoleRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminRoleDeleteRequests),
      ["ROLE_NATIVE_VIEWER"],
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
    const parentGroupRow = window.locator('[data-group-id="1"]');
    await parentGroupRow
      .getByRole("button", { name: "Create child group", exact: true })
      .click();
    const childGroupForm = parentGroupRow.locator(
      'form[data-form="admin-group-child-create"]',
    );
    await childGroupForm.locator('[name="name"]').fill("regional");
    await window.getByRole("button", { name: "Turkish" }).click();
    await childGroupForm
      .getByRole("heading", { name: /Alt grup oluştur/ })
      .waitFor();
    assert.equal(
      await childGroupForm.locator('[name="name"]').inputValue(),
      "regional",
    );
    const createChildGroup = childGroupForm.getByRole("button", {
      name: "Alt grup oluştur",
      exact: true,
    });
    await createChildGroup.click();
    assert.equal(await createChildGroup.isDisabled(), true);
    assert.equal(await createChildGroup.locator(".spinner").count(), 1);
    await window.getByText("Alt grup oluşturuldu.", { exact: true }).waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Search groups" }).waitFor();
    await window
      .getByText("Organization / finance / regional", { exact: true })
      .waitFor();
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
        {
          name: "regional",
          parentId: 1,
          attributes: {},
          defaultGroup: false,
        },
      ],
    );
    const groupPermissionsToggle = parentGroupRow.getByRole("button", {
      name: "Manage permissions",
      exact: true,
    });
    await groupPermissionsToggle.click();
    assert.equal(await groupPermissionsToggle.isDisabled(), true);
    assert.equal(await groupPermissionsToggle.locator(".spinner").count(), 1);
    const groupPermissionsForm = parentGroupRow.locator(
      'form[data-form="admin-group-permissions"]',
    );
    await groupPermissionsForm
      .getByRole("heading", { name: "Group permissions", exact: true })
      .waitFor();
    await groupPermissionsForm
      .locator('[data-group-permission-index="0"] [name="permission"]')
      .selectOption("MANAGE_MEMBERS");
    await groupPermissionsForm.locator('[name="newUserId"]').selectOption("1");
    await groupPermissionsForm
      .locator('[name="newPermission"]')
      .selectOption("MANAGE_GROUP");
    await groupPermissionsForm
      .getByRole("button", { name: "Add permission", exact: true })
      .click();
    assert.equal(
      await groupPermissionsForm
        .locator("[data-group-permission-index]")
        .count(),
      2,
    );
    await window.getByRole("button", { name: "Turkish", exact: true }).click();
    await groupPermissionsForm
      .getByRole("heading", { name: "Grup izinleri", exact: true })
      .waitFor();
    assert.equal(
      await groupPermissionsForm
        .locator('[data-group-permission-index="0"] [name="permission"]')
        .inputValue(),
      "MANAGE_MEMBERS",
    );
    const saveGroupPermissions = groupPermissionsForm.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    await saveGroupPermissions.click();
    assert.equal(await saveGroupPermissions.isDisabled(), true);
    assert.equal(await saveGroupPermissions.locator(".spinner").count(), 1);
    await window
      .getByText("Grup izinleri güncellendi.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminGroupPermissionRequests,
      ),
      [
        {
          id: 1,
          body: {
            permissions: [
              { userId: 2, permission: "MANAGE_MEMBERS" },
              { userId: 1, permission: "MANAGE_GROUP" },
            ],
          },
        },
      ],
    );
    await window
      .getByRole("button", { name: "İngilizce", exact: true })
      .click();
    await window.getByRole("button", { name: "Search groups" }).waitFor();
    await groupPermissionsForm
      .locator('[data-group-permission-index="1"]')
      .getByRole("button", { name: "Remove permission", exact: true })
      .click();
    assert.equal(
      await groupPermissionsForm
        .locator("[data-group-permission-index]")
        .count(),
      1,
    );
    const saveGroupPermissionsEnglish = groupPermissionsForm.getByRole(
      "button",
      { name: "Save", exact: true },
    );
    await saveGroupPermissionsEnglish.click();
    assert.equal(await saveGroupPermissionsEnglish.isDisabled(), true);
    assert.equal(
      await saveGroupPermissionsEnglish.locator(".spinner").count(),
      1,
    );
    await window
      .getByText("Group permissions updated.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminGroupPermissionRequests,
      ),
      [
        {
          id: 1,
          body: {
            permissions: [
              { userId: 2, permission: "MANAGE_MEMBERS" },
              { userId: 1, permission: "MANAGE_GROUP" },
            ],
          },
        },
        {
          id: 1,
          body: {
            permissions: [{ userId: 2, permission: "MANAGE_MEMBERS" }],
          },
        },
      ],
    );
    const createdGroupRow = window.locator('[data-group-id="99"]');
    await createdGroupRow
      .getByRole("button", { name: "Edit group name", exact: true })
      .click();
    const groupNameForm = createdGroupRow.locator(
      'form[data-form="admin-group-rename"]',
    );
    await groupNameForm
      .locator('[name="name"]')
      .fill("native-operators-renamed");
    const saveGroupName = groupNameForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await saveGroupName.click();
    assert.equal(await saveGroupName.isDisabled(), true);
    assert.equal(await saveGroupName.locator(".spinner").count(), 1);
    await window.getByText("Group name updated.", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminGroupRenameRequests),
      [{ id: 99, body: { name: "native-operators-renamed" } }],
    );
    await createdGroupRow
      .getByRole("button", { name: "Edit group roles", exact: true })
      .click();
    const groupRolesForm = createdGroupRow.locator(
      'form[data-form="admin-group-roles"]',
    );
    await groupRolesForm
      .locator('[name="roles"][value="ROLE_USER_VIEWER"]')
      .check();
    const saveGroupRoles = groupRolesForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await saveGroupRoles.click();
    assert.equal(await saveGroupRoles.isDisabled(), true);
    assert.equal(await saveGroupRoles.locator(".spinner").count(), 1);
    await window.getByText("Group roles updated.", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminGroupRoleRequests),
      [{ id: 99, body: { roles: ["ROLE_USER_VIEWER"] } }],
    );
    await createdGroupRow
      .getByRole("button", { name: "Manage members", exact: true })
      .click();
    await createdGroupRow.getByText("native-member", { exact: true }).waitFor();
    const addGroupMember = createdGroupRow.getByRole("button", {
      name: "Add to group",
      exact: true,
    });
    assert.equal(
      await addGroupMember.locator(".button-icon").textContent(),
      "+",
    );
    assert.equal(
      await addGroupMember.locator(".button-icon").getAttribute("aria-hidden"),
      "true",
    );
    await addGroupMember.click();
    assert.equal(await addGroupMember.isDisabled(), true);
    assert.equal(await addGroupMember.locator(".spinner").count(), 1);
    await window.getByText("User added to group.", { exact: true }).waitFor();
    await window.getByRole("button", { name: "Turkish", exact: true }).click();
    await window
      .getByRole("button", { name: "Gruptan çıkar", exact: true })
      .waitFor();
    const requestRemoveMember = createdGroupRow.getByRole("button", {
      name: "Gruptan çıkar",
      exact: true,
    });
    assert.equal(
      await requestRemoveMember.locator(".button-icon").textContent(),
      "×",
    );
    assert.equal(
      await requestRemoveMember
        .locator(".button-icon")
        .getAttribute("aria-hidden"),
      "true",
    );
    await requestRemoveMember.click();
    await createdGroupRow
      .getByText("Bu kullanıcı gruptan çıkarılsın mı? Erişimi güncellenecek.", {
        exact: true,
      })
      .waitFor();
    await createdGroupRow
      .getByRole("button", { name: "Vazgeç", exact: true })
      .click();
    assert.equal(
      (
        await application.evaluate(() => globalThis.__adminGroupMemberRequests)
      ).filter((item) => item.method === "DELETE").length,
      0,
    );
    await createdGroupRow
      .getByRole("button", { name: "Gruptan çıkar", exact: true })
      .click();
    const confirmRemoveMember = createdGroupRow.getByRole("button", {
      name: "Gruptan çıkar",
      exact: true,
    });
    await confirmRemoveMember.click();
    assert.equal(await confirmRemoveMember.isDisabled(), true);
    assert.equal(await confirmRemoveMember.locator(".spinner").count(), 1);
    await window
      .getByText("Kullanıcı gruptan çıkarıldı.", { exact: true })
      .waitFor();
    assert.equal(
      (
        await application.evaluate(() => globalThis.__adminGroupMemberRequests)
      ).filter((item) => item.method === "DELETE").length,
      1,
    );
    await window
      .getByRole("button", { name: "İngilizce", exact: true })
      .click();
    await window
      .getByRole("button", { name: "Search groups", exact: true })
      .waitFor();
    await createdGroupRow
      .getByRole("button", { name: "Delete group", exact: true })
      .click();
    await createdGroupRow
      .getByText(
        "Delete this group? Its members will be removed and their access revoked. Groups with child groups cannot be deleted.",
        { exact: true },
      )
      .waitFor();
    await createdGroupRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminGroupDeleteRequests ?? [],
      ),
      [],
    );
    await createdGroupRow
      .getByRole("button", { name: "Delete group", exact: true })
      .click();
    const confirmGroupDelete = createdGroupRow.getByRole("button", {
      name: "Delete group",
      exact: true,
    });
    await confirmGroupDelete.click();
    assert.equal(await confirmGroupDelete.isDisabled(), true);
    assert.equal(await confirmGroupDelete.locator(".spinner").count(), 1);
    await window.getByText("Group deleted.", { exact: true }).waitFor();
    assert.equal(await createdGroupRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminGroupDeleteRequests),
      [99],
    );
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
    const createdScopeRow = window.locator(
      '[data-client-scope-id="scope-native-observer"]',
    );
    const manageScopeRoles = createdScopeRow.getByRole("button", {
      name: "Rol eşlemelerini yönet",
      exact: true,
    });
    await manageScopeRoles.click();
    assert.equal(await manageScopeRoles.isDisabled(), true);
    assert.equal(await manageScopeRoles.locator(".spinner").count(), 1);
    const roleMappingsPanel = createdScopeRow.locator(
      "[data-client-scope-role-mappings-panel]",
    );
    await roleMappingsPanel
      .getByRole("heading", { name: "Bu kapsamın rol eşlemeleri" })
      .waitFor();
    const applicationRoleSearch = roleMappingsPanel.getByRole("searchbox", {
      name: "Uygulama rolleri ara",
    });
    await applicationRoleSearch.fill("SCOPE");
    const searchRoleCandidates = roleMappingsPanel
      .getByRole("button", {
        name: "Ara",
        exact: true,
      })
      .first();
    await searchRoleCandidates.click();
    assert.equal(await searchRoleCandidates.isDisabled(), true);
    assert.equal(await searchRoleCandidates.locator(".spinner").count(), 1);
    await window.waitForFunction(() => {
      const button = document.querySelector(
        'form[data-form="admin-client-scope-role-candidate-search"][data-role-kind="applicationRoles"] button[type="submit"]',
      );
      return button && !button.disabled;
    });
    const scopeReaderRole = roleMappingsPanel.getByRole("checkbox", {
      name: /ROLE_SCOPE_READER/,
    });
    await scopeReaderRole.check();
    assert.equal(await scopeReaderRole.isChecked(), true);
    const adminClientRole = roleMappingsPanel.getByRole("checkbox", {
      name: /admin-console · manage_users/,
    });
    await adminClientRole.check();
    assert.equal(await adminClientRole.isChecked(), true);
    assert.deepEqual(
      await roleMappingsPanel.evaluate((panel) => ({
        applicationRoles: [
          ...panel.querySelectorAll('input[name="applicationRoles"]:checked'),
        ].map((input) => input.value),
        clientRoleIds: [
          ...panel.querySelectorAll('input[name="clientRoleIds"]:checked'),
        ].map((input) => input.value),
      })),
      {
        applicationRoles: ["ROLE_SCOPE_READER", "ROLE_USER"],
        clientRoleIds: ["21", "11"],
      },
    );
    const saveRoleMappings = roleMappingsPanel.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    await saveRoleMappings.click();
    assert.equal(await saveRoleMappings.isDisabled(), true);
    assert.equal(await saveRoleMappings.locator(".spinner").count(), 1);
    await saveRoleMappings.evaluate((button) =>
      button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await window
      .getByText("İstemci kapsamı rol eşlemeleri güncellendi.", {
        exact: true,
      })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__clientScopeRoleMappingRequests,
      ),
      [
        {
          id: "scope-native-observer",
          body: {
            applicationRoles: ["ROLE_SCOPE_READER", "ROLE_USER"],
            clientRoleIds: [11, 21],
          },
        },
      ],
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    const saveRoleMappingsInEnglish = roleMappingsPanel.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await saveRoleMappingsInEnglish.waitFor();
    await saveRoleMappingsInEnglish.click();
    assert.equal(await saveRoleMappingsInEnglish.isDisabled(), true);
    assert.equal(
      await saveRoleMappingsInEnglish.locator(".spinner").count(),
      1,
    );
    await saveRoleMappingsInEnglish.evaluate((button) =>
      button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await window
      .getByText("Client scope role mappings updated.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__clientScopeRoleMappingRequests,
      ),
      [
        {
          id: "scope-native-observer",
          body: {
            applicationRoles: ["ROLE_SCOPE_READER", "ROLE_USER"],
            clientRoleIds: [11, 21],
          },
        },
        {
          id: "scope-native-observer",
          body: {
            applicationRoles: ["ROLE_SCOPE_READER", "ROLE_USER"],
            clientRoleIds: [11, 21],
          },
        },
      ],
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await roleMappingsPanel.getByRole("button", { name: "Kaydet" }).waitFor();
    const roleCandidateRequests = await application.evaluate(
      () => globalThis.__clientScopeRoleCandidateRequests,
    );
    assert.equal(
      roleCandidateRequests.some(
        ({ path, query }) =>
          path.endsWith("/application-roles") &&
          query.q === "SCOPE" &&
          query.size === "20" &&
          query.sort === "name,asc",
      ),
      true,
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
    await createdScopeRow
      .getByRole("button", { name: "İstemci kapsamını sil", exact: true })
      .click();
    await createdScopeRow
      .getByText(
        "Bu istemci kapsamı silinsin mi? Atanmış kapsamlar silinemez.",
        { exact: true },
      )
      .waitFor();
    await createdScopeRow
      .locator('[data-action="admin-client-scope-delete-cancel"]')
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientScopeDeleteRequests ?? [],
      ),
      [],
    );
    await createdScopeRow
      .getByRole("button", { name: "İstemci kapsamını sil", exact: true })
      .click();
    const confirmClientScopeDelete = createdScopeRow.getByRole("button", {
      name: "İstemci kapsamını sil",
      exact: true,
    });
    await confirmClientScopeDelete.click();
    assert.equal(await confirmClientScopeDelete.isDisabled(), true);
    assert.equal(await confirmClientScopeDelete.locator(".spinner").count(), 1);
    await window
      .getByText("İstemci kapsamı silindi.", { exact: true })
      .waitFor();
    assert.equal(await createdScopeRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientScopeDeleteRequests,
      ),
      ["scope-native-observer"],
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
    await window
      .getByRole("button", { name: "Create client", exact: true })
      .click();
    const createClientForm = window.locator(
      'form[data-form="admin-client-create"]',
    );
    await createClientForm.waitFor();
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    const offlineCreateClient = createClientForm.getByRole("button", {
      name: "Create client",
      exact: true,
    });
    assert.equal(await offlineCreateClient.isDisabled(), true);
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientCreateRequests ?? [],
      ),
      [],
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await createClientForm
      .locator('[name="clientId"]')
      .fill("native-e2e-client");
    await createClientForm
      .locator('[name="clientName"]')
      .fill("Native E2E Client");
    await createClientForm
      .locator('[name="redirectUris"]')
      .fill("not an absolute URI");
    await createClientForm
      .getByRole("button", { name: "Create client", exact: true })
      .click();
    await window
      .getByText("Enter absolute URIs without fragments.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientCreateRequests ?? [],
      ),
      [],
    );
    const redirectUris = createClientForm.locator('[name="redirectUris"]');
    await redirectUris.fill("https://native-client.example/callback");
    const createClient = createClientForm.getByRole("button", {
      name: "Create client",
      exact: true,
    });
    await createClient.click();
    assert.equal(await createClient.isDisabled(), true);
    assert.equal(await createClient.locator(".spinner").count(), 1);
    await createClient.dispatchEvent("click");
    await window
      .getByRole("heading", { name: "Client secret (shown once)" })
      .waitFor();
    assert.equal(
      await window.locator('[data-one-time-client-secret="true"]').innerText(),
      "ONE_TIME_CLIENT_SECRET_SENTINEL",
    );
    const clientCreateRequests = await application.evaluate(
      () => globalThis.__adminClientCreateRequests,
    );
    assert.equal(clientCreateRequests.length, 1);
    assert.deepEqual(clientCreateRequests[0].clientAuthenticationMethods, [
      "client_secret_basic",
    ]);
    assert.deepEqual(clientCreateRequests[0].authorizationGrantTypes, [
      "authorization_code",
      "refresh_token",
    ]);
    assert.deepEqual(clientCreateRequests[0].redirectUris, [
      "https://native-client.example/callback",
    ]);
    assert.equal(clientCreateRequests[0].requireProofKey, true);
    assert.equal("clientSecret" in clientCreateRequests[0], false);
    assert.equal(
      await window.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage]).includes(
          "ONE_TIME_CLIENT_SECRET_SENTINEL",
        ),
      ),
      false,
    );
    await window
      .getByRole("button", { name: "I saved the secret", exact: true })
      .click();
    assert.equal(
      await window.locator('[data-one-time-client-secret="true"]').count(),
      0,
    );
    const platformClientRow = window.locator('[data-client-id="client-1"]');
    assert.equal(
      await platformClientRow
        .getByRole("button", { name: "Delete client" })
        .count(),
      0,
    );
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
    const clientRow = window.locator('[data-client-id="client-1"]');
    const editClientConfiguration = clientRow.getByRole("button", {
      name: "Edit client configuration",
      exact: true,
    });
    await editClientConfiguration.click();
    assert.equal(await editClientConfiguration.isDisabled(), true);
    assert.equal(await editClientConfiguration.locator(".spinner").count(), 1);
    await editClientConfiguration.dispatchEvent("click");
    const clientConfigurationForm = clientRow.locator(
      'form[data-form="admin-client-configuration"]',
    );
    await clientConfigurationForm.waitFor();
    assert.equal(
      await window
        .getByText("private-service-account-name", { exact: true })
        .count(),
      0,
    );
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientConfigurationReadRequests,
      ),
      [true],
    );
    const clientConfigurationSave = clientConfigurationForm.getByRole(
      "button",
      { name: "Save", exact: true },
    );
    const configRedirectUris = clientConfigurationForm.locator(
      '[name="redirectUris"]',
    );
    await clientConfigurationForm
      .locator('[name="rootUrl"]')
      .fill("https://offline.example");
    await clientConfigurationForm
      .locator('[name="cibaClientNotificationToken"]')
      .fill("SENSITIVE_NATIVE_CIBA_TOKEN");
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    assert.equal(await clientConfigurationSave.isDisabled(), true);
    assert.equal(
      await clientConfigurationForm.locator('[name="rootUrl"]').inputValue(),
      "https://offline.example",
    );
    assert.equal(
      await clientConfigurationForm
        .locator('[name="cibaClientNotificationToken"]')
        .inputValue(),
      "",
    );
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientConfigurationRequests ?? [],
      ),
      [],
    );
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await clientConfigurationSave.waitFor({ state: "visible" });
    assert.equal(await clientConfigurationSave.isEnabled(), true);
    await configRedirectUris.fill("not an absolute URI");
    await clientConfigurationSave.click();
    await clientConfigurationForm
      .getByText("Enter absolute URIs without fragments.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientConfigurationRequests ?? [],
      ),
      [],
    );
    await configRedirectUris.fill("https://updated.example/callback");
    await clientConfigurationForm
      .locator('[name="clientName"]')
      .fill("Rejected policy");
    await clientConfigurationForm
      .locator('[name="cibaClientNotificationToken"]')
      .fill("SENSITIVE_NATIVE_CIBA_TOKEN");
    await clientConfigurationSave.click();
    assert.equal(await clientConfigurationSave.isDisabled(), true);
    assert.equal(await clientConfigurationSave.locator(".spinner").count(), 1);
    await clientConfigurationForm
      .getByText("Choose another client name.", { exact: true })
      .waitFor();
    assert.equal(
      await clientConfigurationForm.locator('[name="clientName"]').inputValue(),
      "Rejected policy",
    );
    assert.equal(
      await clientConfigurationForm
        .locator('[name="cibaClientNotificationToken"]')
        .inputValue(),
      "",
    );
    await clientConfigurationForm
      .locator('[name="clientName"]')
      .fill("Native Config Client");
    await clientConfigurationForm
      .locator('[name="cibaClientNotificationToken"]')
      .fill("SENSITIVE_NATIVE_CIBA_TOKEN");
    await clientConfigurationSave.click();
    assert.equal(await clientConfigurationSave.isDisabled(), true);
    assert.equal(await clientConfigurationSave.locator(".spinner").count(), 1);
    await window
      .getByText("Client configuration updated.", { exact: true })
      .waitFor();
    const clientConfigurationRequests = await application.evaluate(
      () => globalThis.__adminClientConfigurationRequests,
    );
    assert.equal(clientConfigurationRequests.length, 2);
    assert.deepEqual(
      clientConfigurationRequests[1].body.clientAuthenticationMethods,
      ["none"],
    );
    assert.deepEqual(
      clientConfigurationRequests[1].body.authorizationGrantTypes,
      [
        "authorization_code",
        "refresh_token",
        "urn:openid:params:grant-type:ciba",
      ],
    );
    assert.deepEqual(clientConfigurationRequests[1].body.redirectUris, [
      "https://updated.example/callback",
    ]);
    assert.equal(clientConfigurationRequests[1].body.requireProofKey, true);
    assert.equal(
      clientConfigurationRequests[1].body.rootUrl,
      "https://offline.example",
    );
    assert.equal(clientConfigurationRequests[1].cibaTokenProvided, true);
    assert.equal(
      JSON.stringify(clientConfigurationRequests).includes(
        "SENSITIVE_NATIVE_CIBA_TOKEN",
      ),
      false,
    );
    assert.equal(
      await window.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage]).includes(
          "SENSITIVE_NATIVE_CIBA_TOKEN",
        ),
      ),
      false,
    );
    assert.equal(
      await window.locator('[name="cibaClientNotificationToken"]').count(),
      0,
    );
    await clientRow
      .getByRole("button", { name: "Edit client name", exact: true })
      .click();
    const clientMetadataForm = clientRow.locator(
      'form[data-form="admin-client-native-metadata"]',
    );
    await clientMetadataForm.waitFor();
    const clientName = clientMetadataForm.locator('[name="clientName"]');
    const saveClientName = clientMetadataForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await clientName.fill("Rejected client");
    await saveClientName.click();
    assert.equal(await saveClientName.isDisabled(), true);
    assert.equal(await saveClientName.locator(".spinner").count(), 1);
    await window
      .getByText("Choose another client name.", { exact: true })
      .waitFor();
    assert.equal(await clientName.inputValue(), "Rejected client");
    await clientName.fill("Reporting Client");
    await saveClientName.click();
    assert.equal(await saveClientName.isDisabled(), true);
    assert.equal(await saveClientName.locator(".spinner").count(), 1);
    await window.getByText("Client name updated.", { exact: true }).waitFor();
    assert.equal(await window.getByText("Reporting Client").count(), 1);
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__clientNativeMetadataRequests,
      ),
      [{ clientName: "Rejected client" }, { clientName: "Reporting Client" }],
    );
    const deleteClient = clientRow.getByRole("button", {
      name: "Delete client",
      exact: true,
    });
    await deleteClient.click();
    await clientRow
      .getByText(
        "Delete this client and its authorizations, consents, and service account? Platform console clients cannot be deleted.",
        { exact: true },
      )
      .waitFor();
    await clientRow.getByRole("button", { name: "Cancel" }).click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminClientDeleteRequests ?? [],
      ),
      [],
    );
    await clientRow
      .getByRole("button", { name: "Delete client", exact: true })
      .click();
    const confirmClientDelete = clientRow.getByRole("button", {
      name: "Delete client",
      exact: true,
    });
    await confirmClientDelete.click();
    assert.equal(await confirmClientDelete.isDisabled(), true);
    assert.equal(await confirmClientDelete.locator(".spinner").count(), 1);
    await window.getByText("Client deleted.", { exact: true }).waitFor();
    assert.equal(await clientRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminClientDeleteRequests),
      ["/api/admin/clients/client-1"],
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window
      .getByRole("button", { name: "İstemci oluştur", exact: true })
      .click();
    const publicClientForm = window.locator(
      'form[data-form="admin-client-create"]',
    );
    await publicClientForm.waitFor();
    await publicClientForm
      .locator('[name="clientId"]')
      .fill("native-e2e-public-client");
    await publicClientForm
      .locator('[name="clientName"]')
      .fill("Native E2E Public Client");
    await publicClientForm
      .locator('[name="authenticationMode"]')
      .selectOption("public");
    await publicClientForm
      .locator('[name="redirectUris"]')
      .fill("https://native-public.example/callback");
    await publicClientForm
      .getByRole("button", { name: "İstemci oluştur", exact: true })
      .click();
    await window.getByText("İstemci oluşturuldu.", { exact: true }).waitFor();
    assert.equal(
      await window.locator('[data-one-time-client-secret="true"]').count(),
      0,
    );
    const publicCreateRequest = await application.evaluate(
      () => globalThis.__adminClientCreateRequests[1],
    );
    assert.deepEqual(publicCreateRequest.clientAuthenticationMethods, ["none"]);
    assert.equal(publicCreateRequest.requireProofKey, true);
    await window.getByRole("button", { name: "İngilizce" }).click();
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
    const identityProviderRow = window.locator(
      '[data-identity-provider-id="provider-1"]',
    );
    await identityProviderRow
      .getByRole("button", { name: "Edit provider policy", exact: true })
      .click();
    const providerPolicyForm = identityProviderRow.locator(
      'form[data-form="admin-identity-provider-policy"]',
    );
    await providerPolicyForm.waitFor();
    await providerPolicyForm.getByLabel("Sync mode").waitFor();
    await providerPolicyForm
      .locator('[name="displayName"]')
      .fill("Rejected policy");
    await providerPolicyForm.locator('[name="mfaRequired"]').check();
    await providerPolicyForm
      .locator('[name="syncMode"]')
      .selectOption("read_only");
    const saveProviderPolicy = providerPolicyForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await saveProviderPolicy.click();
    assert.equal(await saveProviderPolicy.isDisabled(), true);
    assert.equal(await saveProviderPolicy.locator(".spinner").count(), 1);
    await window
      .getByText("Choose another provider name.", { exact: true })
      .waitFor();
    assert.equal(
      await providerPolicyForm.locator('[name="displayName"]').inputValue(),
      "Rejected policy",
    );
    await providerPolicyForm
      .locator('[name="displayName"]')
      .fill("Google Workspace");
    await saveProviderPolicy.click();
    assert.equal(await saveProviderPolicy.isDisabled(), true);
    assert.equal(await saveProviderPolicy.locator(".spinner").count(), 1);
    await window
      .getByText("Provider policy updated.", { exact: true })
      .waitFor();
    const policyRequests = await application.evaluate(
      () => globalThis.__adminProviderPolicyRequests,
    );
    assert.deepEqual(policyRequests, [
      {
        displayName: "Rejected policy",
        enabled: true,
        hideOnLogin: false,
        accountLinkingOnly: false,
        trustEmail: true,
        mfaRequired: true,
        guiOrder: 1,
        showInAccountConsole: "always",
        syncMode: "read_only",
      },
      {
        displayName: "Google Workspace",
        enabled: true,
        hideOnLogin: false,
        accountLinkingOnly: false,
        trustEmail: true,
        mfaRequired: true,
        guiOrder: 1,
        showInAccountConsole: "always",
        syncMode: "read_only",
      },
    ]);
    for (const unsafeField of [
      "clientSecret",
      "clientId",
      "authorizationUri",
      "samlIdpCertificate",
    ])
      assert.equal(Object.hasOwn(policyRequests[1], unsafeField), false);
    const manageMappers = identityProviderRow.getByRole("button", {
      name: "Manage mappers",
      exact: true,
    });
    await manageMappers.click();
    assert.equal(await manageMappers.isDisabled(), true);
    assert.equal(await manageMappers.locator(".spinner").count(), 1);
    const mapperRow = identityProviderRow.locator(
      '[data-provider-mapper-id="mapper-1"]',
    );
    await mapperRow.waitFor();
    const mapperSearchRequests = await application.evaluate(
      () => globalThis.__adminProviderMapperRequests,
    );
    assert.equal(
      new URLSearchParams(mapperSearchRequests[0]).get("size"),
      "20",
    );
    const addMapperButton = identityProviderRow.getByRole("button", {
      name: "Add mapper",
      exact: true,
    });
    assert.equal(
      await addMapperButton.locator(".button-icon").textContent(),
      "+",
    );
    await addMapperButton.click();
    const mapperCreateForm = identityProviderRow.locator(
      'form[data-form="admin-provider-mapper"]',
    );
    await mapperCreateForm.locator('[name="name"]').fill("display-name");
    await mapperCreateForm
      .locator('[name="sourceClaim"]')
      .fill("preferred_username");
    await mapperCreateForm.locator('[name="target"]').fill("displayName");
    await mapperCreateForm
      .locator('[name="mapperType"]')
      .selectOption("user-attribute");
    await mapperCreateForm.locator('[name="syncMode"]').selectOption("import");
    await mapperCreateForm.locator('[name="addToIdToken"]').check();
    const createMapperButton = mapperCreateForm.getByRole("button", {
      name: "Save",
      exact: true,
    });
    await createMapperButton.click();
    assert.equal(await createMapperButton.isDisabled(), true);
    assert.equal(await createMapperButton.locator(".spinner").count(), 1);
    await window
      .getByText("Provider mapper created.", { exact: true })
      .waitFor();
    const mapperCreateRequests = await application.evaluate(
      () => globalThis.__adminProviderMapperCreateRequests,
    );
    assert.deepEqual(mapperCreateRequests, [
      {
        name: "display-name",
        sourceClaim: "preferred_username",
        target: "displayName",
        mapperType: "user-attribute",
        syncMode: "import",
        addToIdToken: true,
        addToAccessToken: false,
      },
    ]);
    const createdMapperRow = identityProviderRow.locator(
      '[data-provider-mapper-id="mapper-2"]',
    );
    await createdMapperRow.waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    const existingMapperRow = identityProviderRow.locator(
      '[data-provider-mapper-id="mapper-1"]',
    );
    const editMapperButton = existingMapperRow.getByRole("button", {
      name: "Eşleyiciyi düzenle",
      exact: true,
    });
    assert.equal(
      await editMapperButton.locator(".button-icon").textContent(),
      "✎",
    );
    assert.equal(
      await editMapperButton
        .locator(".button-icon")
        .getAttribute("aria-hidden"),
      "true",
    );
    await editMapperButton.click();
    const mapperEditForm = identityProviderRow.locator(
      'form[data-form="admin-provider-mapper"]',
    );
    assert.equal(
      await mapperEditForm.count(),
      1,
      await identityProviderRow.innerText(),
    );
    const mapperTarget = mapperEditForm.locator('[name="target"]');
    await mapperTarget.fill("invalid target");
    const updateMapperButton = mapperEditForm.getByRole("button", {
      name: "Kaydet",
      exact: true,
    });
    await updateMapperButton.click();
    assert.equal(await updateMapperButton.isDisabled(), true);
    assert.equal(await updateMapperButton.locator(".spinner").count(), 1);
    await mapperEditForm
      .getByText("Hedef yolu geçersiz.", { exact: true })
      .waitFor();
    assert.equal(await mapperTarget.inputValue(), "invalid target");
    await mapperTarget.fill("profile.email");
    await updateMapperButton.click();
    assert.equal(await updateMapperButton.isDisabled(), true);
    assert.equal(await updateMapperButton.locator(".spinner").count(), 1);
    await window
      .getByText("Sağlayıcı eşleyicisi güncellendi.", { exact: true })
      .waitFor();
    const mapperUpdateRequests = await application.evaluate(
      () => globalThis.__adminProviderMapperUpdateRequests,
    );
    assert.deepEqual(mapperUpdateRequests, [
      {
        name: "email-mapper",
        sourceClaim: "email",
        target: "invalid target",
        mapperType: "user-attribute",
        syncMode: "import",
        addToIdToken: true,
        addToAccessToken: true,
      },
      {
        name: "email-mapper",
        sourceClaim: "email",
        target: "profile.email",
        mapperType: "user-attribute",
        syncMode: "import",
        addToIdToken: true,
        addToAccessToken: true,
      },
    ]);
    await window.getByRole("button", { name: "İngilizce" }).click();
    const requestMapperDelete = mapperRow.getByRole("button", {
      name: "Delete mapper",
      exact: true,
    });
    assert.equal(
      await requestMapperDelete.locator(".button-icon").textContent(),
      "×",
    );
    assert.equal(
      await requestMapperDelete
        .locator(".button-icon")
        .getAttribute("aria-hidden"),
      "true",
    );
    await requestMapperDelete.click();
    await mapperRow
      .getByText(
        "Delete this provider mapper? The change can affect claims in future sign-ins.",
        { exact: true },
      )
      .waitFor();
    await mapperRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminProviderMapperDeleteRequests ?? [],
      ),
      [],
    );
    await mapperRow
      .getByRole("button", { name: "Delete mapper", exact: true })
      .click();
    const confirmMapperDelete = mapperRow.getByRole("button", {
      name: "Delete mapper",
      exact: true,
    });
    await confirmMapperDelete.click();
    assert.equal(await confirmMapperDelete.isDisabled(), true);
    assert.equal(await confirmMapperDelete.locator(".spinner").count(), 1);
    await window
      .getByText("Provider mapper deleted.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminProviderMapperDeleteRequests,
      ),
      ["mapper-1"],
    );
    await identityProviderRow
      .getByRole("button", { name: "Delete provider", exact: true })
      .click();
    await identityProviderRow
      .getByText(
        "Delete this identity provider and its mapper configuration? Providers with linked accounts cannot be deleted.",
        { exact: true },
      )
      .waitFor();
    await identityProviderRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminIdentityProviderDeleteRequests ?? [],
      ),
      [],
    );
    await identityProviderRow
      .getByRole("button", { name: "Delete provider", exact: true })
      .click();
    const confirmProviderDelete = identityProviderRow.getByRole("button", {
      name: "Delete provider",
      exact: true,
    });
    await confirmProviderDelete.click();
    assert.equal(await confirmProviderDelete.isDisabled(), true);
    assert.equal(await confirmProviderDelete.locator(".spinner").count(), 1);
    await window
      .getByText("Identity provider deleted.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminIdentityProviderDeleteRequests,
      ),
      ["provider-1"],
    );
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
    const adminSessionRow = window
      .locator(".list-item")
      .filter({ hasText: "alice" });
    await adminSessionRow
      .getByRole("button", { name: "Sign out session", exact: true })
      .click();
    await adminSessionRow
      .getByText("Sign out this session for the user?", { exact: true })
      .waitFor();
    await adminSessionRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminSessionDeleteRequests ?? [],
      ),
      [],
    );
    await adminSessionRow
      .getByRole("button", { name: "Sign out session", exact: true })
      .click();
    const confirmAdminSessionDelete = adminSessionRow.getByRole("button", {
      name: "Sign out session",
      exact: true,
    });
    await confirmAdminSessionDelete.click();
    assert.equal(await confirmAdminSessionDelete.isDisabled(), true);
    assert.equal(
      await confirmAdminSessionDelete.locator(".spinner").count(),
      1,
    );
    await window.getByText("Session signed out.", { exact: true }).waitFor();
    assert.equal(await adminSessionRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminSessionDeleteRequests),
      ["session-secret-should-not-render"],
    );
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
    const consentRow = window
      .locator(".list-item")
      .filter({ hasText: "Account Console" });
    await consentRow
      .getByRole("button", { name: "Revoke consent", exact: true })
      .click();
    await consentRow
      .getByText("Revoke this user's consent for the client?", {
        exact: true,
      })
      .waitFor();
    await consentRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminConsentRevokeRequests ?? [],
      ),
      [],
    );
    await consentRow
      .getByRole("button", { name: "Revoke consent", exact: true })
      .click();
    const confirmConsentRevoke = consentRow.getByRole("button", {
      name: "Revoke consent",
      exact: true,
    });
    await confirmConsentRevoke.click();
    assert.equal(await confirmConsentRevoke.isDisabled(), true);
    assert.equal(await confirmConsentRevoke.locator(".spinner").count(), 1);
    await window.getByText("Consent revoked.", { exact: true }).waitFor();
    assert.equal(await consentRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminConsentRevokeRequests),
      ["/api/admin/consents/consents/account-console/alice"],
    );
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
    const offlineSessionRow = window
      .locator(".list-item")
      .filter({ hasText: "bob" });
    assert.equal(await window.getByText("offline-auth-opaque-id").count(), 0);
    await offlineSessionRow
      .getByRole("button", { name: "Revoke offline session", exact: true })
      .click();
    await offlineSessionRow
      .getByText(
        "Revoke this offline session? Its refresh token will stop working.",
        { exact: true },
      )
      .waitFor();
    await offlineSessionRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminOfflineSessionDeleteRequests ?? [],
      ),
      [],
    );
    await offlineSessionRow
      .getByRole("button", { name: "Revoke offline session", exact: true })
      .click();
    const confirmOfflineRevoke = offlineSessionRow.getByRole("button", {
      name: "Revoke offline session",
      exact: true,
    });
    await confirmOfflineRevoke.click();
    assert.equal(await confirmOfflineRevoke.isDisabled(), true);
    assert.equal(await confirmOfflineRevoke.locator(".spinner").count(), 1);
    await window
      .getByText("Offline session revoked.", { exact: true })
      .waitFor();
    assert.equal(await offlineSessionRow.count(), 0);
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminOfflineSessionDeleteRequests,
      ),
      ["offline-auth-opaque-id"],
    );
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
    const rotateSigningKey = window.getByRole("button", {
      name: "Rotate signing key",
      exact: true,
    });
    await window.evaluate(() => window.dispatchEvent(new Event("offline")));
    await window.waitForFunction(() =>
      document
        .querySelector('[data-action="admin-key-rotate-request"]')
        ?.hasAttribute("disabled"),
    );
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminKeyRotationRequests ?? [],
      ),
      [],
    );
    await window.evaluate(() => window.dispatchEvent(new Event("online")));
    await rotateSigningKey.waitFor({ state: "visible" });
    await rotateSigningKey.click();
    await window
      .getByText(
        "Rotate the active signing key? Previous keys remain available to verify existing tokens.",
        { exact: true },
      )
      .waitFor();
    await window.locator('[data-action="admin-key-rotate-cancel"]').click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminKeyRotationRequests ?? [],
      ),
      [],
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("button", { name: "İngilizce" }).waitFor();
    await window
      .getByRole("button", { name: "İmzalama anahtarını döndür", exact: true })
      .click();
    await window
      .getByText(
        "Etkin imzalama anahtarı döndürülsün mü? Önceki anahtarlar mevcut belirteçleri doğrulamak için kullanılmaya devam eder.",
        { exact: true },
      )
      .waitFor();
    const confirmSigningKeyRotation = window.getByRole("button", {
      name: "Anahtarı döndür",
      exact: true,
    });
    await confirmSigningKeyRotation.click();
    assert.equal(await confirmSigningKeyRotation.isDisabled(), true);
    assert.equal(
      await confirmSigningKeyRotation.locator(".spinner").count(),
      1,
    );
    await confirmSigningKeyRotation.evaluate((button) => button.click());
    await window
      .getByText("İmzalama anahtarı döndürüldü.", { exact: true })
      .waitFor();
    await window.getByText("rsa-rotated-1", { exact: true }).waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__adminKeyRotationRequests),
      [
        {
          method: "POST",
          path: "/api/admin/keys/rotate",
          bodyPresent: false,
        },
      ],
    );
    assert.equal(
      await window.getByText("SECRET_PRIVATE_KEY_NEVER_RENDER").count(),
      0,
    );
    await window.evaluate(() => window.dispatchEvent(new Event("offline")));
    await window.waitForFunction(() =>
      document
        .querySelector('[data-action="admin-key-rotate-request"]')
        ?.hasAttribute("disabled"),
    );
    await window
      .locator('[data-action="admin-key-rotate-request"]')
      .evaluate((button) => button.click());
    assert.equal(
      (await application.evaluate(() => globalThis.__adminKeyRotationRequests))
        .length,
      1,
    );
    await window.evaluate(() => window.dispatchEvent(new Event("online")));
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Turkish" }).waitFor();
    await window
      .getByRole("button", { name: "Rotate signing key", exact: true })
      .click();
    await window
      .getByText(
        "Rotate the active signing key? Previous keys remain available to verify existing tokens.",
        { exact: true },
      )
      .waitFor();
    const confirmEnglishSigningKeyRotation = window.getByRole("button", {
      name: "Rotate key",
      exact: true,
    });
    await confirmEnglishSigningKeyRotation.click();
    assert.equal(await confirmEnglishSigningKeyRotation.isDisabled(), true);
    assert.equal(
      await confirmEnglishSigningKeyRotation.locator(".spinner").count(),
      1,
    );
    await confirmEnglishSigningKeyRotation.evaluate((button) => button.click());
    await window.getByText("Signing key rotated.", { exact: true }).waitFor();
    await window.getByText("rsa-rotated-2", { exact: true }).waitFor();
    assert.equal(
      (await application.evaluate(() => globalThis.__adminKeyRotationRequests))
        .length,
      2,
    );
    assert.equal(
      await window.getByText("SECRET_PRIVATE_KEY_NEVER_RENDER").count(),
      0,
    );
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
    const revokeAll = window.getByRole("button", { name: "Revoke all" });
    await revokeAll.click();
    await window
      .getByText("Revoke every offline access token now?", { exact: true })
      .waitFor();
    await window.getByRole("button", { name: "Cancel" }).click();
    assert.equal(
      await application.evaluate(
        () => globalThis.__offlineAccessRevokeCount ?? 0,
      ),
      0,
    );
    await window.getByRole("button", { name: "Revoke all" }).click();
    const confirmRevokeAll = window.getByRole("button", {
      name: "Revoke all",
    });
    await confirmRevokeAll.click();
    assert.equal(await confirmRevokeAll.isDisabled(), true);
    assert.equal(await confirmRevokeAll.locator(".spinner").count(), 1);
    await confirmRevokeAll.evaluate((button) => button.click());
    assert.equal(
      await application.evaluate(() => globalThis.__offlineAccessRevokeCount),
      1,
    );
    await window
      .getByText("All offline access tokens were revoked.", { exact: true })
      .waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await window.getByRole("button", { name: "Tümünü iptal et" }).click();
    await window
      .getByText("Tüm çevrimdışı erişim belirteçleri şimdi iptal edilsin mi?", {
        exact: true,
      })
      .waitFor();
    const confirmTurkishRevoke = window.getByRole("button", {
      name: "Tümünü iptal et",
    });
    await confirmTurkishRevoke.click();
    await window
      .getByText("Tüm çevrimdışı erişim belirteçleri iptal edildi.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await application.evaluate(() => globalThis.__offlineAccessRevokeCount),
      2,
    );
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
    const loginPolicyForm = window.locator(
      'form[data-form="admin-login-settings"]',
    );
    await loginPolicyForm.locator('[name="otpEnabled"]').uncheck();
    await loginPolicyForm.locator('[name="otpRequired"]').check();
    await loginPolicyForm.getByRole("button", { name: "Save" }).click();
    await window
      .getByText("Enable TOTP before requiring it.", { exact: true })
      .waitFor();
    assert.equal(
      await application.evaluate(
        () => globalThis.__nativeLoginPolicyUpdates?.length ?? 0,
      ),
      0,
    );
    await loginPolicyForm.locator('[name="otpEnabled"]').check();
    await loginPolicyForm.locator('[name="otpRequired"]').uncheck();
    const passwordMinimumLength = loginPolicyForm.locator(
      '[name="passwordMinimumLength"]',
    );
    await passwordMinimumLength.fill("9");
    const loginPolicySave = loginPolicyForm.getByRole("button", {
      name: "Save",
    });
    await loginPolicySave.click();
    assert.equal(await loginPolicySave.isDisabled(), true);
    assert.equal(await loginPolicySave.locator(".spinner").count(), 1);
    await window
      .getByText("Server requires at least 10 characters.", { exact: true })
      .waitFor();
    assert.equal(await passwordMinimumLength.inputValue(), "9");
    await passwordMinimumLength.fill("10");
    await loginPolicySave.click();
    assert.equal(await loginPolicySave.isDisabled(), true);
    assert.equal(await loginPolicySave.locator(".spinner").count(), 1);
    await loginPolicySave.evaluate((button) => button.click());
    await window
      .getByText("Login policy settings saved.", { exact: true })
      .waitFor();
    const loginPolicyUpdates = await application.evaluate(
      () => globalThis.__nativeLoginPolicyUpdates,
    );
    assert.equal(loginPolicyUpdates.length, 2);
    assert.equal(loginPolicyUpdates[1].passwordMinimumLength, 10);
    assert.equal("passwordCommonPasswords" in loginPolicyUpdates[1], false);
    assert.equal(
      await window.getByText("SECRET_COMMON_PASSWORDS_NEVER_RENDER").count(),
      0,
    );
    await window.getByRole("button", { name: "Turkish" }).click();
    await loginPolicyForm.locator('[name="sessionTimeoutMinutes"]').fill("60");
    await loginPolicyForm.getByRole("button", { name: "Kaydet" }).click();
    await window
      .getByText("Giriş politikası ayarları kaydedildi.", { exact: true })
      .waitFor();
    assert.equal(
      await application.evaluate(
        () =>
          globalThis.__nativeLoginPolicyUpdates.at(-1).sessionTimeoutMinutes,
      ),
      60,
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    const loginSessionTimeout = loginPolicyForm.locator(
      '[name="sessionTimeoutMinutes"]',
    );
    await loginSessionTimeout.fill("61");
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    await window
      .getByText(
        "Offline mode: safe mutations are disabled until connectivity returns.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await loginPolicySave.isDisabled(), true);
    await loginSessionTimeout.fill("62");
    assert.equal(
      await application.evaluate(
        () => globalThis.__nativeLoginPolicyUpdates.length,
      ),
      3,
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
        "Offline mode: safe mutations are disabled until connectivity returns.",
        { exact: true },
      )
      .waitFor({ state: "detached" });
    assert.equal(await loginSessionTimeout.inputValue(), "62");
    await loginPolicySave.click();
    await window
      .getByText("Login policy settings saved.", { exact: true })
      .waitFor();
    assert.equal(
      await application.evaluate(
        () =>
          globalThis.__nativeLoginPolicyUpdates.at(-1).sessionTimeoutMinutes,
      ),
      62,
    );
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
    assert.equal(await passwordMinimumLength.inputValue(), "10");
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
    await window.waitForFunction(() => {
      const button = [...document.querySelectorAll(".sidebar button")].find(
        (candidate) => candidate.textContent.includes("Localization"),
      );
      return button?.disabled === true;
    });
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
      'form[data-form="admin-localization-message"][data-id="1"]',
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
    const createOverrideForm = window.locator(
      'form[data-form="admin-localization-message-create"]',
    );
    await createOverrideForm.locator('[name="locale"]').selectOption("tr");
    await createOverrideForm.locator('[name="bundle"]').selectOption("admin");
    await createOverrideForm.locator('[name="messageKey"]').fill("invalid.key");
    await createOverrideForm
      .locator('[name="messageValue"]')
      .fill("Yeni <b>mesaj</b>");
    const createOverrideButton = createOverrideForm.getByRole("button", {
      name: "Create message override",
      exact: true,
    });
    await createOverrideButton.click();
    assert.equal(await createOverrideButton.isDisabled(), true);
    assert.equal(await createOverrideButton.locator(".spinner").count(), 1);
    await createOverrideForm
      .getByText("Choose another message key.", { exact: true })
      .waitFor();
    assert.equal(
      await createOverrideForm.locator('[name="messageValue"]').inputValue(),
      "Yeni <b>mesaj</b>",
    );
    await createOverrideForm
      .locator('[name="messageKey"]')
      .fill("native.created");
    await createOverrideButton.click();
    assert.equal(await createOverrideButton.isDisabled(), true);
    assert.equal(await createOverrideButton.locator(".spinner").count(), 1);
    await window
      .getByText("Message override created.", { exact: true })
      .waitFor();
    await window
      .getByText("tr · admin · native.created", { exact: true })
      .waitFor();
    await window.locator("#override-2-messageValue").waitFor();
    assert.equal(
      await window.locator("#override-2-messageValue").inputValue(),
      "Yeni <b>mesaj</b>",
    );
    assert.equal(await window.locator("b").count(), 0);
    assert.deepEqual(
      await application.evaluate(() => globalThis.__localizationMessageCreates),
      [
        {
          locale: "tr",
          bundle: "admin",
          messageKey: "invalid.key",
          messageValue: "Yeni <b>mesaj</b>",
        },
        {
          locale: "tr",
          bundle: "admin",
          messageKey: "native.created",
          messageValue: "Yeni <b>mesaj</b>",
        },
      ],
    );
    const createdOverrideRow = window
      .locator('form[data-form="admin-localization-message"][data-id="2"]')
      .locator("..");
    await createdOverrideRow
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await createdOverrideRow
      .getByText("Delete this message override?", { exact: true })
      .waitFor();
    await createdOverrideRow
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__localizationMessageDeletes ?? [],
      ),
      [],
    );
    await createdOverrideRow
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    const confirmOverrideDelete = createdOverrideRow.getByRole("button", {
      name: "Delete",
      exact: true,
    });
    await confirmOverrideDelete.click();
    assert.equal(await confirmOverrideDelete.isDisabled(), true);
    assert.equal(await confirmOverrideDelete.locator(".spinner").count(), 1);
    await window
      .getByText("Message override deleted.", { exact: true })
      .waitFor();
    assert.deepEqual(
      await application.evaluate(() => globalThis.__localizationMessageDeletes),
      [2],
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
      globalThis.__denyClientRead = false;
      globalThis.fetch = async (url, init) => {
        const requestUrl = new URL(String(url));
        const requestMethod = String(init?.method ?? "GET").toUpperCase();
        if (requestUrl.pathname === "/api/admin/whoami") {
          if (globalThis.__delayWhoAmI)
            await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({ access: globalThis.__adminAccessFlags }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (requestUrl.pathname === "/api/admin/clients") {
          if (globalThis.__denyClientRead)
            return new Response("{}", { status: 403 });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(
            JSON.stringify({ content: [], number: 0, totalPages: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (
          requestUrl.pathname === "/api/admin/sessions/revoke-all" &&
          requestMethod === "POST"
        ) {
          globalThis.__adminSessionRevokeAllRequests ??= [];
          globalThis.__adminSessionRevokeAllRequests.push({
            method: requestMethod,
            body: init?.body,
          });
          await new Promise((resolve) => setTimeout(resolve, 350));
          return new Response(null, { status: 204 });
        }
        if (requestUrl.pathname === "/api/admin/sessions")
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: "session-secret-should-not-render",
                  username: "admin",
                  authorizationCount: 1,
                  active: true,
                },
              ],
              number: 0,
              totalPages: 1,
              totalElements: 1,
              size: 20,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (requestUrl.pathname !== "/api/admin/dashboard")
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
    await forbidden
      .getByRole("button", { name: "Return to an authorized page" })
      .waitFor();
    assert.equal(
      await forbidden.getByRole("button", { name: "Retry" }).count(),
      0,
    );
    await forbidden
      .getByText(
        "You do not have permission to use the administration console.",
      )
      .waitFor();
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
    await application.evaluate(() => {
      globalThis.__delayWhoAmI = true;
      globalThis.__adminAccessFlags = {
        isAdmin: false,
        queryUsers: false,
        viewUsers: false,
        manageUsers: false,
        viewRoles: false,
        manageRoles: false,
        queryGroups: false,
        viewGroups: false,
        manageGroups: false,
        queryClients: false,
        viewClients: true,
        manageClients: false,
        viewSessions: false,
        manageSessions: false,
        viewConsents: false,
        manageConsents: false,
        viewEvents: false,
        manageEvents: false,
        viewKeys: false,
        manageKeys: false,
      };
    });
    await window.reload();
    await window.getByRole("status").waitFor();
    assert.equal(await window.locator('[data-route="dashboard"]').count(), 0);
    await window
      .getByRole("heading", { name: "İstemciler", exact: true })
      .waitFor();
    await application.evaluate(() => {
      globalThis.__delayWhoAmI = false;
    });
    assert.equal(await window.locator('[data-route="dashboard"]').count(), 0);
    assert.equal(await window.locator('[data-route="clients"]').count(), 1);
    await application.evaluate(() => {
      globalThis.__denyClientRead = true;
    });
    await window.locator('[data-route="clients"]').click();
    const limitedForbidden = window.getByRole("alert");
    await limitedForbidden
      .getByText("Yönetim konsolunu kullanma yetkiniz yok.")
      .waitFor();
    await window.getByRole("button", { name: "İngilizce" }).click();
    await limitedForbidden
      .getByText(
        "You do not have permission to use the administration console.",
      )
      .waitFor();
    await window.getByRole("button", { name: "Turkish" }).click();
    await application.evaluate(() => {
      globalThis.__denyClientRead = false;
    });
    const returnToAuthorized = window.getByRole("button", {
      name: "Yetkili olduğunuz sayfaya dönün",
    });
    await returnToAuthorized.click();
    assert.equal(await returnToAuthorized.isDisabled(), true);
    assert.equal(await returnToAuthorized.locator(".spinner").count(), 1);
    await window
      .getByRole("heading", { name: "İstemciler", exact: true })
      .waitFor();
    await window.waitForTimeout(500);
    assert.equal(
      await application.evaluate(() => globalThis.__authorizationOpens),
      1,
    );
    await window.getByRole("button", { name: "İngilizce" }).click();
    await window.getByRole("button", { name: "Turkish" }).waitFor();
    await application.evaluate(() => {
      for (const key of Object.keys(globalThis.__adminAccessFlags))
        globalThis.__adminAccessFlags[key] = false;
      globalThis.__adminAccessFlags.viewSessions = true;
    });
    await window.reload();
    await window
      .getByRole("heading", { name: "Sessions", exact: true })
      .waitFor();
    assert.equal(
      await window
        .getByRole("button", { name: "Sign out all sessions", exact: true })
        .count(),
      0,
    );
    await application.evaluate(() => {
      globalThis.__adminAccessFlags.manageSessions = true;
    });
    await window.reload();
    await window
      .getByRole("heading", { name: "Sessions", exact: true })
      .waitFor();
    const revokeAllSessionsButton = window.getByRole("button", {
      name: "Sign out all sessions",
      exact: true,
    });
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    assert.equal(await revokeAllSessionsButton.isDisabled(), true);
    await window.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    await revokeAllSessionsButton.click();
    await window
      .getByText(
        "Sign out every active session, including this Admin session? You will need to sign in again.",
        { exact: true },
      )
      .waitFor();
    await window.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminSessionRevokeAllRequests ?? [],
      ),
      [],
    );
    await window
      .getByRole("button", { name: "Sign out all sessions", exact: true })
      .click();
    const confirmAdminSessionsRevokeAll = window.getByRole("button", {
      name: "Sign out all sessions",
      exact: true,
    });
    await confirmAdminSessionsRevokeAll.click();
    assert.equal(await confirmAdminSessionsRevokeAll.isDisabled(), true);
    assert.equal(
      await confirmAdminSessionsRevokeAll.locator(".spinner").count(),
      1,
    );
    await confirmAdminSessionsRevokeAll.dispatchEvent("click");
    await window
      .getByRole("button", { name: "Sign in", exact: true })
      .waitFor();
    assert.equal(await window.getByText("admin", { exact: true }).count(), 0);
    assert.deepEqual(
      await application.evaluate(
        () => globalThis.__adminSessionRevokeAllRequests,
      ),
      [{ method: "POST", body: undefined }],
    );
    assert.equal(
      await window.evaluate(() => window.desktopApi.auth.hasSession("admin")),
      false,
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
          "person@example.test access_token=ACCESS_E2E refresh_token=REFRESH_E2E code=AUTH_E2E cookie=COOKIE_E2E provider_subject=SUBJECT_E2E first_name=NAME_E2E",
        ),
      );
      process.emit("unhandledRejection", new TypeError("private detail"));
      process.emit("unhandledRejection", new RangeError("private detail"));
      process.emit("unhandledRejection", new SyntaxError("private detail"));
    });
    await settingsWindow.waitForTimeout(200);
    await settingsWindow
      .getByRole("button", { name: /Diagnostics|Tanı bilgileri/ })
      .click();
    await settingsWindow
      .getByRole("heading", { name: /Diagnostics|Tanı bilgileri/ })
      .waitFor();
    await settingsWindow.waitForFunction(() => {
      const text = document.querySelector("#desktop-diagnostics")?.textContent;
      return (
        text?.includes("TypeError") &&
        text.includes("RangeError") &&
        text.includes("SyntaxError")
      );
    });
    assert.equal(
      await settingsWindow
        .getByRole("button", {
          name: /Copy diagnostics|Tanı bilgilerini kopyala/,
        })
        .count(),
      1,
    );
    await settingsWindow.evaluate(() => {
      globalThis.__diagnosticCopyCount = 0;
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async () => {
          globalThis.__diagnosticCopyCount += 1;
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
      await settingsWindow.evaluate(() => globalThis.__diagnosticCopyCount),
      1,
    );
    await settingsWindow
      .getByText(/Copied|Kopyalandı/, { exact: true })
      .waitFor();
    assert.equal(await copyDiagnostics.isDisabled(), false);
    assert.equal(await copyDiagnostics.locator(".inline-spinner").count(), 0);
    const diagnosticText = await settingsWindow
      .locator("#desktop-diagnostics")
      .innerText();
    assert.match(diagnosticText, /unhandled-rejection/);
    for (const sensitiveValue of [
      "person@example.test",
      "ACCESS_E2E",
      "REFRESH_E2E",
      "AUTH_E2E",
      "COOKIE_E2E",
      "SUBJECT_E2E",
      "NAME_E2E",
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

test("keeps native windows isolated, sandboxed, and without Node integration", async () => {
  const application = await launchDesktop({ updatePreviewState: "available" });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const exposedAuthMethods = await mainWindow.evaluate(() =>
      Object.keys(window.desktopApi.auth),
    );
    assert.ok(!exposedAuthMethods.includes("getSession"));
    assert.ok(!exposedAuthMethods.includes("setSession"));
    assert.ok(!exposedAuthMethods.includes("getTokens"));

    const openMenuItem = async (menuLabel, itemLabel) => {
      const windowPromise = application.waitForEvent("window");
      const found = await application.evaluate(
        ({ Menu }, { menuLabel: requestedMenu, itemLabel: requestedItem }) => {
          const menu = Menu.getApplicationMenu();
          const parent = menu?.items.find(
            (item) => item.label === requestedMenu,
          );
          const item = parent?.submenu?.items.find(
            (candidate) => candidate.label === requestedItem,
          );
          item?.click();
          return Boolean(item);
        },
        { menuLabel, itemLabel },
      );
      assert.equal(found, true, `Could not find menu item: ${itemLabel}`);
      return windowPromise;
    };

    const aboutWindow = await openMenuItem("Kitezh", "About Kitezh");
    await aboutWindow.getByRole("heading", { name: "Kitezh" }).waitFor();

    const settingsWindow = await openMenuItem("Kitezh", "Settings…");
    await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();

    const companionWindow = await openMenuItem("View", "Quick Access…");
    await companionWindow.getByRole("heading", { name: "Kitezh" }).waitFor();

    const { nextWindowPromise: availableWindowPromise } =
      await openManualUpdateCheck(application);
    const availableWindow = await availableWindowPromise;
    await availableWindow
      .getByRole("heading", { name: "A new version of Kitezh is available!" })
      .waitFor();

    const nativeWindowCount = await application.evaluate(
      ({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        const unsafe = windows
          .map((window) => ({
            url: window.webContents.getURL(),
            preferences: window.webContents.getLastWebPreferences(),
          }))
          .filter(
            ({ preferences }) =>
              !preferences ||
              preferences.contextIsolation !== true ||
              preferences.nodeIntegration !== false ||
              preferences.sandbox !== true,
          );
        if (unsafe.length > 0) {
          throw new Error(
            `Native windows have unsafe WebPreferences: ${JSON.stringify(unsafe)}`,
          );
        }
        return windows.length;
      },
    );
    assert.ok(nativeWindowCount >= 5);
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

test("opens the update dialog when the desktop notification is clicked", async () => {
  const application = await launchDesktop({
    updatePreviewState: "available",
    updatePreviewAutomatic: true,
  });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await application.evaluate(({ BrowserWindow, Notification }) => {
      Object.defineProperty(Notification, "isSupported", {
        configurable: true,
        value: () => true,
      });
      const originalOn = Notification.prototype.on;
      Notification.prototype.on = function (event, listener) {
        if (event === "click") globalThis.__updateNotificationClick = listener;
        return originalOn.call(this, event, listener);
      };
      Notification.prototype.show = function () {
        globalThis.__updateNotification = {
          title: this.title,
          body: this.body,
        };
      };
      const window = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().startsWith("app://renderer/native"),
      );
      window?.hide();
    });
    let notification;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      notification = await application.evaluate(
        () => globalThis.__updateNotification ?? null,
      );
      if (notification) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(notification, "Update notification was not shown");
    assert.deepEqual(notification, {
      title: "Kitezh update available",
      body: "Version 0.1.1 is ready to download.",
    });

    const firstDialog = await windowWithHeading(
      application,
      "A new version of Kitezh is available!",
    );
    await firstDialog.close();
    const reopenedDialogPromise = application.waitForEvent("window");
    await application.evaluate(() => globalThis.__updateNotificationClick());
    const reopenedDialog = await reopenedDialogPromise;
    await reopenedDialog
      .getByRole("heading", {
        name: "A new version of Kitezh is available!",
      })
      .waitFor();
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

test("rejects an unsigned update manifest in the Windows main process", async () => {
  const application = await launchDesktop({ autoUpdate: "true" });
  try {
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await application.evaluate(({ app, net }) => {
      Object.defineProperty(app, "isPackaged", {
        configurable: true,
        value: true,
      });
      globalThis.__updateManifestRequests = [];
      net.fetch = async (url) => {
        const requestUrl = String(url);
        globalThis.__updateManifestRequests.push(requestUrl);
        if (requestUrl.endsWith(".sig"))
          return new Response(null, { status: 404 });
        return new Response("version: 0.1.4\n", { status: 200 });
      };
    });
    const errorPromise = mainWindow.evaluate(
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
    await mainWindow.evaluate(() => window.desktopApi?.updates.check());
    assert.deepEqual(await errorPromise, {
      state: "error",
      message: "Desktop update could not be checked.",
    });
    assert.deepEqual(
      await application.evaluate(() => globalThis.__updateManifestRequests),
      [
        "https://github.com/susimsek/kitezh/releases/latest/download/latest.yml",
        "https://github.com/susimsek/kitezh/releases/latest/download/latest.yml.sig",
      ],
    );
  } finally {
    await application.close();
  }
});

test("does not check a Windows update when the signed manifest was altered", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const manifest = Buffer.from(
    "version: 0.1.4\nreleaseDate: '2026-10-11T08:00:00.000Z'\nfiles:\n  - url: kitezh-0.1.4-win-x64-setup.exe\n    sha512: signed-checksum\n    size: 128\n",
  );
  const signature = sign(null, manifest, privateKey).toString("base64");
  const alteredManifest = manifest
    .toString("utf8")
    .replace("version: 0.1.4", "version: 0.1.5");
  const appPath = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-desktop-update-integrity-e2e-"),
  );
  const assetsPath = path.join(appPath, "assets");
  await mkdir(assetsPath, { recursive: true });
  await writeFile(
    path.join(assetsPath, "update-manifest-public-key.pem"),
    publicKey.export({ type: "spki", format: "pem" }),
  );

  const application = await launchDesktop({ autoUpdate: "true" });
  try {
    const window = await nativeMainWindow(application);
    await window.getByRole("heading", { name: "Choose a console" }).waitFor();
    await application.evaluate(
      ({ app, net }, fixture) => {
        Object.defineProperty(app, "isPackaged", {
          configurable: true,
          value: true,
        });
        Object.defineProperty(app, "getAppPath", {
          configurable: true,
          value: () => fixture.appPath,
        });
        globalThis.__updateManifestRequests = [];
        net.fetch = async (url) => {
          const requestUrl = String(url);
          globalThis.__updateManifestRequests.push(requestUrl);
          if (requestUrl.endsWith(".sig"))
            return new Response(fixture.signature, { status: 200 });
          return new Response(fixture.manifest, { status: 200 });
        };
      },
      {
        appPath,
        manifest: alteredManifest,
        signature,
      },
    );

    const statusPromise = window.evaluate(
      () =>
        new Promise((resolve) => {
          const statuses = [];
          let remove;
          remove = window.desktopApi.updates.onStatus((status) => {
            statuses.push(status);
            if (status?.state !== "error") return;
            remove?.();
            resolve({ status, observedStates: statuses });
          });
        }),
    );
    await window.evaluate(() => window.desktopApi.updates.check());
    const result = await statusPromise;
    assert.deepEqual(result.status, {
      state: "error",
      message: "Desktop update could not be checked.",
    });
    assert.equal(
      result.observedStates.some((status) => status?.state === "available"),
      false,
    );
    assert.deepEqual(
      await application.evaluate(() => globalThis.__updateManifestRequests),
      [
        "https://github.com/susimsek/kitezh/releases/latest/download/latest.yml",
        "https://github.com/susimsek/kitezh/releases/latest/download/latest.yml.sig",
      ],
    );
  } finally {
    await application.close();
    await rm(appPath, { recursive: true, force: true });
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
    const companionWindowPromise = application.waitForEvent("window");
    await clickViewMenuItem(application, "Quick Access…");
    const companionWindow = await companionWindowPromise;
    await companionWindow.getByRole("heading", { name: "Kitezh" }).waitFor();
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("radio", { name: "Dark" }).click();
    await mainWindow.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await companionWindow.waitForFunction(
      () =>
        getComputedStyle(document.body).backgroundColor === "rgb(17, 20, 24)",
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
    await companionWindow.waitForFunction(
      () => document.documentElement.lang === "tr",
    );
    assert.equal(
      await companionWindow
        .getByRole("button", { name: "Yönetim Konsolu", exact: true })
        .count(),
      1,
    );
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
    await companionWindow.waitForFunction(
      () => document.documentElement.lang === "en",
    );
    assert.equal(
      await companionWindow
        .getByRole("button", { name: "Admin Console", exact: true })
        .count(),
      1,
    );
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
    await companionWindow.waitForFunction(
      () => document.documentElement.lang === "tr",
    );
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
    await companionWindow.waitForFunction(
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
    await companionWindow.waitForFunction(
      (background) =>
        getComputedStyle(document.body).backgroundColor === background,
      systemDialogBackground,
    );
  } finally {
    await application.close();
  }
});
