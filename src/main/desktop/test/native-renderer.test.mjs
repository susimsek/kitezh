import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  exerciseVisibleEditorActions,
  renderConsole,
  rendererPath,
  settle,
} from "./native-renderer-harness.mjs";

test("native Account renderer covers navigation, settings, and session states", async () => {
  const harness = await renderConsole();
  try {
    const { calls, document } = harness;
    assert.match(document.querySelector(".sidebar").textContent, /Account/);
    assert.ok(calls.some(({ path }) => path === "/api/account/profile"));

    const routes = [
      "security",
      "sessions",
      "applications",
      "notifications",
      "settings",
      "profile",
    ];
    for (const route of routes) {
      const link = document.querySelector(`[data-route="${route}"]`);
      assert.ok(link, `Account navigation should include ${route}`);
      link.click();
      await settle();
      assert.equal(
        document
          .querySelector(`[data-route="${route}"]`)
          .getAttribute("aria-current"),
        "page",
      );
      await exerciseVisibleEditorActions(document);
    }

    document.querySelector(
      '[data-form="profile"] input[name="firstName"]',
    ).value = "Augusta";
    document.querySelector('[data-form="profile"]').dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/account/profile" &&
          method === "PUT" &&
          body.firstName === "Augusta",
      ),
    );

    const languageToggle = document.querySelector(
      '[data-action="toggle-locale"]',
    );
    languageToggle.click();
    await settle();
    assert.ok(
      calls.some(({ path, method }) => path === "language" && method === "tr"),
    );
    harness.callbacks.language("tr");
    assert.match(document.querySelector(".sidebar").textContent, /Hesap/);
  } finally {
    harness.restore();
  }
});

test("native Account renderer localizes each settings and security route", async () => {
  const harness = await renderConsole("account", { locale: "tr" });
  try {
    const { document } = harness;
    const routes = [
      "security",
      "sessions",
      "applications",
      "notifications",
      "settings",
      "profile",
    ];
    for (const route of routes) {
      const link = document.querySelector(`[data-route="${route}"]`);
      assert.ok(link, `Turkish Account navigation should include ${route}`);
      link.click();
      await settle();
      assert.equal(
        document.querySelector(`[data-route="${route}"]`).getAttribute("aria-current"),
        "page",
      );
      await exerciseVisibleEditorActions(document);
    }
    assert.ok(document.querySelector('[data-form="profile"]'));
  } finally {
    harness.restore();
  }
});

test("native Account lists show accessible empty states", async () => {
  const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0 };
  const harness = await renderConsole("account", {
    response: async (path) =>
      path.startsWith("/api/account/sessions?") ||
      path.startsWith("/api/account/applications?") ||
      path.startsWith("/api/account/notifications?")
        ? emptyPage
        : null,
  });
  try {
    const { document } = harness;
    for (const route of ["sessions", "applications", "notifications"]) {
      document.querySelector(`[data-route="${route}"]`).click();
      await settle();
      assert.ok(
        document.querySelector(".content .empty"),
        `${route} should expose an empty-state status`,
      );
    }
  } finally {
    harness.restore();
  }
});

test("native renderer script remains a module with a narrow desktop bridge", async () => {
  const source = await readFile(rendererPath, "utf8");
  assert.match(source, /globalThis\.desktopApi/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\b/);
});

test("native Account settings persist system, light, dark, and locale preferences through the bridge", async () => {
  const harness = await renderConsole();
  try {
    const { calls, document, callbacks } = harness;
    document.querySelector('[data-route="settings"]').click();
    await settle();

    const theme = document.getElementById("theme");
    const language = document.getElementById("language");
    assert.ok(theme);
    assert.ok(language);
    for (const mode of ["system", "light", "dark"]) {
      theme.value = mode;
      theme.dispatchEvent(new document.defaultView.Event("change"));
      await settle();
    }
    language.value = "tr";
    language.dispatchEvent(new document.defaultView.Event("change"));
    await settle();

    assert.deepEqual(
      calls.filter(({ path }) => path === "theme").map(({ method }) => method),
      ["system", "light", "dark"],
    );
    assert.ok(
      calls.some(({ path, method }) => path === "language" && method === "tr"),
    );
    callbacks.theme("dark");
    assert.equal(document.documentElement.dataset.theme, "dark");
    callbacks.language("tr");
    await settle();
    assert.match(document.querySelector(".sidebar").textContent, /Hesap/);
  } finally {
    harness.restore();
  }
});

