import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  recoveryState,
  apiBaseUrl = "http://127.0.0.1:9090",
  updatePreviewState,
  updatePreviewVersion = "0.1.1",
} = {}) {
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-desktop-e2e-"),
  );
  if (recoveryState) {
    await writeFile(
      path.join(userDataDirectory, "desktop-update-recovery.json"),
      JSON.stringify(recoveryState),
      { mode: 0o600 },
    );
  }
  return electron.launch({
    args: [
      `--user-data-dir=${userDataDirectory}`,
      desktopDirectory,
    ],
    cwd: desktopDirectory,
    env: {
      ...process.env,
      DESKTOP_API_BASE_URL: apiBaseUrl,
      DESKTOP_AUTO_UPDATE: "false",
      DESKTOP_E2E_BACKGROUND: "true",
      ...(process.platform === "linux"
        ? { DESKTOP_E2E_TEST_STORAGE: "true" }
        : {}),
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

async function captureBackgroundWindow(application, window, screenshotPath) {
  try {
    const screenshot = await application.evaluate(
      async ({ BrowserWindow }, targetUrl) => {
        const target = BrowserWindow.getAllWindows().find(
          (candidate) => candidate.webContents.getURL() === targetUrl,
        );
        if (!target) throw new Error("Could not find the background window");
        const image = await target.webContents.capturePage();
        return image.toPNG().toString("base64");
      },
      window.url(),
    );
    await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));
  } catch (error) {
    // Some headless Linux runners cannot capture a hidden BrowserWindow; screenshots are optional.
    if (!String(error).includes("UnknownVizError")) throw error;
  }
}

async function waitForWindowRoute(application, route) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const window = application
      .windows()
      .find((candidate) => new URL(candidate.url()).pathname === route);
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Could not find the renderer window for ${route}`);
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

async function openManualUpdateCheck(
  application,
  label = "Check for Updates…",
  expectNextWindow = true,
) {
  const checkingWindowPromise = application.waitForEvent("window");
  await clickApplicationMenuItem(application, label);
  const checkingWindow = await checkingWindowPromise;
  const nextWindowPromise = expectNextWindow
    ? application.waitForEvent("window")
    : null;
  await checkingWindow
    .getByRole("heading", {
      name: /Checking for updates|Güncellemeler denetleniyor/,
    })
    .waitFor();
  return { checkingWindow, nextWindowPromise };
}

test("opens the trusted renderer and exposes the narrow desktop bridge", async () => {
  const application = await launchDesktop();
  try {
    const window = await waitForWindowRoute(application, "/");
    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("heading", { name: "Choose a console" }).waitFor();

    assert.equal(await window.url(), "app://renderer/");
    assert.equal(await window.locator(".desktop-console-option").count(), 2);
    assert.ok(
      await window
        .locator('img[aria-hidden="true"]')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image.complete &&
              image.naturalWidth > 0 &&
              image.src.startsWith("app://renderer/brand/"),
          ),
        ),
      "Desktop brand logos should load from the packaged renderer",
    );
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

test("opens settings in a separate window without requiring login", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
      ),
      true,
    );

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
    assert.equal(
      await settingsWindow
        .getByRole("navigation", { name: "Settings" })
        .locator('button[data-section] svg[aria-hidden="true"]')
        .count(),
      5,
    );
    assert.equal(
      await settingsWindow
        .locator("#desktop-settings-search")
        .evaluate((input) => {
          const style = getComputedStyle(input);
          return (
            style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
            style.borderStyle === "solid"
          );
        }),
      true,
      "Settings search should use the native theme surface and defined border",
    );
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
      ),
      true,
    );
    const screenshotDirectory =
      process.env.KITEZH_E2E_ARTIFACTS_DIR ?? os.tmpdir();
    await settingsWindow
      .locator("#desktop-settings-search")
      .evaluate((input) => input.blur());
    await mkdir(screenshotDirectory, { recursive: true });
    await captureBackgroundWindow(
      application,
      settingsWindow,
      path.join(screenshotDirectory, "settings-default.png"),
    );

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
    await settingsSearch.fill("automatic");
    assert.equal(
      await settingsWindow
        .getByRole("button", { name: "Updates", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await settingsWindow.locator("#desktop-automatic-download").isVisible(),
      true,
    );
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
    assert.equal(
      await settingsWindow
        .locator("[data-panel='general'] .intro")
        .textContent(),
      "Manage startup, language, and quick access.",
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
    await settingsWindow.getByRole("button", { name: "Diagnostics" }).click();
    await settingsWindow
      .getByRole("heading", { name: "Diagnostics" })
      .waitFor();
    const copyDiagnostics = settingsWindow.getByRole("button", {
      name: "Copy diagnostics",
    });
    assert.equal(await copyDiagnostics.count(), 1);
    await settingsWindow.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    assert.equal(
      await settingsWindow.evaluate(
        () => matchMedia("(forced-colors: active)").matches,
      ),
      true,
    );
    assert.equal(
      await settingsWindow.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
      true,
    );
    await settingsWindow.keyboard.press("Tab");
    assert.equal(
      await settingsWindow.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle,
      ),
      "solid",
    );
    assert.ok(
      await settingsWindow.evaluate(
        () =>
          Number.parseFloat(
            getComputedStyle(document.activeElement).transitionDuration,
          ) <= 0.00001,
      ),
      "Reduced-motion mode should minimize control transitions",
    );
    await settingsWindow.setViewportSize({ width: 680, height: 700 });
    assert.ok(
      await settingsWindow.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Settings should fit a narrow viewport without horizontal scrolling",
    );
    const zoomApplied = await application.evaluate(({ BrowserWindow }) => {
      const settings = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().includes("/desktop-settings"),
      );
      if (!settings) return false;
      settings.webContents.setZoomFactor(2);
      return true;
    });
    assert.equal(zoomApplied, true);
    await settingsWindow.waitForFunction(() => window.devicePixelRatio >= 2);
    assert.ok(
      await settingsWindow.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Settings should fit at 200% zoom without horizontal scrolling",
    );
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((candidate) =>
          candidate.webContents.getURL().includes("/desktop-settings"),
        )
        ?.webContents.setZoomFactor(1);
    });
    assert.equal(
      await settingsWindow
        .getByRole("button", { name: "Appearance" })
        .isVisible(),
      true,
    );
    await captureBackgroundWindow(
      application,
      settingsWindow,
      path.join(screenshotDirectory, "settings-accessibility.png"),
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
        .getByRole("heading", { name: "Choose a console" })
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
    const mainWindow = await application.firstWindow();
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

test("handles a second launch while the E2E app stays hidden", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();

    await application.evaluate(({ app }) => {
      app.emit("second-instance", {}, []);
    });
    await mainWindow.waitForTimeout(100);
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
      ),
      true,
    );
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
  } finally {
    await application.close();
  }
});

test("keeps developer tools closed and the app hidden", async () => {
  const application = await launchDesktop({ devTools: true });
  try {
    const mainWindow = await application.firstWindow();
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
      return Boolean(toggle);
    });
    assert.equal(hasToggle, true);
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.isDevToolsOpened(),
        ),
      ),
      false,
    );
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
      ),
      true,
    );
  } finally {
    await application.close();
  }
});

test("completes a desktop OAuth callback and keeps credentials out of diagnostics", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await application.evaluate(({ shell }) => {
      shell.openExternal = async () => {};
      globalThis.fetch = async (_url, options) => {
        globalThis.__kitezhAuthRequest = String(options?.body ?? "");
        return new Response(
          JSON.stringify({
            access_token: "fixture-access-secret",
            expires_in: 300,
            id_token: "fixture-id-secret",
            refresh_token: "fixture-refresh-secret",
          }),
          { headers: { "content-type": "application/json" } },
        );
      };
    });

    const state = "desktop-e2e-state-0123456789";
    const codeVerifier = "v".repeat(43);
    await mainWindow.evaluate(
      (request) => window.desktopApi.auth.startLogin(request),
      {
        console: "account",
        authorizationUrl:
          "http://127.0.0.1:9090/oauth2/authorize?client_id=desktop-account-console",
        state,
        codeVerifier,
        clientId: "desktop-account-console",
        redirectUri: "kitezh://oauth/callback",
      },
    );
    await application.evaluate(({ app }, callbackUrl) => {
      app.emit("open-url", { preventDefault() {} }, callbackUrl);
    }, `kitezh://oauth/callback?code=fixture-code&state=${state}`);
    await mainWindow.waitForFunction(async () => {
      const session = await window.desktopApi.auth.getSession("account");
      return session?.accessToken === "fixture-access-secret";
    });

    const session = await mainWindow.evaluate(() =>
      window.desktopApi.auth.getSession("account"),
    );
    assert.equal(session.accessToken, "fixture-access-secret");
    assert.equal(session.idToken, "fixture-id-secret");
    assert.equal(session.refreshToken, "fixture-refresh-secret");
    assert.equal(session.version, 1);
    assert.ok(session.expiresAt > Date.now());
    const requestBody = await application.evaluate(
      () => globalThis.__kitezhAuthRequest,
    );
    assert.equal(
      new URLSearchParams(requestBody).get("grant_type"),
      "authorization_code",
    );
    assert.equal(
      new URLSearchParams(requestBody).get("code_verifier"),
      codeVerifier,
    );
    assert.equal(new URLSearchParams(requestBody).get("code"), "fixture-code");
    const diagnostics = await mainWindow.evaluate(() =>
      window.desktopApi.diagnostics.get(),
    );
    assert.equal(
      JSON.stringify(diagnostics).includes("fixture-access-secret"),
      false,
    );
    assert.equal(
      JSON.stringify(diagnostics).includes("fixture-refresh-secret"),
      false,
    );
    await mainWindow.evaluate(() =>
      window.desktopApi.auth.clearSession("account"),
    );
    assert.equal(
      await mainWindow.evaluate(() =>
        window.desktopApi.auth.getSession("account"),
      ),
      null,
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
    const mainWindow = await application.firstWindow();
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
    const mainWindow = await application.firstWindow();
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

test("reports a recovered update after the previous version starts", async () => {
  const application = await launchDesktop({
    recoveryState: {
      version: "pending-update",
      previousVersion: packageVersion,
      startedAt: Date.now() - 30_000,
      backupPath: path.join(os.tmpdir(), "kitezh-e2e-backup"),
      targetPath: path.join(os.tmpdir(), "kitezh-e2e-target"),
      targetType: "file",
      executablePath: process.execPath,
    },
  });
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const recoveredStatus = await mainWindow.evaluate(
      () =>
        new Promise((resolve) => {
          let remove;
          remove = window.desktopApi?.updates.onStatus((status) => {
            if (status?.state !== "recovered") return;
            remove?.();
            resolve(status);
          });
        }),
    );
    assert.deepEqual(recoveredStatus, {
      state: "recovered",
      version: packageVersion,
    });
  } finally {
    await application.close();
  }
});

test("shows the update error in the renderer when checking fails", async () => {
  const application = await launchDesktop({ updatePreviewState: "error" });
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await openManualUpdateCheck(application, "Check for Updates…", false);
    await mainWindow
      .getByRole("status")
      .filter({ hasText: "The desktop update could not be completed" })
      .waitFor();
  } finally {
    await application.close();
  }
});

