import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import { _electron as electron } from "playwright-core";

const require = createRequire(import.meta.url);
const desktopDirectory = path.resolve(import.meta.dirname, "..");

async function mainWindow(application) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const window = application
      .windows()
      .find((page) => page.url() === "app://renderer/native");
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Native main window did not become available");
}

// Opt-in, user-assisted real provider test. Do not replace shell.openExternal,
// inject callbacks, capture authorization URLs, or print profile/token values.
test(
  "real Google login persists the account session and logout returns through the Windows protocol handler",
  {
    skip: process.env.DESKTOP_REAL_GOOGLE_E2E !== "true",
    timeout: 600_000,
  },
  async () => {
    const launch = () =>
      electron.launch({
        executablePath: require("electron"),
        args: [desktopDirectory],
        cwd: desktopDirectory,
        env: {
          ...process.env,
          DESKTOP_API_BASE_URL: "http://localhost:9090",
          DESKTOP_AUTO_UPDATE: "false",
        },
      });
    let application = await launch();
    try {
      let window = await mainWindow(application);
      await window.waitForLoadState("domcontentloaded");
      await window.evaluate(async () => {
        await window.desktopApi.auth.clearAllSessions();
        await window.desktopApi.language.set("en");
      });
      // Relaunch without a vault session and use the visible native chooser,
      // rather than clicking the hidden main window used by older harnesses.
      await application.close();
      application = await launch();
      window = await mainWindow(application);
      let chooser;
      for (let attempt = 0; attempt < 100 && !chooser; attempt += 1) {
        chooser = application
          .windows()
          .find((page) => page.url() === "app://renderer/desktop-login");
        if (!chooser) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(chooser, "Visible native login chooser must exist");
      await chooser
        .getByRole("button", {
          name: "Sign in to Account Console",
          exact: true,
        })
        .click();
      const signIn = window.getByRole("button", {
        name: "Sign in",
        exact: true,
      });
      await signIn.waitFor();
      assert.equal(await signIn.isEnabled(), false);
      assert.equal(await signIn.locator(".spinner").count(), 1);
      console.info(
        "REAL_GOOGLE_WAITING: Complete Google sign-in in the system browser.",
      );
      let authenticated = false;
      const deadline = Date.now() + 300_000;
      while (Date.now() < deadline) {
        authenticated = await window.evaluate(() =>
          window.desktopApi.auth.hasSession("account"),
        );
        if (authenticated) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(
        authenticated,
        true,
        "Real Google callback did not establish an account session",
      );
      const proof = await window.evaluate(async () => {
        const profile = await window.desktopApi.api.request({
          console: "account",
          path: "/api/account/profile",
        });
        const links = await window.desktopApi.api.request({
          console: "account",
          path: "/api/account/social-links",
        });
        return {
          profileStatus: profile.status,
          linksStatus: links.status,
          googleLinked:
            Array.isArray(links.body) &&
            links.body.some(
              (entry) => entry.provider === "google" && entry.linked,
            ),
          adminSession: await window.desktopApi.auth.hasSession("admin"),
        };
      });
      assert.deepEqual(proof, {
        profileStatus: 200,
        linksStatus: 200,
        googleLinked: true,
        adminSession: false,
      });
      console.info(
        "REAL_GOOGLE_CALLBACK_PASS: Google link and account API verified; no admin session.",
      );
      await application.close();
      application = await launch();
      window = await mainWindow(application);
      await window.waitForLoadState("domcontentloaded");
      assert.equal(
        await window.evaluate(() =>
          window.desktopApi.auth.hasSession("account"),
        ),
        true,
      );
      const status = await window.evaluate(
        async () =>
          (
            await window.desktopApi.api.request({
              console: "account",
              path: "/api/account/profile",
            })
          ).status,
      );
      assert.equal(status, 200);
      console.info(
        "REAL_GOOGLE_RESTART_PASS: Encrypted session survived Electron restart.",
      );
      await application.evaluate(({ app }) => {
        globalThis.__googleLogoutCallback = false;
        app.on("second-instance", (_event, argv) => {
          if (argv.includes("kitezh://logout/callback")) {
            globalThis.__googleLogoutCallback = true;
          }
        });
      });
      await window.locator('button[data-action="logout"]').first().click();
      console.info(
        "REAL_GOOGLE_LOGOUT_WAITING: Accept the browser open-app prompt if shown.",
      );
      const logoutDeadline = Date.now() + 120_000;
      let returned = false;
      while (Date.now() < logoutDeadline) {
        returned = await application.evaluate(
          () => globalThis.__googleLogoutCallback === true,
        );
        if (returned) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(returned, true, "Real logout OS callback did not return");
      assert.equal(
        await window.evaluate(() =>
          window.desktopApi.auth.hasSession("account"),
        ),
        false,
      );
      await window.reload();
      await window
        .getByRole("button", { name: "Account Console", exact: true })
        .waitFor();
      assert.equal(
        await window.locator('button[data-action="logout"]').count(),
        0,
      );
      assert.equal(
        await window.evaluate(() =>
          window.desktopApi.auth.hasSession("account"),
        ),
        false,
      );
      console.info(
        "REAL_GOOGLE_LOGOUT_PASS: Actual OS callback returned; vault remains empty after reload.",
      );
    } finally {
      await application.close();
    }
  },
);