test("native Account renderer validates and completes MFA enrollment", async () => {
  const harness = await renderConsole();
  let mfaEnabled = false;
  harness.setResponse("/api/account/mfa", "GET", () => ({
    available: true,
    enabled: mfaEnabled,
    digits: 6,
  }));
  harness.setResponse("/api/account/mfa/setup", "POST", () => ({
    available: true,
    secret: "test-only-secret",
    digits: 6,
  }));
  harness.setResponse("/api/account/mfa/enable", "POST", () => {
    mfaEnabled = true;
    return { enabled: true };
  });
  harness.setResponse("/api/account/mfa/disable", "POST", () => {
    mfaEnabled = false;
    return { enabled: false };
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="security"]').click();
    await settle();
    document.querySelector('[data-action="mfa-setup"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/mfa/setup" && method === "POST",
      ),
    );

    const code = document.querySelector('#mfaCode, [name="mfaCode"]');
    assert.ok(code, "MFA setup should request a verification code");
    code.value = "123";
    document.querySelector('[data-action="mfa-enable"]').click();
    await settle();
    assert.equal(
      calls.some(({ path }) => path === "/api/account/mfa/enable"),
      false,
      "invalid codes must not reach the API",
    );

    const verificationCode = document.querySelector('[name="mfaCode"]');
    verificationCode.value = "123456";
    document.querySelector('[data-action="mfa-enable"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/account/mfa/enable" &&
          method === "POST" &&
          body.code === "123456",
      ),
    );
    assert.match(document.querySelector(".content").textContent, /enabled/i);

    document.querySelector('[name="mfaCode"]').value = "12";
    document.querySelector('[data-action="mfa-disable"]').click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/mfa/disable" && method === "POST",
      ),
      false,
      "invalid codes must not disable MFA",
    );
    document.querySelector('[name="mfaCode"]').value = "654321";
    document.querySelector('[data-action="mfa-disable"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/account/mfa/disable" &&
          method === "POST" &&
          body.code === "654321",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Account renderer preserves profile edits while offline", async () => {
  const harness = await renderConsole();
  try {
    const { calls, document, dom } = harness;
    const firstName = document.querySelector(
      '[data-form="profile"] [name="firstName"]',
    );
    firstName.value = "Offline Draft";
    dom.window.dispatchEvent(new dom.window.Event("offline"));
    await settle();

    const offlineForm = document.querySelector('[data-form="profile"]');
    assert.match(document.querySelector(".content").textContent, /offline/i);
    assert.equal(
      offlineForm.elements.namedItem("firstName").value,
      "Offline Draft",
    );
    assert.equal(
      offlineForm.querySelector('[data-action="save-profile"]').disabled,
      true,
    );

    dom.window.dispatchEvent(new dom.window.Event("online"));
    await settle();
    const onlineForm = document.querySelector('[data-form="profile"]');
    onlineForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/account/profile" &&
          method === "PUT" &&
          body.firstName === "Offline Draft",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Account renderer returns to sign-in after an expired session", async () => {
  const harness = await renderConsole();
  harness.setResponse("/api/account/profile", "GET", () => ({
    status: 401,
    kind: "unauthorized",
    body: { detail: "Session expired" },
  }));

  try {
    await settle();
    harness.document.querySelector('[data-route="security"]').click();
    await settle();
    harness.document.querySelector('[data-route="profile"]').click();
    await settle();

    assert.equal(
      harness.document.querySelector('[data-action="sign-in"]') !== null,
      true,
      "an expired session should return to the native sign-in screen",
    );
    assert.equal(harness.document.querySelector(".sidebar"), null);
    assert.ok(
      harness.calls.some(
        ({ path, method }) =>
          path === "/api/account/profile" && method === "GET",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Account renderer explains a timed-out request and retries successfully", async () => {
  const harness = await renderConsole();
  let timedOut = true;
  harness.setResponse("/api/account/profile", "GET", () => {
    if (timedOut) {
      timedOut = false;
      return {
        status: 408,
        kind: "timeout",
        body: { detail: "Request timed out" },
      };
    }
    return {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      preferredLocale: "en",
    };
  });

  try {
    const { calls, document } = harness;
    await settle();
    const initialProfileReads = calls.filter(
      ({ path, method }) => path === "/api/account/profile" && method === "GET",
    ).length;
    document.querySelector('[data-route="security"]').click();
    await settle();
    document.querySelector('[data-route="profile"]').click();
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /apiTimeout/,
    );
    const retry = document.querySelector('[data-action="retry"]');
    assert.ok(retry);
    retry.click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (document.querySelector('[data-form="profile"]')) break;
    }
    assert.ok(document.querySelector('[data-form="profile"]'));
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/profile" && method === "GET",
      ).length,
      initialProfileReads + 2,
    );
  } finally {
    harness.restore();
  }
});

