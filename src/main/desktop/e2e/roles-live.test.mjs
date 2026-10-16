import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { _electron as electron } from "playwright-core";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
test("live native role administration", { timeout: 180_000 }, async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "kitezh-roles-live-"));
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
  const evidence = path.join(desktopDirectory, "e2e/artifacts/roles-live");
  await mkdir(evidence, { recursive: true });
  const roleName = `ROLE_E2E_${Date.now()}`;
  const childName = roleName + "_CHILD";
  const username = `roles-e2e-${Date.now()}`;
  const password = `Native!${crypto.randomUUID()}aA9`;
  let userId;
  let membershipUserId;
  let clientRoleId;
  let window;
  let viewerApplication;
  const backendLimitations = [];
  const bridge = (page, method, path, body) =>
    page.evaluate(
      async (args) => {
        const response = await window.desktopApi.api.request({
          console: "admin",
          ...args,
        });
        if (response.status >= 300 || response.status === 0)
          throw new Error(
            `API ${args.method} ${args.path}: ${response.status} ${JSON.stringify(response.body)}`,
          );
        return response.body;
      },
      { method, path, ...(body === undefined ? {} : { body }) },
    );
  const ready = () =>
    window.waitForFunction(
      () =>
        !document.querySelector('[data-action="role-back"]')?.disabled &&
        !document.querySelector('[data-action="create-role"]')?.disabled,
    );
  try {
    await application.evaluate(({ app, BrowserWindow, shell }) => {
      globalThis.__roleUpdateEvidence = [];
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        if (
          ["PUT", "POST", "DELETE"].includes(init?.method) &&
          /^\/api\/admin\/roles\/ROLE_E2E_\d+(?:\/|$)/.test(
            new URL(String(input)).pathname,
          )
        ) {
          globalThis.__roleUpdateEvidence.push({
            path: new URL(String(input)).pathname,
            method: init.method,
            request: init.body ? JSON.parse(init.body) : undefined,
            status: response.status,
            response:
              response.status === 204 ? null : await response.clone().json(),
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
          app.emit("open-url", { preventDefault() {} }, target);
        };
        login.webContents.on("will-navigate", callback);
        login.webContents.on("will-redirect", callback);
        await login.loadURL(url);
      };
    });
    for (let i = 0; i < 150; i++) {
      window = application
        .windows()
        .find((page) => page.url().startsWith("app://renderer/native"));
      if (window) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(window);
    window.setDefaultTimeout(15_000);
    await window
      .getByRole("button", { name: "Administration Console", exact: true })
      .click();
    let login;
    for (let i = 0; i < 200; i++) {
      login = application
        .windows()
        .find((page) =>
          /^http:\/\/(localhost|127\.0\.0\.1):9090\//.test(page.url()),
        );
      if (login) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(login, "Real backend OAuth login must open");
    await login.locator('input[name="username"]').fill("admin");
    await login.locator('input[name="password"]').fill("admin");
    await login.getByRole("button", { name: /Sign in|Giriş/i }).click();
    await window
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    await login.close();
    const response = await window.evaluate(() =>
      globalThis.desktopApi.api.request({
        console: "admin",
        path: "/api/admin/roles?q=&page=0&size=10&sort=name,asc",
        method: "GET",
      }),
    );
    assert.equal(response.status, 200);
    await writeFile(
      path.join(evidence, "roles-response.json"),
      JSON.stringify(response.body, null, 2),
    );
    console.log(
      "Real role page metadata:",
      JSON.stringify(
        Object.fromEntries(
          Object.entries(response.body).filter(([key]) => key !== "content"),
        ),
      ),
    );
    await window.locator('[data-route="roles"]').click();
    await window.locator('[data-role-name="ROLE_ADMIN"]').waitFor();
    await window.screenshot({
      path: path.join(evidence, "roles.png"),
      fullPage: true,
    });
    assert.equal(
      await window.locator(".admin-pagination-summary").innerText(),
      "1–10 / 14",
    );
    assert.equal(
      await window
        .locator(
          '[data-role-name="ROLE_ADMIN"] [data-action="admin-role-delete-request"]',
        )
        .count(),
      0,
    );
    await window.locator('[data-action="role-page"]').last().click();
    await window.waitForFunction(() =>
      document
        .querySelector(".admin-pagination-summary")
        ?.textContent.includes("11–14"),
    );
    await window.locator('[data-action="role-page"]').first().click();
    await ready();
    await window.locator("#role-size").selectOption("20");
    await ready();
    assert.equal(await window.locator(".role-table tbody tr").count(), 14);
    await window.locator("#role-sort").selectOption("name,desc");
    await ready();
    await window.locator("#admin-role-query").fill("ROLE_ADMIN");
    await window.waitForFunction(
      () => document.querySelectorAll(".role-table tbody tr").length === 1,
    );
    assert.equal(
      await window
        .locator("#admin-role-query")
        .evaluate((input) => input === document.activeElement),
      true,
    );
    await window
      .locator('[data-action="role-open"][data-id="ROLE_ADMIN"]')
      .first()
      .click();
    await ready();
    await window.locator("#role-tab-details").waitFor();
    await window.screenshot({
      path: path.join(evidence, "admin-details.png"),
      fullPage: true,
    });
    await window.locator("#role-tab-users").click();
    await ready();
    assert.ok(await window.locator("#role-tab-panel").innerText());
    await window.screenshot({
      path: path.join(evidence, "admin-users.png"),
      fullPage: true,
    });
    await window.locator('[data-action="role-back"]').click();
    await ready();
    assert.equal(
      await window.locator("#admin-role-query").inputValue(),
      "ROLE_ADMIN",
    );
    assert.equal(await window.locator("#role-sort").inputValue(), "name,desc");
    assert.equal(await window.locator("#role-size").inputValue(), "20");
    await window.locator('[data-action="role-clear"]').click();
    await ready();

    userId = (
      await bridge(window, "POST", "/api/admin/users", {
        username,
        password,
        enabled: true,
        roles: ["ROLE_USER_MANAGER"],
      })
    ).id;
    assert.ok(userId);
    await bridge(window, "POST", "/api/admin/roles", {
      name: childName,
      description: "Temporary role E2E child",
    });
    clientRoleId = (
      await bridge(window, "POST", "/api/admin/clients/demo-client/roles", {
        name: username,
        description: "Temporary role E2E client role",
      })
    ).id;
    assert.ok(clientRoleId);
    await window.locator('[data-action="create-role"]').click();
    await window.locator("#role-name").waitFor();
    assert.equal(
      await window
        .locator("#role-name")
        .evaluate((input) => input === document.activeElement),
      true,
    );
    await window.screenshot({
      path: path.join(evidence, "create.png"),
      fullPage: true,
    });
    await window.locator("#role-name").fill(roleName);
    await window.locator("#role-description").fill("Temporary E2E role");
    await window
      .locator('[data-form="admin-role-create"] button[type="submit"]')
      .click();
    await window.locator("#role-tab-details").waitFor();
    await ready();
    assert.equal(await window.locator("h1").innerText(), roleName);
    await window
      .locator("#role-description")
      .fill("Changed through real Electron");
    await window
      .locator('[data-form="admin-role-edit"] button[type="submit"]')
      .click();
    await ready();
    assert.equal(
      await window.locator("#role-description").inputValue(),
      "Changed through real Electron",
    );
    const descriptionRead = await bridge(
      window,
      "GET",
      `/api/admin/roles/${roleName}`,
    );
    await writeFile(
      path.join(evidence, "description-consistency.json"),
      JSON.stringify(
        {
          put: await application.evaluate(
            () => globalThis.__roleUpdateEvidence,
          ),
          get: descriptionRead.description,
        },
        null,
        2,
      ),
    );
    if (descriptionRead.description !== "Changed through real Electron")
      backendLimitations.push(
        "Description PUT returned the new value, but subsequent GET returned the old value.",
      );
    await window.locator("#role-description").fill("");
    await window
      .locator('[data-form="admin-role-edit"] button[type="submit"]')
      .click();
    await ready();
    assert.equal(await window.locator("#role-description").inputValue(), "");
    assert.equal(
      (await application.evaluate(() => globalThis.__roleUpdateEvidence)).at(-1)
        .request.description,
      null,
    );

    for (const [kind, query, value] of [
      ["realm", childName, childName],
      ["client", username, String(clientRoleId)],
    ]) {
      await window.locator(`#role-candidate-${kind}`).fill(query);
      await window
        .locator(`#role-candidate-select-${kind} option[value="${value}"]`)
        .waitFor({ state: "attached" });
      const assign = window
        .locator(`[data-role-candidate="${kind}"] button`)
        .last();
      assert.equal(await assign.isDisabled(), true);
      await window
        .locator(`#role-candidate-select-${kind}`)
        .selectOption(value);
      await window
        .locator(`[data-role-candidate="${kind}"] button`)
        .last()
        .click();
      await ready();
    }
    let persisted = await bridge(window, "GET", `/api/admin/roles/${roleName}`);
    assert.deepEqual(persisted.compositeRoles, [childName]);
    const clientAssignment = (
      await application.evaluate(() => globalThis.__roleUpdateEvidence)
    ).find(
      (item) =>
        item.path.endsWith(`/client-composites/${clientRoleId}`) &&
        item.method === "POST",
    );
    assert.equal(clientAssignment.status, 200);
    assert.equal(
      clientAssignment.response.compositeClientRoles[0].id,
      clientRoleId,
    );
    if (
      !persisted.compositeClientRoles.some((role) => role.id === clientRoleId)
    )
      backendLimitations.push(
        "Client-composite POST returned the assignment, but subsequent GET omitted it.",
      );
    await writeFile(
      path.join(evidence, "client-composite-consistency.json"),
      JSON.stringify(
        { post: clientAssignment, get: persisted.compositeClientRoles },
        null,
        2,
      ),
    );
    await window.screenshot({
      path: path.join(evidence, "temporary-details.png"),
      fullPage: true,
    });
    for (const prefix of [
      "admin-role-composite-remove",
      "admin-role-client-composite-remove",
    ]) {
      await window.locator(`[data-action="${prefix}-request"]`).click();
      await window.locator(`[data-action="${prefix}-confirm"]`).click();
      await ready();
    }
    persisted = await bridge(window, "GET", `/api/admin/roles/${roleName}`);
    if (
      persisted.compositeRoles.length +
        persisted.compositeClientRoles.length !==
      0
    )
      backendLimitations.push(
        "Composite DELETE returned removal, but subsequent GET still contained the child role.",
      );
    await window.locator("#role-tab-users").click();
    await ready();
    await window.locator("#role-candidate-user").fill(username);
    await window
      .locator(`#role-candidate-select-user option[value="${userId}"]`)
      .waitFor({ state: "attached" });
    await window
      .locator("#role-candidate-select-user")
      .selectOption(String(userId));
    await window.locator('[data-action="role-user-add"]').click();
    await ready();
    persisted = await bridge(window, "GET", `/api/admin/roles/${roleName}`);
    const assignment = (
      await application.evaluate(() => globalThis.__roleUpdateEvidence)
    ).find((item) => item.path.endsWith("/users") && item.method === "POST");
    if (assignment.status !== 200) {
      backendLimitations.push(
        "Role user assignment returned HTTP " +
          assignment.status +
          " (" +
          assignment.response.errorCode +
          ").",
      );
      assert.equal(
        await window.locator(".notice.error").count(),
        1,
        "Assignment failure must remain visible",
      );
      // Seed a separate temporary membership through user creation to exercise the remove UI
      // without modifying an existing user or disguising the failed role assignment endpoint.
      membershipUserId = (
        await bridge(window, "POST", "/api/admin/users", {
          username: username + "-member",
          password,
          enabled: true,
          roles: ["ROLE_USER", roleName],
        })
      ).id;
      await window.locator('[data-action="retry"]').click();
      await ready();
    }
    persisted = await bridge(window, "GET", `/api/admin/roles/${roleName}`);
    assert.equal(persisted.userCount, 1);
    const assignedUserId = membershipUserId ?? userId;
    assert.equal(persisted.users.content[0].id, assignedUserId);
    await window.locator("#role-users-sort").selectOption("email,desc");
    await ready();
    await window.locator("#role-users-enabled").selectOption("true");
    await ready();
    await window.locator("#role-users-query").fill(username);
    await window.waitForFunction(
      () =>
        document
          .querySelector("#role-users-search")
          ?.getAttribute("aria-busy") === "false" &&
        document.querySelector('[data-action="role-clear"]'),
    );
    await window.locator('[data-action="role-clear"]').click();
    await ready();
    await window.locator('[data-action="role-user-open"]').click();
    await window.locator(".admin-user-detail-heading").waitFor();
    await window
      .locator('[data-action="admin-user-detail-back"]')
      .first()
      .click();
    await window.locator("#role-tab-users").waitFor();
    await ready();
    await window.screenshot({
      path: path.join(evidence, "temporary-users.png"),
      fullPage: true,
    });
    await window
      .locator(`[data-action="role-user-remove"][data-id="${assignedUserId}"]`)
      .click();
    await window
      .locator(
        `[data-action="role-user-remove-confirm"][data-id="${assignedUserId}"]`,
      )
      .click();
    await ready();
    const removal = (
      await application.evaluate(() => globalThis.__roleUpdateEvidence)
    ).find(
      (item) =>
        item.path.endsWith("/users/" + assignedUserId) &&
        item.method === "DELETE",
    );
    if (removal.status !== 200)
      backendLimitations.push(
        "Role user removal returned HTTP " +
          removal.status +
          " (" +
          removal.response.errorCode +
          ").",
      );
    else
      assert.equal(
        (await bridge(window, "GET", `/api/admin/roles/${roleName}`)).userCount,
        0,
      );

    // Real viewer credentials exercise the server's whoami permissions in a separate hidden app.
    const viewerProfile = await mkdtemp(
      path.join(os.tmpdir(), "kitezh-roles-viewer-"),
    );
    await writeFile(
      path.join(viewerProfile, "desktop-language-mode.json"),
      "en",
    );
    await writeFile(path.join(viewerProfile, "desktop-language.json"), "en");
    viewerApplication = await electron.launch({
      args: [`--user-data-dir=${viewerProfile}`, desktopDirectory],
      cwd: desktopDirectory,
      env: {
        ...process.env,
        DESKTOP_E2E_BACKGROUND: "true",
        DESKTOP_API_BASE_URL: "http://localhost:9090",
        DESKTOP_AUTO_UPDATE: "false",
      },
    });
    await viewerApplication.evaluate(({ app, BrowserWindow, shell }) => {
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
          if (target.startsWith("kitezh://oauth/callback")) {
            event.preventDefault();
            app.emit("open-url", { preventDefault() {} }, target);
          }
        };
        login.webContents.on("will-navigate", callback);
        login.webContents.on("will-redirect", callback);
        await login.loadURL(url);
      };
    });
    let viewer;
    for (let i = 0; i < 150; i++) {
      viewer = viewerApplication
        .windows()
        .find((page) => page.url().startsWith("app://renderer/native"));
      if (viewer) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(viewer);
    await viewer
      .getByRole("button", { name: "Administration Console", exact: true })
      .click();
    let viewerLogin;
    for (let i = 0; i < 200; i++) {
      viewerLogin = viewerApplication
        .windows()
        .find((page) =>
          /^http:\/\/(localhost|127\.0\.0\.1):9090\//.test(page.url()),
        );
      if (viewerLogin) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(viewerLogin);
    await viewerLogin.locator('[name="username"]').fill(username);
    await viewerLogin.locator('[name="password"]').fill(password);
    await viewerLogin.getByRole("button", { name: /Sign in|Giriş/i }).click();
    await viewer.locator('[data-route="roles"]').click();
    await viewer.locator(".role-table").waitFor();
    assert.equal(
      await viewer.locator('[data-action="create-role"]').count(),
      0,
    );
    assert.equal(
      await viewer.locator('[data-action="admin-role-delete-request"]').count(),
      0,
    );
    await viewer
      .locator('[data-action="role-open"][data-id="ROLE_ADMIN"]')
      .first()
      .click();
    await viewer.locator("#role-description").waitFor();
    assert.equal(await viewer.locator("#role-description").isDisabled(), true);
    assert.equal(
      await viewer.locator('[data-form="admin-role-edit"] button').count(),
      0,
    );
    assert.equal(await viewer.locator("[data-role-candidate]").count(), 0);
    await viewer.screenshot({
      path: path.join(evidence, "viewer-details.png"),
      fullPage: true,
    });
    await viewer.locator("#role-tab-users").click();
    await viewer.locator("#role-users-query").waitFor();
    assert.equal(
      await viewer.locator('[data-action="role-user-remove"]').count(),
      0,
    );
    await viewerApplication.close();
    viewerApplication = null;

    await window.locator("#role-tab-details").click();
    await ready();
    await window.evaluate(() => window.desktopApi.theme.set("dark"));
    await window.locator('[data-action="toggle-locale"]').click();
    await window
      .getByRole("tab", { name: "Ayrıntılar", exact: true })
      .waitFor();
    await window.screenshot({
      path: path.join(evidence, "dark-tr-details.png"),
      fullPage: true,
    });
    await application.evaluate(({ BrowserWindow }) => {
      const native = BrowserWindow.getAllWindows().find((item) =>
        item.webContents.getURL().startsWith("app://renderer/native"),
      );
      native.setSize(760, 700);
      native.webContents.setZoomFactor(2);
    });
    await window.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await window.locator("#role-tab-details").scrollIntoViewIfNeeded();
    await window.screenshot({
      path: path.join(evidence, "narrow-tr-zoom.png"),
      fullPage: false,
    });
    const narrowLayout = await window.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    await writeFile(
      path.join(evidence, "narrow-layout.json"),
      JSON.stringify(narrowLayout, null, 2),
    );
    assert.ok(
      narrowLayout.content <= narrowLayout.viewport + 1,
      "Role detail must reflow without horizontal page overflow at 200% zoom",
    );
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((item) => !item.isVisible()),
      ),
      true,
    );
    console.log(
      "Verified real list/search/sort/pagination, details/users/create, description, realm/client composites, membership and view-only access.",
    );
    await writeFile(
      path.join(evidence, "backend-limitations.json"),
      JSON.stringify(backendLimitations, null, 2),
    );
    assert.deepEqual(
      backendLimitations,
      [],
      "Real backend mutation read-after-write consistency must pass independently of renderer tests",
    );
  } catch (error) {
    await writeFile(
      path.join(evidence, "mutations.json"),
      JSON.stringify(
        await application.evaluate(() => globalThis.__roleUpdateEvidence),
        null,
        2,
      ),
    );
    if (window)
      await window.screenshot({
        path: path.join(evidence, "failure.png"),
        fullPage: true,
      });
    throw error;
  } finally {
    if (viewerApplication) await viewerApplication.close();
    if (window && membershipUserId)
      await bridge(window, "DELETE", `/api/admin/users/${membershipUserId}`);
    if (window && userId)
      await bridge(window, "DELETE", `/api/admin/users/${userId}`);
    if (window && clientRoleId)
      await bridge(
        window,
        "DELETE",
        `/api/admin/clients/demo-client/roles/${clientRoleId}`,
      );
    if (window) {
      for (const name of [roleName, childName]) {
        const exists = await window.evaluate(
          (name) =>
            window.desktopApi.api.request({
              console: "admin",
              method: "GET",
              path: `/api/admin/roles/${name}`,
            }),
          name,
        );
        if (exists.status === 200)
          await bridge(window, "DELETE", `/api/admin/roles/${name}`);
      }
    }
    await application.close();
  }
});
