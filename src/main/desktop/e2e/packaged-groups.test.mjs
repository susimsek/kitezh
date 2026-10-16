import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
const executablePath =
  process.env.DESKTOP_GROUPS_EXECUTABLE ??
  path.join(desktopDirectory, "release", "win-unpacked", "Kitezh.exe");
const evidence = path.join(desktopDirectory, "e2e", "artifacts", "groups");
async function request(window, method, route, body) {
  const response = await window.evaluate(
    (input) => window.desktopApi.api.request({ console: "admin", ...input }),
    { method, path: route, ...(body ? { body } : {}) },
  );
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${method} ${route}: ${response.status} ${response.body?.errorCode ?? ""}`,
  );
  return response.body;
}
async function launch(username = "admin", password = "admin") {
  const profile = await mkdtemp(path.join(os.tmpdir(), "kitezh-groups-e2e-"));
  await writeFile(path.join(profile, "desktop-language-mode.json"), "en");
  await writeFile(path.join(profile, "desktop-language.json"), "en");
  const application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${profile}`],
    env: {
      ...process.env,
      DESKTOP_E2E_BACKGROUND: "true",
      DESKTOP_API_BASE_URL: "http://localhost:9090",
      DESKTOP_AUTO_UPDATE: "false",
    },
  });
  try {
    await application.evaluate(({ app, BrowserWindow, shell }) => {
      globalThis.__groupRequests = [];
      const fetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input, init) => {
        const response = await fetch(input, init);
        const url = new URL(String(input));
        if (url.pathname.startsWith("/api/admin/groups"))
          globalThis.__groupRequests.push({
            path: url.pathname + url.search,
            method: init?.method ?? "GET",
            status: response.status,
          });
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
          app.emit("open-url", { preventDefault() {} }, target);
        };
        login.webContents.on("will-navigate", callback);
        login.webContents.on("will-redirect", callback);
        await login.loadURL(url);
      };
    });
    let window;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      window = application
        .windows()
        .find((candidate) =>
          candidate.url().startsWith("app://renderer/native"),
        );
      if (window) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(window, "Native packaged window must open");
    await window
      .getByRole("button", { name: "Administration Console", exact: true })
      .click();
    let browser;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      browser = application
        .windows()
        .find((candidate) =>
          /^http:\/\/(localhost|127\.0\.0\.1):9090\//.test(candidate.url()),
        );
      if (browser) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(browser, "Local backend login must open");
    await browser.locator('[name="username"]').fill(username);
    await browser.locator('[name="password"]').fill(password);
    await browser.getByRole("button", { name: /Sign in|Giriş/i }).click();
    await window.locator('[data-route="groups"]').waitFor();
    await browser.close();
    assert.equal(await application.evaluate(({ app }) => app.isPackaged), true);
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
      ),
      true,
    );
    return { application, window };
  } catch (error) {
    await application.close();
    throw error;
  }
}
async function ready(window) {
  await window.waitForFunction(
    () =>
      !document.querySelector(".loading") &&
      !document.querySelector('[aria-busy="true"]'),
  );
}
async function screenshot(application, window, name) {
  // Allow the hidden compositor to apply resize/zoom/theme changes before capture.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const png = await application.evaluate(async ({ BrowserWindow }, url) => {
    const target = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.webContents.getURL() === url,
    );
    const image = await target.webContents.capturePage(undefined, {
      stayHidden: true,
      stayAwake: true,
    });
    return image.toPNG().toString("base64");
  }, window.url());
  await writeFile(path.join(evidence, name), Buffer.from(png, "base64"));
}
async function tab(window, name) {
  await window.locator(`#group-tab-${name}`).click();
  await ready(window);
  assert.equal(
    await window.locator(`#group-tab-${name}`).getAttribute("aria-selected"),
    "true",
  );
}
async function mutation(window, locator) {
  const label = await locator.innerText();
  const progress = await locator.evaluate((element) => {
    const form = element.closest("form");
    const selector = element.dataset.action
      ? `[data-action="${element.dataset.action}"]${element.dataset.id ? `[data-id="${element.dataset.id}"]` : ""}`
      : `[data-form="${form.dataset.form}"] button[type="submit"]`;
    element.click();
    const current = document.querySelector(selector);
    return {
      disabled: current.disabled,
      busy: current.getAttribute("aria-busy"),
      spinner: Boolean(current.querySelector(".spinner")),
      label: current.textContent,
    };
  });
  assert.deepEqual(progress, {
    disabled: true,
    busy: "true",
    spinner: true,
    label,
  });
  await ready(window);
  assert.equal(
    await window.locator(".notice.error").count(),
    0,
    await window.locator(".content").innerText(),
  );
}