test("native Account renderer completes social-link success and error callbacks", async () => {
  const harness = await renderConsole();
  try {
    const { calls, callbacks, document } = harness;
    document.querySelector('[data-route="security"]').click();
    await settle();
    document.querySelector('[data-action="social-start"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "social-link-start" && method === "github",
      ),
    );

    callbacks.socialLink({});
    await settle();
    assert.ok(document.querySelector('[role="status"]'));

    callbacks.socialLink({ error: "provider_error" });
    await settle();
    assert.ok(document.querySelector('[role="alert"]'));
    assert.doesNotMatch(
      calls.map(({ path, method }) => `${path} ${method ?? ""}`).join(" "),
      /(?:access|refresh|id)_?token|authorization.?code|test-only-secret|@example/i,
      "diagnostic call records must not contain credentials or profile data",
    );
  } finally {
    harness.restore();
  }
});

test("native Account social unlink confirms, reports forbidden access, and blocks duplicate requests", async () => {
  const harness = await renderConsole();
  let linked = true;
  let finishUnlink;
  let deleteAttempts = 0;
  const confirmations = [false, true, true];
  const previousConfirm = Object.getOwnPropertyDescriptor(
    globalThis,
    "confirm",
  );
  Object.defineProperty(globalThis, "confirm", {
    configurable: true,
    writable: true,
    value: () => confirmations.shift() ?? true,
  });
  harness.setResponse("/api/account/social-links", "GET", () => [
    {
      provider: "github",
      displayName: "GitHub",
      configured: true,
      enabled: true,
      linked,
    },
  ]);
  harness.setResponse("/api/account/social-links/github", "DELETE", () => {
    deleteAttempts += 1;
    if (deleteAttempts === 1)
      return {
        status: 403,
        kind: "forbidden",
        body: { detail: "Provider unlinking is forbidden" },
      };
    return new Promise((resolve) => {
      finishUnlink = () => {
        linked = false;
        resolve({ status: 204 });
      };
    });
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="security"]').click();
    await settle();
    const unlink = () =>
      document.querySelector('[data-action="social-remove"]');
    assert.ok(unlink());

    unlink().click();
    await settle();
    assert.equal(deleteAttempts, 0, "canceling must keep the provider linked");

    unlink().click();
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /403|forbidden/i,
    );

    unlink().click();
    await settle();
    const busyUnlink = unlink();
    assert.equal(busyUnlink.disabled, true);
    assert.ok(busyUnlink.querySelector(".spinner"));
    busyUnlink.click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/social-links/github" && method === "DELETE",
      ).length,
      2,
      "a pending provider unlink must reject duplicate submissions",
    );

    finishUnlink();
    await settle();
    assert.equal(unlink(), null);
    assert.equal(document.querySelector('[role="status"]') !== null, true);
  } finally {
    harness.restore();
    if (previousConfirm)
      Object.defineProperty(globalThis, "confirm", previousConfirm);
    else delete globalThis.confirm;
  }
});

