import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
const roleBase = "/api/admin/clients/demo-client/roles";
const detailQuery = "?page=0&size=20&sort=username,asc";

async function request(window, request) {
  return window.evaluate(
    (input) => window.desktopApi.api.request({ console: "admin", ...input }),
    request,
  );
}

async function signIn(application) {
  await application.evaluate(({ app, BrowserWindow, shell }) => {
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
      const deliverCallback = (event, target) => {
        if (!target.startsWith("kitezh://oauth/callback")) return;
        event.preventDefault();
        // Exercise real PKCE exchange; emulate only OS callback delivery.
        app.emit("open-url", { preventDefault() {} }, target);
      };
      login.webContents.on("will-navigate", deliverCallback);
      login.webContents.on("will-redirect", deliverCallback);
      await login.loadURL(url);
    };
  });
  let window;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    window = application
      .windows()
      .find((page) => page.url().startsWith("app://renderer/native"));
    if (window) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(window, "Native packaged window must open");
  const browserPromise = application.waitForEvent("window");
  await window
    .getByRole("button", { name: "Administration Console", exact: true })
    .click();
  const browser = await browserPromise;
  await browser.locator('input[name="username"]').fill("admin");
  await browser.locator('input[name="password"]').fill("admin");
  await browser.getByRole("button", { name: /Sign in|Giriş/i }).click();
  await window
    .getByRole("heading", { name: "Dashboard", exact: true })
    .waitFor();
  await browser.close();
  return window;
}

async function guardedClick(button) {
  const progress = await button.evaluate((element) => {
    const action = element.dataset.action;
    const formName = element.closest("form")?.dataset.form;
    const selector = action
      ? `button[data-action="${action}"]`
      : formName
        ? `form[data-form="${formName}"] button[type="submit"]`
        : null;
    element.click();
    const current = selector ? document.querySelector(selector) : element;
    return {
      disabled: current?.disabled === true,
      busy: current?.getAttribute("aria-busy"),
      spinnerCount: current?.querySelectorAll(".spinner").length ?? 0,
    };
  });
  assert.deepEqual(progress, {
    disabled: true,
    busy: "true",
    spinnerCount: 1,
  });
  await button.dispatchEvent("click");
}

