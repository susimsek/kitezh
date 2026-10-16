import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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
    ...(process.arch === "arm64"
      ? [
          "mac-arm64/Kitezh.app/Contents/MacOS/Kitezh",
          "mac/Kitezh.app/Contents/MacOS/Kitezh",
        ]
      : [
          "mac/Kitezh.app/Contents/MacOS/Kitezh",
          "mac-x64/Kitezh.app/Contents/MacOS/Kitezh",
        ]),
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
if (process.platform === "darwin") {
  const appContents = path.resolve(path.dirname(executablePath), "..");
  const electronResources = path.join(
    appContents,
    "Frameworks",
    "Electron Framework.framework",
    "Versions",
    "A",
    "Resources",
  );
  const packagedLocales = (
    await readdir(electronResources, {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".lproj"))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(
    packagedLocales,
    ["en.lproj", "tr.lproj"],
    "Packaged Electron should retain English and Turkish locale resources",
  );
}
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
      DESKTOP_E2E_BACKGROUND: "true",
      DESKTOP_API_BASE_URL: "http://127.0.0.1:9090",
      DESKTOP_AUTO_UPDATE: "false",
      DESKTOP_DEVTOOLS: "false",
    },
    executablePath,
  });
  const window = await application.firstWindow();
  await window
    .getByRole("heading", { name: /Choose a console|Bir konsol seçin/ })
    .waitFor({ timeout: 20_000 });
  assert.match(
    await window.url(),
    /^app:\/\/renderer\/(?:native|desktop-login)$/,
    "Packaged app should open its signed-out entry screen",
  );
  assert.equal(await window.evaluate(() => window.desktopApi?.isDesktop), true);
  const config = await window.evaluate(() => window.desktopApi?.getConfig());
  assert.equal(config.apiBaseUrl, "http://127.0.0.1:9090");
  assert.equal(config.protocol, "kitezh");
  assert.equal(config.appVersion, packageJson.version);
  assert.ok(["darwin", "win32", "linux"].includes(config.os));
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
  const aboutWindowPromise = application.waitForEvent("window");
  await application.evaluate(({ Menu }) => {
    const about = Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(
      (item) => /^(About Kitezh|Kitezh hakkında)$/.test(item.label),
    );
    if (!about) throw new Error("Packaged About menu is missing");
    about.click();
  });
  const aboutWindow = await aboutWindowPromise;
  await aboutWindow.getByRole("heading", { name: "Kitezh" }).waitFor();
  const brandingImages = await aboutWindow
    .locator('img[alt$=" logo"], img.desktop-sign-in-logo')
    .evaluateAll((images) =>
      images.map((image) => ({
        alt: image.alt,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        source: image.currentSrc,
      })),
    );
  assert.ok(
    brandingImages.length > 0 &&
      brandingImages.every((image) => image.complete && image.naturalWidth > 0),
    `Packaged Kitezh branding assets should load: ${JSON.stringify(
      brandingImages,
    )}`,
  );
  await aboutWindow.close();

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
  assert.equal(
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().every(
        (window) => !window.isVisible() && !window.isFocused(),
      ),
    ),
    true,
    "Packaged smoke windows must remain hidden and unfocused",
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