test("native Account renderer presents field-level server validation errors", async () => {
  const harness = await renderConsole();
  harness.setResponse("/api/account/profile", "PUT", () => ({
    status: 422,
    kind: "validation",
    body: {
      detail: "The profile is invalid",
      violations: [{ field: "firstName", message: "First name is required" }],
    },
  }));

  try {
    await settle();
    const form = harness.document.querySelector('[data-form="profile"]');
    form.elements.namedItem("firstName").value = "Ada";
    form.dispatchEvent(
      new harness.document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const updatedForm = harness.document.querySelector('[data-form="profile"]');
    assert.match(
      updatedForm.querySelector('[name="firstName"]').parentElement.textContent,
      /First name is required/,
    );
    assert.ok(
      harness.calls.some(
        ({ path, method }) =>
          path === "/api/account/profile" && method === "PUT",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Account password update blocks weak or mismatched input and clears submitted secrets", async () => {
  const harness = await renderConsole();
  harness.setResponse("/api/account/password", "PUT", () => ({}));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="security"]').click();
    await settle();
    let form = document.querySelector('[data-form="password"]');
    assert.ok(form);
    form.elements.namedItem("currentPassword").value = "Current-Test-42";
    form.elements.namedItem("newPassword").value = "short";
    form.elements.namedItem("confirmPassword").value = "short";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/password" && method === "PUT",
      ),
      false,
      "weak passwords must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /passwordMismatch/,
    );

    form = document.querySelector('[data-form="password"]');
    form.elements.namedItem("currentPassword").value = "Current-Test-42";
    form.elements.namedItem("newPassword").value = "Strong-Test-Password-42";
    form.elements.namedItem("confirmPassword").value =
      "Different-Test-Password-42";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/password" && method === "PUT",
      ),
      false,
      "mismatched confirmation must not reach the API",
    );
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /passwordMismatch/,
    );

    form = document.querySelector('[data-form="password"]');
    form.elements.namedItem("currentPassword").value = "Current-Test-42";
    form.elements.namedItem("newPassword").value = "Strong-Test-Password-42";
    form.elements.namedItem("confirmPassword").value =
      "Strong-Test-Password-42";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/account/password" && method === "PUT",
    );
    assert.ok(save);
    assert.equal(save.body.newPassword === "Strong-Test-Password-42", true);
    const savedForm = document.querySelector('[data-form="password"]');
    assert.equal(savedForm.elements.namedItem("currentPassword").value, "");
    assert.equal(savedForm.elements.namedItem("newPassword").value, "");
    assert.equal(savedForm.elements.namedItem("confirmPassword").value, "");
  } finally {
    harness.restore();
  }
});

test("native Account session revocation confirms, disables duplicates, and refreshes the list", async () => {
  const harness = await renderConsole();
  let finishRevoke;
  let otherSessionActive = true;
  const previousConfirm = Object.getOwnPropertyDescriptor(
    globalThis,
    "confirm",
  );
  Object.defineProperty(globalThis, "confirm", {
    configurable: true,
    writable: true,
    value: () => true,
  });
  harness.setResponse("/api/account/sessions?page=0&size=20", "GET", () => ({
    content: otherSessionActive
      ? [
          { id: "current-session", current: true },
          { id: "other-session", current: false },
        ]
      : [{ id: "current-session", current: true }],
  }));
  harness.setResponse(
    "/api/account/sessions/other-session",
    "DELETE",
    () =>
      new Promise((resolve) => {
        finishRevoke = () => {
          otherSessionActive = false;
          resolve({ status: 204 });
        };
      }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="sessions"]').click();
    await settle();
    const revokeButton = document
      .querySelector('[data-id="other-session"]')
      .querySelector('[data-action="delete-session"]');
    assert.ok(revokeButton);
    revokeButton.click();
    await settle();
    const busyButton = document
      .querySelector('[data-id="other-session"]')
      .querySelector('[data-action="delete-session"]');
    assert.equal(busyButton.disabled, true);
    assert.ok(busyButton.querySelector(".spinner"));
    busyButton.click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/sessions/other-session" && method === "DELETE",
      ).length,
      1,
    );

    finishRevoke();
    await settle();
    assert.equal(document.querySelector('[data-id="other-session"]'), null);
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/sessions?page=0&size=20" && method === "GET",
      ).length,
      2,
    );
  } finally {
    harness.restore();
    if (previousConfirm)
      Object.defineProperty(globalThis, "confirm", previousConfirm);
    else delete globalThis.confirm;
  }
});