test("localizes and themes the update dialog with desktop preferences", async () => {
  const application = await launchDesktop({ updatePreviewState: "available" });
  try {
    const mainWindow = await application.firstWindow();
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    const settingsWindowPromise = application.waitForEvent("window");
    await clickApplicationMenuItem(application, "Settings…");
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("radio", { name: "Light" }).click();
    assert.equal(
      await application.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
      "light",
    );
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("radio", { name: "System" }).click();
    assert.equal(
      await application.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
      "system",
    );
    await settingsWindow.getByRole("button", { name: "Appearance" }).click();
    await settingsWindow.getByRole("radio", { name: "Dark" }).click();
    assert.equal(
      await application.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
      "dark",
    );
    await settingsWindow.getByRole("button", { name: "General" }).click();
    await settingsWindow.locator("#desktop-language").selectOption("tr");
    await mainWindow
      .getByRole("heading", { name: "Bir konsol seçin" })
      .waitFor();
    await settingsWindow.getByRole("heading", { name: "Ayarlar" }).waitFor();
    await settingsWindow.close();
    const reopenedSettingsWindowPromise = application.waitForEvent("window");
    await clickApplicationMenuItem(application, "Ayarlar…");
    const reopenedSettingsWindow = await reopenedSettingsWindowPromise;
    await reopenedSettingsWindow
      .getByRole("heading", { name: "Ayarlar" })
      .waitFor();
    assert.equal(
      await reopenedSettingsWindow.locator("#desktop-language").inputValue(),
      "tr",
    );
    await reopenedSettingsWindow.close();
    const checkingWindowPromise = application.waitForEvent("window");
    await clickApplicationMenuItem(application, "Güncellemeleri denetle…");
    const checkingWindow = await checkingWindowPromise;
    const availableWindowPromise = application.waitForEvent("window");
    await checkingWindow
      .getByRole("heading", { name: "Güncellemeler denetleniyor…" })
      .waitFor();
    const availableWindow = await availableWindowPromise;
    await availableWindow
      .getByRole("heading", { name: "Yeni bir Kitezh sürümü var!" })
      .waitFor();
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
