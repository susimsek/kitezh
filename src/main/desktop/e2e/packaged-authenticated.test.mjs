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
      .find((candidate) => candidate.url() === "app://renderer/native");
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

test("completes authenticated PKCE login in the packaged Windows app", async () => {
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-packaged-auth-e2e-"),
  );
  await writeFile(
    path.join(userDataDirectory, "desktop-language-mode.json"),
    "en",
  );
  await writeFile(path.join(userDataDirectory, "desktop-language.json"), "en");

  const application = await electron.launch({
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
    const mainWindow = await nativeMainWindow(application);
    await mainWindow
      .getByRole("heading", { name: "Choose a console" })
      .waitFor();
    await mainWindow.getByRole("button", { name: "Account Console" }).click();

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
  } finally {
    await application.close();
  }
});