test("native Account application and offline-session revocation handles cancel, pending, and forbidden responses", async () => {
  const harness = await renderConsole();
  let finishApplicationRevoke;
  let confirmations = [false, true, true];
  const previousConfirm = Object.getOwnPropertyDescriptor(
    globalThis,
    "confirm",
  );
  Object.defineProperty(globalThis, "confirm", {
    configurable: true,
    writable: true,
    value: () => confirmations.shift() ?? true,
  });
  harness.setResponse(
    "/api/account/applications/desktop-client",
    "DELETE",
    () =>
      new Promise((resolve) => {
        finishApplicationRevoke = () => resolve({ status: 204 });
      }),
  );
  harness.setResponse(
    "/api/account/offline-sessions/offline-session",
    "DELETE",
    () => ({
      status: 403,
      kind: "forbidden",
      body: { detail: "You cannot revoke this session" },
    }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="applications"]').click();
    await settle();

    const applicationItem = document.querySelector(
      '[data-id="desktop-client"]',
    );
    const applicationButton = applicationItem.querySelector(
      '[data-action="revoke-application"]',
    );
    applicationButton.click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/applications/desktop-client" &&
          method === "DELETE",
      ),
      false,
      "canceling the confirmation must not revoke the application",
    );

    applicationButton.click();
    await settle();
    const busyApplicationButton = document.querySelector(
      '[data-id="desktop-client"] [data-action="revoke-application"]',
    );
    assert.equal(busyApplicationButton.disabled, true);
    assert.ok(busyApplicationButton.querySelector(".spinner"));
    busyApplicationButton.click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/applications/desktop-client" &&
          method === "DELETE",
      ).length,
      1,
      "a pending revoke must reject duplicate submissions",
    );

    finishApplicationRevoke();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/applications/desktop-client" &&
          method === "DELETE",
      ),
      true,
    );

    document
      .querySelector(
        '[data-id="offline-session"] [data-action="revoke-offline"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/offline-sessions/offline-session" &&
          method === "DELETE",
      ),
    );
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /403|forbidden/i,
    );
  } finally {
    harness.restore();
    if (previousConfirm)
      Object.defineProperty(globalThis, "confirm", previousConfirm);
    else delete globalThis.confirm;
  }
});

test("native Account deletion requires the password and clears its local session", async () => {
  const harness = await renderConsole();
  const previousConfirm = Object.getOwnPropertyDescriptor(
    globalThis,
    "confirm",
  );
  Object.defineProperty(globalThis, "confirm", {
    configurable: true,
    writable: true,
    value: () => true,
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="security"]').click();
    await settle();
    let form = document.querySelector('[data-form="delete"]');
    assert.ok(form);
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === "/api/account" && method === "DELETE",
      ),
      false,
      "account deletion without re-authentication must not reach the API",
    );
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /passwordRequired/,
    );

    form = document.querySelector('[data-form="delete"]');
    form.elements.namedItem("deletePassword").value = "Current-Test-42";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/account" &&
          method === "DELETE" &&
          body.currentPassword === "Current-Test-42",
      ),
    );
    assert.ok(
      calls.some(
        ({ path, method }) => path === "clear-session" && method === "account",
      ),
    );
    assert.ok(document.querySelector('[data-action="sign-in"]'));
  } finally {
    harness.restore();
    if (previousConfirm)
      Object.defineProperty(globalThis, "confirm", previousConfirm);
    else delete globalThis.confirm;
  }
});

test("native Account async save keeps its label, shows progress, and blocks repeats", async () => {
  const harness = await renderConsole();
  let finishProfileSave;
  harness.setResponse(
    "/api/account/profile",
    "PUT",
    () =>
      new Promise((resolve) => {
        finishProfileSave = () =>
          resolve({
            firstName: "Augusta",
            lastName: "King",
            email: "ada@example.test",
            preferredLocale: "en",
          });
      }),
  );

  try {
    await settle();
    const { calls, document } = harness;
    const form = document.querySelector('[data-form="profile"]');
    form.elements.namedItem("firstName").value = "Augusta";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const busyButton = document.querySelector('[data-action="save-profile"]');
    const busyLabel = busyButton.textContent;
    assert.equal(busyButton.disabled, true);
    assert.ok(busyButton.querySelector(".spinner"));
    busyButton.click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/account/profile" && method === "PUT",
      ).length,
      1,
    );

    finishProfileSave();
    await settle();
    const completedButton = document.querySelector(
      '[data-action="save-profile"]',
    );
    assert.equal(completedButton.disabled, false);
    assert.equal(completedButton.querySelector(".spinner"), null);
    assert.equal(completedButton.textContent, busyLabel);
  } finally {
    harness.restore();
  }
});

