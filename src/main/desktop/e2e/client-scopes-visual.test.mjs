import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const require = createRequire(import.meta.url);
const { messages } = require("@kitezh/shared/i18n");
const { desktopIconMetadata } = require("@kitezh/shared/icons");
const desktop = path.resolve(import.meta.dirname, "..");
const baseline = process.env.KITEZH_SCOPE_BASELINE === "true";
const evidence = path.join(desktop, "e2e/artifacts/client-scopes");
const scopes = [
  {
    id: "account-api",
    name: "account-api",
    displayName: "Account API",
    description:
      "Hesap konsolundan profil, güvenlik ve oturum bilgilerine erişim.",
    builtIn: true,
  },
  {
    id: "admin-api",
    name: "admin-api",
    displayName: "Administration API",
    description: "Yönetim konsolu kaynaklarına yetkiye bağlı erişim.",
    builtIn: true,
  },
  {
    id: "user-read",
    name: "user.read",
    displayName:
      "Kullanıcı bilgilerini görüntüleme ve kuruluş üyeliklerini inceleme",
    description:
      "Uzun Türkçe açıklama: kullanıcıların hesap bilgileri, kuruluş üyelikleri ve kendilerine atanmış uygulama izinleri güvenli biçimde görüntülenir; bu kapsam istemcilere atanarak erişim sınırlandırılır.",
    builtIn: false,
  },
  ...["email", "openid", "phone", "profile", "address", "offline_access"].map(
    (name) => ({
      id: name,
      name,
      displayName: name,
      description: `${name} bilgilerine erişim.`,
      builtIn: true,
    }),
  ),
];

// A hidden Electron fixture exercises the actual compiled native renderer. Only
// the IPC boundary is replaced; no production authentication bypass is added.
async function launchFixture() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-scopes-visual-"),
  );
  await writeFile(
    path.join(directory, "bootstrap.json"),
    JSON.stringify({
      locale: "tr",
      theme: "light",
      messages,
      icons: desktopIconMetadata,
    }),
  );
  await writeFile(path.join(directory, "scopes.json"), JSON.stringify(scopes));
  await writeFile(
    path.join(directory, "preload.cjs"),
    `
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('__KITEZH_NATIVE_BOOTSTRAP__', ipcRenderer.sendSync('bootstrap'));
    contextBridge.exposeInMainWorld('desktopApi', {
      api: { request: (request) => ipcRenderer.invoke('request', request) },
      auth: { hasSession: async (console) => console === 'admin' ? { authenticated: true } : null,
        start: async () => ({}), logout: async () => ({}),
        socialLink: { onCallback() {} } },
      theme: { onChanged: (listener) => ipcRenderer.on('theme', (_, theme) => listener(theme)) },
      language: { set: async () => {}, onChanged() {} },
      onAuthCallback() {}, onMenuLogout() {}
    });
  `,
  );
  await writeFile(
    path.join(directory, "main.cjs"),
    `
    const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
    const path = require('node:path');
    const { pathToFileURL } = require('node:url');
    protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
    let scopes = require('./scopes.json');
    globalThis.requests = [];
    ipcMain.on('bootstrap', event => { event.returnValue = require('./bootstrap.json'); });
    ipcMain.handle('request', async (_, request) => {
      const url = new URL(request.path, 'https://fixture.invalid');
      globalThis.requests.push(request);
      await new Promise(resolve => setTimeout(resolve, 80));
      let body = {};
      if (url.pathname.endsWith('/whoami')) body = { access: Object.fromEntries(${JSON.stringify(["isAdmin", "queryUsers", "viewUsers", "manageUsers", "viewRoles", "manageRoles", "queryGroups", "viewGroups", "manageGroups", "queryClients", "viewClients", "manageClients", "viewSessions", "manageSessions", "viewConsents", "manageConsents", "viewEvents", "manageEvents", "viewKeys", "manageKeys"])}.map(key => [key, true])) };
      else if (url.pathname === '/api/admin/client-scopes' && request.method === 'POST') {
        body = { ...request.body, id: request.body.name, builtIn: false }; scopes.push(body);
      } else if (url.pathname === '/api/admin/client-scopes') {
        const q = url.searchParams.get('q') || '';
        const content = scopes.filter(scope => scope.name.includes(q));
        if (url.searchParams.get('sort') === 'name,desc') content.sort((a,b) => b.name.localeCompare(a.name));
        body = { content, number: 0, size: 20, totalPages: 1, totalElements: content.length };
      } else if (/\\/client-scopes\\/[^/]+$/.test(url.pathname)) {
        const id = url.pathname.split('/').pop();
        body = scopes.find(scope => scope.id === id);
        if (request.method === 'PUT') Object.assign(body, request.body);
        if (request.method === 'DELETE') scopes = scopes.filter(scope => scope.id !== id);
      }
      return { status: 200, body };
    });
    app.whenReady().then(async () => {
      protocol.handle('app', request => {
        const pathname = new URL(request.url).pathname;
        const name = pathname.endsWith('renderer.mjs') ? 'renderer.mjs' : pathname.includes('/brand/') ? 'brand/' + path.basename(pathname) : 'native.html';
        return net.fetch(pathToFileURL(path.join(${JSON.stringify(path.join(desktop, "dist/native"))}, name)).href);
      });
      const window = new BrowserWindow({ show: false, width: 1280, height: 900,
        webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
          nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
      await window.loadURL('app://renderer/native/native.html?console=admin');
    });
  `,
  );
  return electron.launch({
    args: [path.join(directory, "main.cjs")],
    env: { ...process.env, DESKTOP_E2E_BACKGROUND: "true" },
  });
}

