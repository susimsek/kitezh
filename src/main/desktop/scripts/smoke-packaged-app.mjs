import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  await readFile(path.join(desktopDirectory, "package.json"), "utf8"),
);
const releaseDirectory = path.join(desktopDirectory, "release");
const packagedAppPaths = {
  darwin: [
    `mac-${process.arch}/Kitezh.app/Contents/MacOS/Kitezh`,
    "mac-universal/Kitezh.app/Contents/MacOS/Kitezh",
  ],
  linux: [
    "linux-unpacked/kitezh",
    "linux-unpacked/kitezh-desktop",
    `linux-${process.arch}-unpacked/kitezh`,
    `linux-${process.arch}-unpacked/kitezh-desktop`,
  ],
  win32: ["win-unpacked/Kitezh.exe", `win-${process.arch}-unpacked/Kitezh.exe`],
};

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    const fullPath = path.join(releaseDirectory, candidate);
    try {
      await access(fullPath);
      return fullPath;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    `No packaged Kitezh executable found for ${process.platform}.`,
  );
}

const executablePath = await firstExistingPath(
  packagedAppPaths[process.platform] ?? [],
);
const userDataDirectory = await mkdtemp(
  path.join(os.tmpdir(), "kitezh-packaged-smoke-"),
);
let application;

try {
  application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`],
    cwd: desktopDirectory,
    env: {
      ...process.env,
      DESKTOP_API_BASE_URL: "https://kitezh-smoke.invalid",
      DESKTOP_AUTO_UPDATE: "false",
      DESKTOP_DEVTOOLS: "false",
    },
    executablePath,
  });
  const window = await application.firstWindow();
  await window
    .getByRole("heading", { name: "Choose a console" })
    .waitFor({ timeout: 20_000 });
  assert.match(
    await window.url(),
    /^app:\/\/renderer\/(?:desktop-login)?$/,
    "Packaged app should open its signed-out entry screen",
  );
  assert.equal(await window.evaluate(() => window.desktopApi?.isDesktop), true);
  assert.deepEqual(
    await window.evaluate(() => window.desktopApi?.getConfig()),
    {
      apiBaseUrl: "https://kitezh-smoke.invalid",
      protocol: "kitezh",
    },
  );
  assert.equal(
    await window.evaluate(() => window.desktopApi?.getAppVersion()),
    packageJson.version,
  );
  assert.ok(
    ["available", "unavailable"].includes(
      await window.evaluate(() => window.desktopApi?.auth.getStorageStatus()),
    ),
    "Packaged secure storage should report an explicit platform status",
  );
  assert.ok(
    await window
      .locator('img[aria-hidden="true"]')
      .evaluateAll(
        (images) =>
          images.length > 0 &&
          images.every((image) => image.complete && image.naturalWidth > 0),
      ),
    "Packaged Kitezh branding assets should load",
  );

  const settingsWindowPromise = application.waitForEvent("window");
  const settingsOpened = await application.evaluate(({ Menu }) => {
    const settings = Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(
      (item) => item.label === "Settings…" || item.label === "Ayarlar…",
    );
    settings?.click();
    return Boolean(settings);
  });
  assert.equal(
    settingsOpened,
    true,
    "Packaged settings menu should be available",
  );
  const settingsWindow = await settingsWindowPromise;
  await settingsWindow
    .getByRole("heading", { name: /Settings|Ayarlar/ })
    .waitFor();
  await settingsWindow
    .getByRole("button", { name: /Diagnostics|Tanı bilgileri/ })
    .click();
  const diagnostics = await settingsWindow
    .locator("#desktop-diagnostics")
    .evaluate((element) => JSON.parse(element.textContent));
  assert.deepEqual(
    Object.keys(diagnostics).sort(),
    [
      "apiHost",
      "appVersion",
      "architecture",
      "autoUpdatesSupported",
      "chromeVersion",
      "electronVersion",
      "events",
      "nodeVersion",
      "packaged",
      "platform",
      "secureStorage",
    ],
    "Packaged diagnostics should expose only the reviewed safe fields",
  );
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /access[_-]?token|refresh[_-]?token|authorization code|@[a-z0-9.-]+\.[a-z]{2,}|\/Users\/|\/home\//i,
    "Packaged diagnostics should not contain credentials or personal data",
  );
  console.log(`Packaged Kitezh ${packageJson.version} smoke test passed.`);
} finally {
  if (application) await application.close();
  await rm(userDataDirectory, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 500,
  });
}
