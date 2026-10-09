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

test("opens the native console chooser and exposes the narrow desktop bridge", async () => {
  const application = await launchDesktop();
  try {
    const window = await application.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("heading", { name: "Choose a console" }).waitFor();

    assert.equal(await window.url(), "app://renderer/native");
    assert.equal(await window.getByRole("button", { name: "Administration Console" }).count(), 1);
    assert.equal(await window.getByRole("button", { name: "Account Console" }).count(), 1);
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

test("opens settings in a separate window without requiring login", async () => {
  const application = await launchDesktop();
  try {
    const mainWindow = await application.firstWindow();
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
    assert.equal(
      await settingsWindow
        .getByRole("button", { name: "Copy diagnostics" })
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
    for (const button of await companionWindow
      .getByRole("button")
      .all()) {
      assert.equal(await button.getAttribute("aria-busy"), null);
      assert.equal(
        await button.evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).minHeight) >= 44,
        ),
        true,
      );
    }
    const accountButton = companionWindow.getByRole("button", {
      name: "Account Console",
    });
    await accountButton.focus();
    assert.equal(
      await companionWindow.evaluate(
        () => document.activeElement?.getAttribute("data-console"),
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
    const mainWindow = await application.firstWindow();
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL() === "app://renderer/")
        ?.hide();
    });
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL() === "app://renderer/")
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
          .find((window) => window.webContents.getURL() === "app://renderer/")
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
    await settingsWindow.getByRole("radio", { name: "Dark" }).click();
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