test("native sign-in keeps pending state, cancels login, and reports startup failures", async () => {
  let failStart = false;
  const harness = await renderConsole("account", {
    hasSession: false,
    startLogin: async () => {
      if (failStart) throw new Error("expected test failure");
      return new Promise(() => {});
    },
  });
  try {
    const { calls, callbacks, document } = harness;
    await settle();
    const signIn = document.querySelector('[data-action="sign-in"]');
    assert.ok(signIn.disabled);
    assert.equal(signIn.getAttribute("aria-busy"), "true");
    assert.equal(calls.filter(({ path }) => path === "start-login").length, 1);

    document.querySelector('[data-action="cancel-sign-in"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) => path === "cancel-login" && method === "account",
      ),
    );
    assert.ok(document.querySelector('[data-action="sign-in"]'));

    failStart = true;
    document.querySelector('[data-action="sign-in"]').click();
    await settle();
    assert.ok(document.querySelector('[role="alert"]').textContent);
    assert.equal(calls.filter(({ path }) => path === "start-login").length, 2);

    callbacks.auth({ error: "access_denied" });
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /authError/,
    );
  } finally {
    harness.restore();
  }
});

test("native hydration handles session lookup and admin identity failures", async () => {
  const account = await renderConsole("account", { hasSessionFailure: true });
  try {
    await settle();
    assert.ok(account.document.querySelector('[data-action="sign-in"]'));
    assert.equal(
      account.calls.filter(({ path }) => path.startsWith("/api/")).length,
      0,
    );
    account.document
      .querySelector('[data-action="cancel-sign-in"]')
      .click();
    await settle();
  } finally {
    account.restore();
  }

  const admin = await renderConsole("admin", {
    response: async (path) =>
      path === "/api/admin/whoami" ? { status: 403, body: {} } : undefined,
  });
  try {
    await settle();
    assert.ok(admin.document.querySelector('[role="alert"]'));
    assert.ok(admin.calls.some(({ path }) => path === "/api/admin/whoami"));
  } finally {
    admin.restore();
  }

  const invalidIdentity = await renderConsole("admin", {
    response: async (path) =>
      path === "/api/admin/whoami" ? { access: {} } : undefined,
  });
  try {
    await settle();
    assert.ok(
      invalidIdentity.calls.some(({ path }) => path === "/api/admin/whoami"),
    );
    assert.ok(invalidIdentity.document.querySelector(".sidebar"));
  } finally {
    invalidIdentity.restore();
  }

  const recovered = await renderConsole("admin", { sessionConsole: "account" });
  try {
    await settle();
    assert.ok(
      recovered.calls.some(({ path }) => path === "/api/account/profile"),
    );
    assert.equal(
      recovered.calls.some(({ path }) => path.startsWith("/api/admin/")),
      false,
    );
  } finally {
    recovered.restore();
  }
});

test("native logout clears the local console after both successful and failed server logout", async () => {
  for (const logoutFails of [false, true]) {
    const harness = await renderConsole("account", { logoutFails });
    try {
      const { calls, document } = harness;
      document.querySelector('[data-route="settings"]').click();
      await settle();
      document.querySelector('[data-action="logout"]').click();
      await settle();
      assert.ok(calls.some(({ path }) => path === "logout"));
      if (logoutFails) {
        assert.ok(document.querySelector('[role="alert"]'));
        assert.ok(document.querySelector('[data-action="sign-in"]'));
      } else {
        assert.ok(document.querySelector('[data-action="sign-in"]'));
      }
    } finally {
      harness.restore();
    }
  }
});
