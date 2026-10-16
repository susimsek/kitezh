import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");

test(
  "live native Admin clients: web comparison, nine tabs, persisted settings and protected clients",
  {
    timeout: 180_000,
  },
  async () => {
    const profile = await mkdtemp(
      path.join(os.tmpdir(), "kitezh-clients-live-"),
    );
    await writeFile(path.join(profile, "desktop-language-mode.json"), "en");
    await writeFile(path.join(profile, "desktop-language.json"), "en");
    const application = await electron.launch({
      args: [`--user-data-dir=${profile}`, desktopDirectory],
      cwd: desktopDirectory,
      env: {
        ...process.env,
        DESKTOP_E2E_BACKGROUND: "true",
        DESKTOP_API_BASE_URL: "http://localhost:9090",
        DESKTOP_AUTO_UPDATE: "false",
      },
    });
    let window;
    let originalClient;
    let restoreNeeded = false;
    const evidence = path.join(
      desktopDirectory,
      "e2e",
      "artifacts",
      "clients-live",
    );
    await mkdir(evidence, { recursive: true });
    try {
      await application.evaluate(({ app, BrowserWindow, shell }) => {
        globalThis.__clientsLiveRequests = [];
        const realFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (input, init) => {
          const url = new URL(String(input));
          if (
            init?.method === "PUT" &&
            url.pathname === "/api/admin/clients/account-console"
          )
            await new Promise((resolve) => setTimeout(resolve, 350));
          const response = await realFetch(input, init);
          if (url.pathname.startsWith("/api/admin/")) {
            globalThis.__clientsLiveRequests.push({
              path: url.pathname + url.search,
              method: init?.method ?? "GET",
              status: response.status,
            });
          }
          return response;
        };
        shell.openExternal = async (url) => {
          const login = new BrowserWindow({
            show: false,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              backgroundThrottling: false,
            },
          });
          const callback = (event, target) => {
            if (!target.startsWith("kitezh://oauth/callback")) return;
            event.preventDefault();
            // Only OS handoff is emulated; login, PKCE, vault, IPC and APIs are real.
            app.emit("open-url", { preventDefault() {} }, target);
          };
          login.webContents.on("will-navigate", callback);
          login.webContents.on("will-redirect", callback);
          await login.loadURL(url);
        };
      });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        window = application
          .windows()
          .find((page) => page.url().startsWith("app://renderer/native"));
        if (window) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(window, "Real native renderer must open");
      await window
        .getByRole("button", { name: "Administration Console", exact: true })
        .click();
      let login;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const browserWindow = application
          .windows()
          .find((page) =>
            /^http:\/\/(localhost|127\.0\.0\.1):9090\//.test(page.url()),
          );
        if (browserWindow) {
          login = browserWindow;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(
        login,
        "Backend login must open; available window paths: " +
          application
            .windows()
            .map((page) => new URL(page.url()).pathname)
            .join(", "),
      );
      await login.locator('input[name="username"]').fill("admin");
      await login.locator('input[name="password"]').fill("admin");
      await login.getByRole("button", { name: /Sign in|Giriş/i }).click();
      await window
        .getByRole("heading", { name: "Dashboard", exact: true })
        .waitFor();
      await application.evaluate(({ BrowserWindow }) => {
        for (const win of BrowserWindow.getAllWindows())
          win.setContentSize(1440, 1000);
      });
      const screenshot = async (page, name) => {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const png = await application.evaluate(
          async ({ BrowserWindow }, url) => {
            const win = BrowserWindow.getAllWindows().find(
              (win) => win.webContents.getURL() === url,
            );
            if (!win || win.isVisible())
              throw new Error("Capture requires a hidden test window");
            for (let attempt = 0; attempt < 4; attempt++) {
              const captured = await win.webContents.capturePage(undefined, {
                stayHidden: true,
              });
              const pixels = captured.toBitmap();
              let varied = false;
              for (let offset = 0; offset < pixels.length; offset += 124) {
                if (
                  pixels[offset] !== pixels[0] ||
                  pixels[offset + 1] !== pixels[1] ||
                  pixels[offset + 2] !== pixels[2]
                ) {
                  varied = true;
                  break;
                }
              }
              if (varied) return captured.toPNG().toString("base64");
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
            throw new Error("Background capture contains no rendered content");
          },
          page.url(),
        );
        await writeFile(path.join(evidence, name), Buffer.from(png, "base64"));
      };
      const api = (path, method = "GET", body) =>
        window.evaluate(
          ({ path, method, body }) =>
            globalThis.desktopApi.api.request({
              console: "admin",
              path,
              method,
              body,
            }),
          { path, method, body },
        );
      originalClient = (await api("/api/admin/clients/account-console")).body;
      assert.equal(originalClient.clientId, "account-console");
      const originalList = (
        await api("/api/admin/clients?page=0&size=10&sort=clientId,asc")
      ).body;
      const expectedIds = originalList.content.map((client) => client.clientId);
      await window.locator('.sidebar [data-route="clients"]').click();
      await window
        .locator(".client-table tbody tr[data-client-id]")
        .first()
        .waitFor();
      assert.deepEqual(
        await window.locator(".client-table .client-id").allTextContents(),
        expectedIds,
      );
      assert.doesNotMatch(
        await window.locator(".admin-users-pagination").textContent(),
        /Page 0/,
      );
      assert.equal(await window.locator(".client-table th").count(), 5);
      await screenshot(window, "desktop-clients-light-en.png");
      await login.goto("http://localhost:9090/admin/clients");
      await login.waitForSelector(
        'a[href="/admin/clients/account-console/settings"]',
      );
      const webIds = await login
        .locator("tbody .font-monospace")
        .allTextContents();
      assert.deepEqual(webIds, expectedIds);
      await screenshot(login, "web-clients-light-en.png");
      await window.locator('.client-name [data-id="account-console"]').click();
      await window
        .locator('[data-form="admin-client-configuration"]')
        .waitFor();
      assert.equal(
        await window.locator('[data-action="client-tab"]').count(),
        9,
      );
      assert.equal(
        await window
          .locator('[data-action="admin-client-delete-request"]')
          .count(),
        0,
      );
      await screenshot(window, "desktop-client-settings-light-en.png");
      await login.goto(
        "http://localhost:9090/admin/clients/account-console/settings",
      );
      await login
        .getByRole("heading", { name: "Account Console", exact: true })
        .waitFor();
      await screenshot(login, "web-client-settings-light-en.png");
      const form = window.locator('[data-form="admin-client-configuration"]');
      const changedName = `${originalClient.clientName} verification`;
      await form.locator('[name="clientName"]').fill(changedName);
      restoreNeeded = true;
      const save = form.getByRole("button", { name: "Save", exact: true });
      await save.click();
      assert.equal(await save.isDisabled(), true);
      assert.equal(await save.locator(".spinner").count(), 1);
      assert.equal(await save.textContent(), "Save");
      await save.dispatchEvent("click");
      await window.waitForFunction(
        () =>
          !document.querySelector(
            '[data-form="admin-client-configuration"] button[type="submit"]',
          )?.disabled,
      );
      const saveErrors = await window
        .locator(".notice.error, .client-settings-form .field-error")
        .allTextContents();
      assert.equal(
        saveErrors.filter((value) => value.trim()).length,
        0,
        saveErrors.join(" | "),
      );
      assert.equal(
        (await api("/api/admin/clients/account-console")).body.clientName,
        changedName,
      );
      await window.locator('[data-action="client-back"]').click();
      await window.locator('.client-name [data-id="account-console"]').click();
      await form.waitFor();
      assert.equal(
        await form.locator('[name="clientName"]').inputValue(),
        changedName,
      );
      for (const tab of [
        "credentials",
        "scopes",
        "roles",
        "mappers",
        "evaluation",
        "sessions",
        "consents",
        "events",
        "settings",
      ]) {
        await window
          .locator(`[data-action="client-tab"][data-id="${tab}"]`)
          .click();
        await window.waitForFunction(
          (tab) =>
            !document.querySelector(
              `[data-action="client-tab"][data-id="${tab}"]`,
            )?.disabled,
          tab,
        );
        assert.equal(await window.locator(".notice.error").count(), 0, tab);
      }
      await window
        .locator('[data-action="client-tab"][data-id="evaluation"]')
        .click();
      await window.locator('[data-form="client-evaluation"]').waitFor();
      await window
        .locator('[data-form="client-evaluation"] [name="scopes"]')
        .fill("openid profile");
      await window
        .locator('[data-form="client-evaluation"] button[type="submit"]')
        .click();
      await window.locator(".client-facts").waitFor();
      await window.locator('[data-action="client-back"]').click();
      await window.locator('.client-name [data-id="admin-console"]').click();
      await window.locator("fieldset.client-readonly[disabled]").waitFor();
      assert.equal(
        await window
          .locator(
            '[data-form="admin-client-configuration"] button[type="submit"]',
          )
          .count(),
        0,
      );
      assert.equal(
        await window
          .locator('[data-action="admin-client-delete-request"]')
          .count(),
        0,
      );
      await window.locator('[data-action="client-back"]').click();
      await window.locator("#admin-client-query").fill("account-console");
      await window.waitForFunction(
        () =>
          document.querySelectorAll(".client-table tbody tr[data-client-id]")
            .length === 3,
      );
      await window
        .locator("#admin-client-sort")
        .selectOption("clientName,desc");
      await window.waitForFunction(
        () => !document.querySelector("#admin-client-sort")?.disabled,
      );
      const queryList = (
        await api(
          "/api/admin/clients?q=account-console&page=0&size=10&sort=clientName,desc",
        )
      ).body;
      assert.deepEqual(
        await window.locator(".client-table .client-id").allTextContents(),
        queryList.content.map((client) => client.clientId),
      );
      await window.locator('[data-action="client-clear-search"]').click();
      await window.waitForFunction(
        (count) =>
          document.querySelectorAll(".client-table tbody tr[data-client-id]")
            .length === count,
        expectedIds.length,
      );
      await window.evaluate(() => globalThis.desktopApi.theme.set("dark"));
      await window.waitForFunction(
        () => document.documentElement.dataset.theme === "dark",
      );
      await screenshot(window, "desktop-clients-dark-en.png");
      await login.evaluate(() => localStorage.setItem("AUTH_THEME", "dark"));
      await login.goto("http://localhost:9090/admin/clients");
      await login.waitForSelector(
        'a[href="/admin/clients/account-console/settings"]',
      );
      await screenshot(login, "web-clients-dark-en.png");
      await window.evaluate(() => globalThis.desktopApi.language.set("tr"));
      await window
        .locator("#admin-client-sort option:checked")
        .filter({ hasText: "İstemci adı" })
        .waitFor({ state: "attached" });
      await window.evaluate(() => globalThis.desktopApi.theme.set("dark"));
      await window.waitForFunction(
        () => document.documentElement.dataset.theme === "dark",
      );
      await screenshot(window, "desktop-clients-dark-tr.png");
      await window.evaluate(() => globalThis.desktopApi.theme.set("light"));
      await window.waitForFunction(
        () => document.documentElement.dataset.theme === "light",
      );
      await window.waitForFunction(
        () =>
          document.querySelector('[data-action="create-client"]')?.disabled ===
          false,
      );
      await window.locator("#admin-client-sort").selectOption("clientId,asc");
      await window.waitForFunction(
        () =>
          document.querySelector('[data-action="create-client"]')?.disabled ===
            false &&
          document.querySelector(".client-table tbody tr")?.dataset.clientId ===
            "account-console",
      );
      await screenshot(window, "desktop-clients-light-tr.png");
      await window.evaluate(() => globalThis.desktopApi.theme.set("dark"));
      await window.waitForFunction(
        () => document.documentElement.dataset.theme === "dark",
      );
      await application.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((win) =>
          win.webContents.getURL().startsWith("app://renderer/native"),
        );
        win.setContentSize(900, 800);
        win.webContents.setZoomFactor(2);
      });
      await screenshot(window, "desktop-clients-200pct-tr.png");
      await window.locator('.client-name [data-id="account-console"]').click();
      await form.waitFor();
      assert.equal(
        await window.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await screenshot(window, "desktop-client-settings-200pct-tr.png");
      await window.emulateMedia({
        forcedColors: "active",
        reducedMotion: "reduce",
      });
      await form.locator('[name="clientName"]').focus();
      assert.equal(
        await form
          .locator('[name="clientName"]')
          .evaluate((input) => input === document.activeElement),
        true,
      );
      assert.notEqual(
        await form
          .locator('[name="clientName"]')
          .evaluate((input) => getComputedStyle(input).outlineStyle),
        "none",
      );
      await screenshot(window, "desktop-client-settings-high-contrast.png");
      assert.equal(await window.locator(".client-readonly").count(), 0);
      const requests = await application.evaluate(
        () => globalThis.__clientsLiveRequests,
      );
      assert.equal(
        requests.some((request) => request.status >= 400),
        false,
      );
      assert.equal(
        requests.filter(
          (request) =>
            request.path === "/api/admin/clients/account-console" &&
            request.method === "PUT",
        ).length,
        1,
      );
      await writeFile(
        path.join(evidence, "requests.json"),
        JSON.stringify(requests, null, 2) + "\n",
      );
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some((win) => win.isVisible()),
        ),
        false,
      );
    } finally {
      let cleanupError;
      if (window && originalClient && restoreNeeded) {
        try {
          const restored = await window.evaluate(
            (original) =>
              globalThis.desktopApi.api.request({
                console: "admin",
                method: "PUT",
                path: "/api/admin/clients/account-console",
                body: {
                  ...original,
                  cibaClientNotificationToken: "",
                  clientSecretGracePeriod: null,
                },
              }),
            originalClient,
          );
          assert.ok(restored.status < 300, "Restore account-console settings");
        } catch (error) {
          cleanupError = error;
        }
      }
      if (window) {
        const requests = await application.evaluate(
          () => globalThis.__clientsLiveRequests,
        );
        await writeFile(
          path.join(evidence, "requests.json"),
          JSON.stringify(requests, null, 2) + "\n",
        );
        await window.evaluate(() => globalThis.scrollTo(0, 0));
        await window
          .screenshot({
            path: path.join(evidence, "last-state-full.png"),
            fullPage: true,
          })
          .catch(() => {});
      }
      if (window)
        await window
          .screenshot({ path: path.join(evidence, "last-state.png") })
          .catch(() => {});
      await application.close();
      if (cleanupError) throw cleanupError;
    }
  },
);