test(
  "packaged Windows client roles persist CRUD and user/group assignments",
  {
    skip: process.platform !== "win32",
    timeout: 120_000,
  },
  async () => {
    const profile = await mkdtemp(
      path.join(os.tmpdir(), "kitezh-client-roles-"),
    );
    await writeFile(path.join(profile, "desktop-language-mode.json"), "en");
    await writeFile(path.join(profile, "desktop-language.json"), "en");
    const application = await electron.launch({
      executablePath: path.join(
        desktopDirectory,
        "release",
        "win-unpacked",
        "Kitezh.exe",
      ),
      args: [`--user-data-dir=${profile}`],
      env: {
        ...process.env,
        DESKTOP_E2E_BACKGROUND: "true",
        DESKTOP_API_BASE_URL: "http://localhost:9090",
        DESKTOP_AUTO_UPDATE: "false",
      },
    });
    const fixtureName = `native-role-e2e-${Date.now()}`;
    let window;
    let userId;
    let groupId;
    let roleId;
    try {
      window = await signIn(application);
      assert.equal(
        await application.evaluate(({ app }) => app.isPackaged),
        true,
      );
      assert.equal(
        await window.evaluate(() =>
          window.desktopApi.auth.hasSession("account"),
        ),
        false,
      );
      const createdUser = await window.evaluate(async (name) => {
        const response = await window.desktopApi.api.request({
          console: "admin",
          method: "POST",
          path: "/api/admin/users",
          body: {
            username: name,
            password: `Native!${crypto.randomUUID()}aA9`,
            enabled: true,
            roles: ["ROLE_USER"],
          },
        });
        return { status: response.status, id: response.body?.id };
      }, fixtureName);
      userId = createdUser.id;
      assert.equal(createdUser.status, 201);
      assert.ok(userId);
      const createdGroup = await request(window, {
        method: "POST",
        path: "/api/admin/groups",
        body: {
          name: fixtureName,
          parentId: null,
          attributes: {},
          defaultGroup: false,
        },
      });
      groupId = createdGroup.body?.id;
      assert.equal(createdGroup.status, 201);
      assert.ok(groupId);

      await application.evaluate(() => {
        globalThis.__roleWrites = [];
        const originalFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (input, init) => {
          const response = await originalFetch(input, init);
          const url = new URL(String(input));
          const method = String(init?.method ?? "GET");
          if (
            /^\/api\/admin\/clients\/demo-client\/roles(?:\/|$)/.test(
              url.pathname,
            ) &&
            method !== "GET"
          ) {
            const operation = url.pathname.includes("/users")
              ? "users"
              : url.pathname.includes("/groups")
                ? "groups"
                : "role";
            globalThis.__roleWrites.push({
              method,
              operation,
              status: response.status,
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          return response;
        };
      });
      await window
        .getByRole("button", { name: "Clients", exact: true })
        .click();
      const search = window.locator("#admin-client-search");
      await search.locator('[name="q"]').fill("demo-client");
      await search.locator('button[type="submit"]').click();
      const clientRow = window
        .locator("tr[data-client-id]")
        .filter({ hasText: "demo-client" });
      await clientRow
        .locator('.client-name [data-action="client-open"]')
        .click();
      await window
        .locator('[data-action="client-tab"][data-id="roles"]')
        .click();
      const roles = window.locator('[data-client-roles-panel="demo-client"]');
      const create = roles.locator('[data-form="admin-client-role-create"]');
      await create.locator('[name="name"]').fill(fixtureName);
      await create
        .locator('[name="description"]')
        .fill("Windows package assignment fixture");
      await guardedClick(
        create.getByRole("button", { name: "Create client role", exact: true }),
      );
      await window.getByText("Client role created.", { exact: true }).waitFor();
      const roleSearch = roles.locator(
        '[data-form="admin-client-role-search"]',
      );
      await roleSearch.locator('[name="q"]').fill(fixtureName);
      await roleSearch.locator('button[type="submit"]').click();
      const row = roles
        .locator("article[data-client-role-id]")
        .filter({ hasText: fixtureName });
      await row.waitFor();
      roleId = await row.getAttribute("data-client-role-id");
      assert.match(roleId, /^[1-9]\d*$/);
      await row
        .getByRole("button", { name: "Edit client role", exact: true })
        .click();
      const edit = row.locator('[data-form="admin-client-role-update"]');
      await edit
        .locator('[name="description"]')
        .fill("Windows package updated fixture");
      await guardedClick(
        edit.getByRole("button", { name: "Save", exact: true }),
      );
      await window.getByText("Client role updated.", { exact: true }).waitFor();
      const updated = await request(window, {
        path: `${roleBase}/${roleId}${detailQuery}`,
      });
      assert.equal(updated.status, 200);
      assert.equal(
        updated.body.role.description,
        "Windows package updated fixture",
      );
      await row
        .getByRole("button", { name: "Manage role assignments", exact: true })
        .click();
      const assignments = row.locator("[data-client-role-assignments]");
      const users = assignments.getByRole("group", {
        name: "Assigned users",
        exact: true,
      });
      await users
        .getByRole("searchbox", { name: "Search available users" })
        .fill(fixtureName);
      await users.getByRole("button", { name: "Search", exact: true }).click();
      await guardedClick(
        users.getByRole("button", { name: "Assign user", exact: true }),
      );
      await window
        .getByText("User assigned to the role.", { exact: true })
        .waitFor();
      const userAssigned = await request(window, {
        path: `${roleBase}/${roleId}${detailQuery}`,
      });
      assert.equal(userAssigned.status, 200);
      assert.equal(
        userAssigned.body.users.content.some(
          (user) => Number(user.id) === Number(userId),
        ),
        true,
      );

      const groups = assignments.getByRole("group", {
        name: "Assigned groups",
        exact: true,
      });
      await groups
        .getByRole("searchbox", { name: "Search available groups" })
        .fill(fixtureName);
      await groups.getByRole("button", { name: "Search", exact: true }).click();
      await guardedClick(
        groups.getByRole("button", { name: "Assign group", exact: true }),
      );
      await window
        .getByText("Group assigned to the role.", { exact: true })
        .waitFor();
      const groupAssigned = await request(window, {
        path: `${roleBase}/${roleId}${detailQuery}`,
      });
      assert.equal(groupAssigned.status, 200);
      assert.equal(
        groupAssigned.body.groups.content.some((group) => group.id === groupId),
        true,
      );

      for (const [section, kind] of [
        [users, "user"],
        [groups, "group"],
      ]) {
        await section
          .getByRole("button", { name: `Remove ${kind}`, exact: true })
          .click();
        await section
          .getByText(`Remove this ${kind} from the role?`, { exact: true })
          .waitFor();
        await guardedClick(
          section.getByRole("button", { name: `Remove ${kind}`, exact: true }),
        );
        await window
          .getByText(
            `${kind === "user" ? "User" : "Group"} removed from the role.`,
            { exact: true },
          )
          .waitFor();
      }
      const removed = await request(window, {
        path: `${roleBase}/${roleId}${detailQuery}`,
      });
      assert.equal(removed.status, 200);
      assert.equal(removed.body.userCount, 0);
      assert.equal(removed.body.groupCount, 0);
      await row
        .getByRole("button", { name: "Delete client role", exact: true })
        .click();
      await row
        .getByText(
          "Delete this client role? Assigned roles cannot be deleted.",
          { exact: true },
        )
        .waitFor();
      await guardedClick(
        row.getByRole("button", { name: "Delete client role", exact: true }),
      );
      await window.getByText("Client role deleted.", { exact: true }).waitFor();
      const deleted = await request(window, {
        path: `${roleBase}/${roleId}${detailQuery}`,
      });
      assert.equal(deleted.status, 404);
      roleId = null;
      assert.deepEqual(
        await application.evaluate(() => globalThis.__roleWrites),
        [
          { method: "POST", operation: "role", status: 201 },
          { method: "PUT", operation: "role", status: 200 },
          { method: "POST", operation: "users", status: 200 },
          { method: "POST", operation: "groups", status: 200 },
          { method: "DELETE", operation: "users", status: 200 },
          { method: "DELETE", operation: "groups", status: 200 },
          { method: "DELETE", operation: "role", status: 204 },
        ],
      );
    } finally {
      const failures = [];
      try {
        if (window) {
          // Only remove the exact fixture owned by this run, including failed setup.
          const roles = await request(window, {
            path: `${roleBase}?q=${fixtureName}&page=0&size=20&sort=name,asc`,
          });
          roleId ??= roles.body?.content?.find(
            (role) => role.name === fixtureName,
          )?.id;
          if (roleId) {
            for (const [kind, id] of [
              ["users", userId],
              ["groups", groupId],
            ]) {
              if (!id) continue;
              const result = await request(window, {
                method: "DELETE",
                path: `${roleBase}/${roleId}/${kind}/${id}${detailQuery}`,
              });
              if (![200, 404].includes(result.status))
                failures.push(`${kind}:${result.status}`);
            }
            const result = await request(window, {
              method: "DELETE",
              path: `${roleBase}/${roleId}`,
            });
            if (![204, 404].includes(result.status))
              failures.push(`role:${result.status}`);
          }
          for (const [kind, id] of [
            ["users", userId],
            ["groups", groupId],
          ]) {
            if (!id) continue;
            const result = await request(window, {
              method: "DELETE",
              path: `/api/admin/${kind}/${id}`,
            });
            if (![204, 404].includes(result.status))
              failures.push(`${kind}:${result.status}`);
          }
        }
      } finally {
        await application.close();
      }
      assert.deepEqual(failures, [], "Fixture cleanup must succeed");
    }
  },
);