test(
  "real Kitezh.exe groups parity: four tabs, disposable CRUD, members and viewer",
  { skip: process.platform !== "win32", timeout: 240_000 },
  async () => {
    await mkdir(evidence, { recursive: true });
    const admin = await launch();
    const { application, window } = admin;
    const fixtureName = `groups-e2e-${Date.now()}`;
    const password = `Native!${crypto.randomUUID()}aA9`;
    const userIds = [];
    let groupId;
    let viewer;
    try {
      await window.locator('[data-route="groups"]').click();
      await ready(window);
      await window.locator("#group-query").fill("application-users");
      await window
        .locator('.group-table a[data-action="group-open"]')
        .first()
        .waitFor();
      await window.waitForFunction(() =>
        document
          .querySelector(".group-table tbody")
          ?.textContent.includes("application-users"),
      );
      await window
        .locator('.group-table a[data-action="group-open"]')
        .first()
        .click();
      await ready(window);
      for (const section of ["details", "permissions", "roles", "members"]) {
        await tab(window, section);
        await screenshot(
          application,
          window,
          `application-users-${section}.png`,
        );
      }
      await window.reload();
      await ready(window);
      assert.equal(
        await window
          .locator("#group-tab-members")
          .getAttribute("aria-selected"),
        "true",
      );
      await window.locator('[data-action="group-back"]').click();
      await ready(window);
      await window.locator('[data-action="create-group"]').click();
      await ready(window);
      await window.locator("#group-name").fill(fixtureName);
      await window
        .locator("#group-attributesJson")
        .fill('{"department":["finance"]}');
      await mutation(
        window,
        window.locator(
          '[data-form="native-group-settings"] button[type="submit"]',
        ),
      );
      groupId = Number(
        (await window.evaluate(() => location.hash)).split("/")[3],
      );
      assert.ok(groupId);
      assert.equal(
        (await request(window, "GET", `/api/admin/groups/${groupId}`))
          .attributes.department[0],
        "finance",
      );
      await window.locator("#group-name").fill(fixtureName + "-updated");
      await mutation(
        window,
        window.locator(
          '[data-form="native-group-settings"] button[type="submit"]',
        ),
      );
      assert.equal(
        (await request(window, "GET", `/api/admin/groups/${groupId}`)).name,
        fixtureName + "-updated",
      );
      for (let index = 0; index < 11; index += 1) {
        const user = await request(window, "POST", "/api/admin/users", {
          username: `${fixtureName}-${String(index).padStart(2, "0")}`,
          password,
          enabled: true,
          roles:
            index === 0
              ? ["ROLE_GROUP_VIEWER", "ROLE_USER_VIEWER"]
              : ["ROLE_USER"],
        });
        userIds.push(user.id);
      }
      await tab(window, "permissions");
      await window.locator('[data-action="group-permission-add"]').click();
      await window
        .locator("#group-permission-user-0")
        .selectOption(String(userIds[0]));
      await window.locator("#group-permission-value-0").selectOption("VIEW");
      await mutation(
        window,
        window.locator(
          '[data-form="native-group-permissions"] button[type="submit"]',
        ),
      );
      await tab(window, "roles");
      await window.locator('input[name="roles"][value="ROLE_USER"]').check();
      await mutation(
        window,
        window.locator(
          '[data-form="native-group-roles"] button[type="submit"]',
        ),
      );
      assert.deepEqual(
        (await request(window, "GET", `/api/admin/groups/${groupId}`)).roles,
        ["ROLE_USER"],
      );
      await tab(window, "members");
      await window.locator("#group-candidate-query").fill(`${fixtureName}-00`);
      await window
        .locator(
          `[data-action="group-candidate-select"][data-id="${userIds[0]}"]`,
        )
        .click();
      await mutation(
        window,
        window.locator('[data-action="group-member-add"]'),
      );
      assert.equal(
        await window.locator("#group-candidate-query").inputValue(),
        "",
      );
      for (const userId of userIds.slice(1))
        await request(window, "POST", `/api/admin/groups/${groupId}/users`, {
          userId,
        });
      await tab(window, "details");
      await tab(window, "members");
      assert.match(
        await window.locator(".admin-pagination-controls").innerText(),
        /Page 1 \/ 2/,
      );
      await window
        .locator('[data-action="group-page"][data-target="1"]')
        .first()
        .click();
      await ready(window);
      assert.equal(
        await window.locator(".group-members-table tbody tr").count(),
        1,
      );
      await mutation(
        window,
        window.locator(
          `[data-action="group-member-remove"][data-id="${userIds[10]}"]`,
        ),
      );
      assert.match(
        await window.locator(".admin-pagination-controls").innerText(),
        /Page 1 \/ 1/,
      );
      await window.locator("#groupMember-sort").selectOption("username,desc");
      await ready(window);
      await window.locator("#groupMember-size").selectOption("20");
      await ready(window);
      await window.locator("#groupMember-query").fill(`${fixtureName}-00`);
      await window.waitForFunction(
        () =>
          document.querySelectorAll(".group-members-table tbody tr").length ===
          1,
      );
      assert.equal(
        await window
          .locator('[data-action="group-user-open"]')
          .getAttribute("href"),
        `#/admin/users/${userIds[0]}/details`,
      );
      await screenshot(application, window, "members.png");
      await window.evaluate(() => window.desktopApi.theme.set("dark"));
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) =>
            window.webContents.getURL().startsWith("app://renderer/native"),
          )
          .setContentSize(700, 850),
      );
      await window.evaluate(() => window.desktopApi.language.set("tr"));
      await window.waitForFunction(
        () => document.documentElement.dataset.theme === "dark",
      );
      await screenshot(application, window, "members-dark-tr-narrow.png");
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) =>
            window.webContents.getURL().startsWith("app://renderer/native"),
          )
          .webContents.setZoomFactor(2),
      );
      await window.waitForFunction(() => window.innerWidth <= 350);
      const narrowMetrics = await window.evaluate(() => ({
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll("body *")]
          .map((element) => ({
            tag: element.tagName,
            className: String(element.className),
            width: Math.round(element.getBoundingClientRect().width),
            right: Math.round(element.getBoundingClientRect().right),
          }))
          .filter((element) => element.right > window.innerWidth + 1)
          .slice(0, 8),
      }));
      assert.ok(
        narrowMetrics.documentWidth <= narrowMetrics.innerWidth,
        JSON.stringify(narrowMetrics),
      );
      await screenshot(application, window, "members-dark-tr-200-percent.png");
      viewer = await launch(`${fixtureName}-00`, password);
      await viewer.window.locator('[data-route="groups"]').click();
      await ready(viewer.window);
      await viewer.window.locator("#group-query").fill(fixtureName);
      await viewer.window.waitForFunction(() =>
        document
          .querySelector(".group-table tbody")
          ?.textContent.includes("groups-e2e-"),
      );
      assert.equal(
        await viewer.window.locator('[data-action="create-group"]').count(),
        0,
      );
      assert.equal(
        await viewer.window
          .locator('[data-action="group-delete-request"]')
          .count(),
        0,
      );
      await viewer.window
        .locator(`[data-action="group-open"][data-id="${groupId}"]`)
        .first()
        .click();
      await ready(viewer.window);
      assert.equal(
        await viewer.window.locator("#group-name").isDisabled(),
        true,
      );
      await tab(viewer.window, "roles");
      assert.equal(
        await viewer.window.locator('input[name="roles"]').first().isDisabled(),
        true,
      );
      await tab(viewer.window, "permissions");
      assert.equal(
        await viewer.window
          .locator('[data-action="group-permission-add"]')
          .count(),
        0,
      );
      await tab(viewer.window, "members");
      assert.equal(
        await viewer.window.locator('[data-action="group-member-add"]').count(),
        0,
      );
      assert.equal(
        await viewer.window
          .locator('[data-action="group-member-remove"]')
          .count(),
        0,
      );
      await screenshot(viewer.application, viewer.window, "viewer-members.png");
      await writeFile(
        path.join(evidence, "requests.json"),
        JSON.stringify(
          await application.evaluate(() => globalThis.__groupRequests),
          null,
          2,
        ),
      );
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().every((window) => !window.isVisible()),
        ),
        true,
      );
    } finally {
      if (viewer) await viewer.application.close();
      const cleanupErrors = [];
      if (groupId)
        try {
          await request(window, "DELETE", `/api/admin/groups/${groupId}`);
        } catch (error) {
          cleanupErrors.push(error);
        }
      for (const id of userIds)
        try {
          await request(window, "DELETE", `/api/admin/users/${id}`);
        } catch (error) {
          cleanupErrors.push(error);
        }
      await application.close();
      assert.deepEqual(
        cleanupErrors.map((error) => error.message),
        [],
        "Disposable data must be removed",
      );
    }
  },
);
