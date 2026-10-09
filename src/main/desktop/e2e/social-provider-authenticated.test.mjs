import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import { _electron as electron } from "playwright-core";

const require = createRequire(import.meta.url);
const desktopDirectory = path.resolve(import.meta.dirname, "..");
const providers = ["github", "linkedin"];

async function waitForBackend() {
  const baseUrl = process.env.DESKTOP_API_BASE_URL ?? "http://localhost:9090";
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/actuator/health/readiness`);
      if (response.ok && (await response.json()).status === "UP") return;
    } catch {
      // The packaged local server may still be starting after a rebuild.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Backend readiness did not become UP before the real provider E2E.");
}

for (const provider of providers) {
  const enabled =
    process.env[`DESKTOP_REAL_${provider.toUpperCase()}_E2E`] === "true";
  test(
    `real ${provider} authentication returns through the Windows protocol handler and persists an account session`,
    { skip: !enabled, timeout: 600_000 },
    async () => {
      await waitForBackend();
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
        let window = application
          .windows()
          .find((page) => page.url() === "app://renderer/native");
        for (let attempt = 0; !window && attempt < 100; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          window = application
            .windows()
            .find((page) => page.url() === "app://renderer/native");
        }
        assert.ok(window, "Native main window must be available");
        await window.waitForLoadState("domcontentloaded");
        await window.evaluate(async () => {
          await window.desktopApi.auth.clearAllSessions();
          await window.desktopApi.language.set("en");
        });
        await application.close();
        application = await launch();
        window = application
          .windows()
          .find((page) => page.url() === "app://renderer/native");
        for (let attempt = 0; !window && attempt < 100; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          window = application
            .windows()
            .find((page) => page.url() === "app://renderer/native");
        }
        assert.ok(
          window,
          "Native main window must be available after clean launch",
        );
        let chooser;
        for (let attempt = 0; !chooser && attempt < 100; attempt += 1) {
          chooser = application
            .windows()
            .find((page) => page.url() === "app://renderer/desktop-login");
          if (!chooser)
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert.ok(chooser, "Visible native console chooser must exist");
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
          `REAL_${provider.toUpperCase()}_WAITING: Complete provider sign-in in the system browser.`,
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
          "Provider callback must establish Account session",
        );
        const proof = await window.evaluate(async (registrationId) => {
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
            providerLinked:
              Array.isArray(links.body) &&
              links.body.some(
                (entry) => entry.provider === registrationId && entry.linked,
              ),
            adminSession: await window.desktopApi.auth.hasSession("admin"),
          };
        }, provider);
        assert.deepEqual(proof, {
          profileStatus: 200,
          linksStatus: 200,
          providerLinked: true,
          adminSession: false,
        });

        await application.close();
        application = await launch();
        window = application
          .windows()
          .find((page) => page.url() === "app://renderer/native");
        for (let attempt = 0; !window && attempt < 100; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          window = application
            .windows()
            .find((page) => page.url() === "app://renderer/native");
        }
        assert.ok(window, "Native main window must be available after restart");
        await window.waitForLoadState("domcontentloaded");
        assert.equal(
          await window.evaluate(() =>
            window.desktopApi.auth.hasSession("account"),
          ),
          true,
        );
        const profileStatus = await window.evaluate(
          async () =>
            (
              await window.desktopApi.api.request({
                console: "account",
                path: "/api/account/profile",
              })
            ).status,
        );
        assert.equal(profileStatus, 200);
        console.info(
          `REAL_${provider.toUpperCase()}_PASS: callback, provider link, Account API, isolated vault, and restart persistence verified.`,
        );
      } finally {
        await application.close();
      }
    },
  );
}
