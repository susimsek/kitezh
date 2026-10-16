import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");

test(
  "live native Admin users: seven tabs and API required-action assignment",
  {
    timeout: 120_000,
  },
  async () => {
    const profile = await mkdtemp(path.join(os.tmpdir(), "kitezh-users-live-"));
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
    let originalAction;
    let userId;
    let restoreNeeded = false;
    const evidence = path.join(
      desktopDirectory,
      "e2e",
      "artifacts",
      "users-live",
    );
    await mkdir(evidence, { recursive: true });
    try {
      await application.evaluate(({ app, BrowserWindow, shell }) => {
        globalThis.__usersLiveRequests = [];
        const realFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (input, init) => {
          const response = await realFetch(input, init);
          const url = new URL(String(input));
          if (url.pathname.startsWith("/api/admin/")) {
            globalThis.__usersLiveRequests.push({
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
      await login.close();
      await window.getByRole("button", { name: "Users", exact: true }).click();
      await window
        .locator('[data-action="admin-user-detail-open"][data-id="1"]')
        .waitFor();
      await window.locator("#admin-user-query").fill("admin");
      await window.waitForFunction(() => {
        const rows = document.querySelectorAll(".admin-user-row");
        return (
          rows.length === 1 &&
          rows[0].textContent.includes("admin") &&
          document
            .querySelector("#admin-user-search")
            ?.getAttribute("aria-busy") === "false"
        );
      });
      assert.equal(
        await window
          .locator("#admin-user-query")
          .evaluate((input) => input === document.activeElement),
        true,
      );
      await window.locator("#admin-user-query").fill("");
      await window.waitForFunction(
        () => document.querySelectorAll(".admin-user-row").length > 1,
      );
      assert.equal(
        await window.locator('[data-action="create-user"]').count(),
        1,
      );
      assert.equal(await window.locator("#admin-user-sort").count(), 1);
      assert.equal(await window.locator("#admin-user-status").count(), 1);
      assert.equal(
        await window.locator(".admin-pagination-control").count(),
        4,
      );
      await window.locator("#admin-user-page-size").selectOption("10");
      await window.waitForFunction(
        () => !document.querySelector("#admin-user-page-size")?.disabled,
      );
      await window.locator('[data-action="admin-user-select-all"]').check();
      assert.equal(
        await window.locator('[data-action="admin-user-bulk-enable"]').count(),
        1,
      );
      assert.equal(
        await window.locator('[data-action="admin-user-bulk-disable"]').count(),
        1,
      );
      assert.equal(
        await window.locator('[data-action="admin-user-bulk-delete"]').count(),
        1,
      );
      await window.locator('[data-action="admin-user-select-all"]').uncheck();
      await window.screenshot({
        path: path.join(evidence, "users.png"),
        fullPage: true,
      });
      await window
        .locator('[data-action="admin-user-detail-open"][data-id="1"]')
        .click();
      userId = 1;
      for (const tab of [
        "details",
        "credentials",
        "roles",
        "groups",
        "sessions",
        "consents",
        "events",
      ]) {
        await window.locator(`[data-tab="${tab}"]`).click();
        await window.waitForFunction((tab) => {
          const button = document.querySelector(`[data-tab="${tab}"]`);
          return button?.classList.contains("is-active") && !button.disabled;
        }, tab);
        await window.screenshot({
          path: path.join(evidence, `${tab}.png`),
          fullPage: true,
        });
        assert.equal(
          await window.locator(".content > .notice.error").count(),
          0,
          `${tab} must load`,
        );
        if (tab === "credentials") {
          const response = await window.evaluate(() =>
            window.desktopApi.api.request({
              console: "admin",
              path: "/api/admin/required-actions/users/1",
            }),
          );
          assert.equal(
            response.status,
            200,
            "GET must pass real main-process allowlist and backend authorization",
          );
          assert.equal(response.body.length, 9);
          assert.equal(
            await window
              .locator('[data-action="admin-user-detail-required-action"]')
              .count(),
            response.body.length,
          );
          const headings = await window
            .locator(".admin-user-credentials-grid > .card h2")
            .allTextContents();
          assert.deepEqual(headings, [
            "Reset password",
            "Passkeys",
            "Required actions",
            "Credential reset",
            "Reset authenticator",
          ]);
          for (const action of response.body) {
            const control = window.locator(
              `[data-action="admin-user-detail-required-action"][data-key="${action.key}"]`,
            );
            assert.equal(
              await control.isEnabled(),
              action.enabled && !action.globalPolicy,
            );
            assert.equal(await control.isChecked(), action.assigned);
          }
          originalAction = response.body.find(
            (action) =>
              action.enabled && !action.globalPolicy && !action.assigned,
          );
          assert.ok(originalAction, "Backend must offer an assignable action");
          const selector = `[data-action="admin-user-detail-required-action"][data-key="${originalAction.key}"]`;
          for (const assigned of [true, false]) {
            restoreNeeded = true;
            await window
              .locator(".admin-user-detail-switch", {
                has: window.locator(selector),
              })
              .click();
            await window.waitForFunction(
              (selector) => !document.querySelector(selector)?.disabled,
              selector,
            );
            const fresh = await window.evaluate(() =>
              window.desktopApi.api.request({
                console: "admin",
                path: "/api/admin/required-actions/users/1",
              }),
            );
            assert.equal(fresh.status, 200);
            assert.equal(
              fresh.body.find((item) => item.key === originalAction.key)
                .assigned,
              assigned,
            );
            assert.equal(await window.locator(selector).isChecked(), assigned);
          }
          restoreNeeded = false;
          await window.screenshot({
            path: path.join(evidence, "credentials.png"),
            fullPage: true,
          });
        }
      }
      const requests = await application.evaluate(
        () => globalThis.__usersLiveRequests,
      );
      for (const method of ["POST", "DELETE"]) {
        assert.ok(
          requests.some(
            (request) =>
              request.path ===
                `/api/admin/required-actions/users/1/${originalAction.key}` &&
              request.method === method &&
              request.status < 300,
          ),
        );
      }
      assert.equal(
        requests.some((request) => request.status >= 400),
        false,
      );
      await writeFile(
        path.join(evidence, "requests.json"),
        JSON.stringify(requests, null, 2) + "\n",
      );
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some((window) => window.isVisible()),
        ),
        false,
      );
      console.log(
        "Live API evidence: 9 actions, seven tabs, POST/DELETE persisted; screenshots:",
        evidence,
      );
    } finally {
      let cleanupError;
      if (window && originalAction && userId && restoreNeeded) {
        try {
          const response = await window.evaluate(
            ({ userId, action }) =>
              window.desktopApi.api.request({
                console: "admin",
                method: action.assigned ? "POST" : "DELETE",
                path: `/api/admin/required-actions/users/${userId}/${action.key}`,
              }),
            { userId, action: originalAction },
          );
          assert.ok(
            response.status < 300,
            "Restore the initial required-action assignment",
          );
        } catch (error) {
          cleanupError = error;
        }
      }
      if (window) {
        try {
          await window.screenshot({
            path: path.join(evidence, "last-state.png"),
            fullPage: true,
          });
        } catch {
          console.warn("Could not capture final Electron screenshot");
        }
      }
      await application.close();
      if (cleanupError) throw cleanupError;
    }
  },
);