async function capture(application, file) {
  const page = application.windows()[0];
  await page.locator(".loading").waitFor({ state: "hidden" });
  if (!baseline) {
    const target = file.includes("-create-")
      ? '[data-form="admin-client-scope-create"]'
      : file.includes("-detail-")
        ? ".scope-detail-panel"
        : ".scope-panel";
    await page.locator(target).waitFor();
    if (file.includes("200-percent"))
      await page
        .locator(target)
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
  }
  const png = await application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window.isVisible())
      throw new Error("Acceptance windows must remain hidden");
    await window.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    return (await window.webContents.capturePage()).toPNG().toString("base64");
  });
  await writeFile(path.join(evidence, file), Buffer.from(png, "base64"));
}

test(
  "native client scopes visual and keyboard acceptance",
  { timeout: 120_000 },
  async () => {
    await mkdir(evidence, { recursive: true });
    const application = await launchFixture();
    try {
      const page = await application.firstWindow();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.locator('[data-route="client-scopes"]').click();
      await page.locator('[data-client-scope-id="account-api"]').waitFor();
      if (baseline) {
        await capture(application, "before-light-1280x900.png");
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.send("theme", "dark"),
        );
        await page.waitForFunction(
          () => document.documentElement.dataset.theme === "dark",
        );
        await capture(application, "before-dark-1280x900.png");
        return;
      }
      for (const theme of ["light", "dark"]) {
        await application.evaluate(
          ({ BrowserWindow }, theme) =>
            BrowserWindow.getAllWindows()[0].webContents.send("theme", theme),
          theme,
        );
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          theme,
        );
        await capture(application, `after-list-${theme}-1280x900.png`);
        const firstMenu = page.locator(
          '[data-client-scope-id="user-read"] summary',
        );
        await firstMenu.press("Enter");
        await capture(application, `after-menu-${theme}-1280x900.png`);
        await firstMenu.press("Escape");
        const link = page.locator('[data-client-scope-id="account-api"] a');
        await link.focus();
        await capture(application, `after-focus-${theme}-1280x900.png`);
        await page.keyboard.press("Enter");
        await page
          .locator('[data-client-scope-detail="account-api"]')
          .waitFor();
        assert.equal(
          await page.evaluate(() => document.activeElement.tagName),
          "H1",
        );
        await capture(application, `after-detail-${theme}-1280x900.png`);
        assert.equal(
          await page.locator('[data-form="admin-client-scope-edit"]').count(),
          0,
        );
        await page.locator('[data-action="client-scope-back"]').first().click();
        await page.locator('[data-action="create-client-scope"]').click();
        await page.locator('[data-form="admin-client-scope-create"]').waitFor();
        assert.equal(
          await page.evaluate(() => document.activeElement.name),
          "name",
        );
        await capture(application, `after-create-${theme}-1280x900.png`);
        await page.locator('[data-action="client-scope-back"]').first().click();
      }
      // Keyboard disclosure, Escape focus restoration, custom-scope edit and save.
      const summary = page.locator(
        '[data-client-scope-id="user-read"] summary',
      );
      await summary.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      assert.equal(
        await summary.evaluate(
          (element) =>
            element === document.activeElement && !element.parentElement.open,
        ),
        true,
      );
      await summary.press("Enter");
      await page
        .locator('[data-action="client-scope-edit"][data-id="user-read"]')
        .click();
      await page
        .locator('input[name="displayName"]')
        .fill(
          "Uzun Türkçe görüntüleme adı: kullanıcıların kuruluş ve uygulama erişim izinleri",
        );
      await page
        .locator('[data-form="admin-client-scope-edit"] button[type="submit"]')
        .click();
      await page
        .locator(
          '[data-form="admin-client-scope-edit"] button[type="submit"]:not(:disabled)',
        )
        .waitFor();
      await page.locator('[data-action="client-scope-back"]').first().click();
      // Search and sorting are submitted by Enter with pending submission protection.
      await page.locator("#admin-client-scope-query").fill("user");
      await page.locator("#admin-client-scope-sort").selectOption("name,desc");
      await page.locator("#admin-client-scope-query").press("Enter");
      await page
        .locator("#admin-client-scope-search button:disabled")
        .waitFor();
      await page
        .locator("#admin-client-scope-search button:not(:disabled)")
        .waitFor();
      const requests = await application.evaluate(() => globalThis.requests);
      assert.ok(
        requests.some(
          (request) =>
            request.path.includes("q=user") &&
            request.path.includes("sort=name%2Cdesc"),
        ),
      );
      await page.locator("#admin-client-scope-query").fill("");
      await page.locator("#admin-client-scope-query").press("Enter");
      await page.locator('[data-client-scope-id="account-api"]').waitFor();
      for (const theme of ["light", "dark"]) {
        await application.evaluate(({ BrowserWindow }, theme) => {
          const contents = BrowserWindow.getAllWindows()[0].webContents;
          contents.send("theme", theme);
          contents.setZoomFactor(2);
        }, theme);
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          theme,
        );
        await capture(application, `after-list-${theme}-200-percent.png`);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.locator('[data-client-scope-id="user-read"] a').click();
        await page.locator('[data-client-scope-detail="user-read"]').waitFor();
        await capture(application, `after-detail-${theme}-200-percent.png`);
        await page.locator('[data-action="client-scope-back"]').first().click();
        await page.locator('[data-action="create-client-scope"]').click();
        await page.locator('[data-form="admin-client-scope-create"]').waitFor();
        assert.equal(
          await page.evaluate(() => document.activeElement.name),
          "name",
        );
        await page
          .locator('input[name="displayName"]')
          .fill("Uzun Türkçe görüntüleme adı: kullanıcı ve kuruluş üyelikleri");
        await capture(application, `after-create-${theme}-200-percent.png`);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.locator('[data-action="client-scope-back"]').first().click();
      }
      await page.emulateMedia({
        forcedColors: "active",
        reducedMotion: "reduce",
      });
      await capture(application, "after-high-contrast-200-percent.png");
      assert.deepEqual(errors, []);
    } finally {
      await application.close();
    }
  },
);
