import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseVisibleEditorActions,
  renderConsole,
  settle,
} from "./native-renderer-harness.mjs";

test("native Authentication mirrors policy tabs and saves through the existing settings API", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminFlowAliasPatternError:
          "Start with a lowercase letter or number; use lowercase letters, numbers, dots, underscores or hyphens.",
        adminFlowNameRequired: "Enter a name.",
        adminFlowList: "Admin Top-level flows",
        adminFlowSettings: "Admin Flow settings",
        adminFlowGraph: "Flow graph",
        adminExecutions: "Admin Executions",
        adminFlowBindings: "Admin Bindings",
        adminPasswordPolicy: "Admin Password policy",
        adminOtpPolicy: "Admin OTP policy",
        adminWebAuthnPolicy: "Admin WebAuthn policy",
        adminSaveFlow: "Save flow",
        adminUnbind: "Remove binding",
      },
    },
  });
  const defaults = {
    passwordMinimumLength: 12,
    passwordMaximumLength: 128,
    passwordMinimumUppercase: 1,
    passwordMinimumLowercase: 1,
    passwordMinimumDigits: 1,
    passwordMinimumSpecialCharacters: 1,
    passwordRejectUsername: true,
    passwordRejectEmail: true,
    passwordRejectCommonPasswords: true,
    passwordHistorySize: 5,
    passwordExpirationDays: 90,
    passwordCommonPasswords: "password,123456",
    otpEnabled: false,
    otpRequired: false,
    otpIssuer: "Kitezh",
    otpAlgorithm: "SHA1",
    otpDigits: 6,
    otpPeriodSeconds: 30,
    otpLookAheadWindow: 1,
    otpCodeReusable: false,
    otpAddRecoveryCodes: false,
    recoveryCodeWarningThreshold: 2,
    webauthnMediation: "none",
    webauthnPolicy: {
      rpName: "Kitezh",
      rpId: "",
      signatureAlgorithms: "ES256,RS256,EdDSA",
      attestation: "none",
      authenticatorAttachment: "any",
      residentKey: "preferred",
      userVerification: "preferred",
      timeoutSeconds: 300,
      avoidSameAuthenticator: true,
      acceptableAaguids: "",
    },
    webauthnPasswordlessPolicy: {
      rpName: "Kitezh",
      rpId: "",
      signatureAlgorithms: "ES256,RS256,EdDSA",
      attestation: "none",
      authenticatorAttachment: "any",
      residentKey: "required",
      userVerification: "required",
      timeoutSeconds: 300,
      avoidSameAuthenticator: true,
      acceptableAaguids: "",
    },
  };
  harness.setResponse("/api/admin/settings/login", "GET", () => defaults);
  const flow = {
    id: 9,
    alias: "browser",
    name: "Browser flow",
    description: "Interactive login",
    flowType: "BASIC",
    requirement: null,
    priority: 0,
    builtIn: false,
    topLevel: true,
  };
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 1, totalPages: 1, number: 0 }),
  );
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => [
    { bindingType: "BROWSER", flowId: 9, flowName: "Browser flow" },
  ]);
  harness.setResponse(
    "/api/admin/authentication/execution-providers",
    "GET",
    () => ["password-form"],
  );
  harness.setResponse("/api/admin/authentication/flows/9", "GET", () => ({
    flow,
    executions: [],
    subFlows: [],
    nodes: [],
  }));
  harness.setResponse(
    "/api/admin/authentication/bindings/BROWSER",
    "DELETE",
    () => ({
      bindingType: "BROWSER",
      flowId: null,
      flowName: null,
      flowAlias: null,
    }),
  );
  try {
    const { calls, document, renderer } = harness;
    Object.defineProperty(document.defaultView, "confirm", {
      configurable: true,
      value: () => true,
    });
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    assert.equal(
      document.querySelectorAll(
        '[data-action="admin-authentication-policy-tab"]',
      ).length,
      3,
    );
    assert.deepEqual(
      [
        ...document.querySelectorAll(
          '[data-action="admin-authentication-policy-tab"]',
        ),
      ].map((tab) => tab.textContent.trim()),
      ["Password policy", "OTP policy", "WebAuthn policy"],
    );
    assert.ok(
      document.querySelector(
        '[data-form="admin-authentication-policy"] [name="passwordMaximumLength"]',
      ),
    );
    assert.equal(
      document.querySelectorAll(
        '[data-form="admin-authentication-policy"] input[role="switch"]',
      ).length,
      3,
    );
    assert.equal(
      document.querySelectorAll(
        '[data-form="admin-authentication-policy"] input[type="checkbox"]:not([role="switch"])',
      ).length,
      0,
    );
    assert.ok(
      document.querySelector(
        '[data-form="admin-authentication-policy"] input[role="switch"] + .admin-user-detail-switch-control',
      ),
    );
    document
      .querySelector(
        '[data-action="admin-authentication-policy-tab"][data-tab="otp-policy"]',
      )
      .click();
    await settle();
    assert.equal(
      document.querySelectorAll(
        '[data-form="admin-authentication-policy"] input[role="switch"]',
      ).length,
      4,
    );
    assert.ok(
      document.querySelector(
        '[data-form="admin-authentication-policy"] [name="otpRecoveryCodes"]',
      ) === null,
    );
    assert.ok(
      document.querySelector(
        '[data-form="admin-authentication-policy"] [name="otpAddRecoveryCodes"]',
      ),
    );
    document
      .querySelector(
        '[data-action="admin-authentication-policy-tab"][data-tab="webauthn"]',
      )
      .click();
    await settle();
    assert.equal(
      document.querySelectorAll(
        '[data-form="admin-authentication-policy"] input[role="switch"]',
      ).length,
      2,
    );
    assert.ok(document.querySelector('[name="webauthnPolicy.rpId"]'));
    assert.ok(
      document.querySelector(
        '[name="webauthnPasswordlessPolicy.userVerification"]',
      ),
    );
    assert.equal(
      document.querySelector('[name="webauthnPolicy.residentKey"]').value,
      "preferred",
    );
    assert.equal(
      document.querySelector(
        '[name="webauthnPasswordlessPolicy.userVerification"]',
      ).value,
      "required",
    );
    const webauthnSwitch = document.querySelector(
      '[name="webauthnPolicy.avoidSameAuthenticator"]',
    );
    webauthnSwitch.checked = false;
    webauthnSwitch.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    document
      .querySelector(
        '[data-action="admin-authentication-tab"][data-tab="flows"]',
      )
      .click();
    await settle();
    assert.equal(
      document
        .querySelector(
          '[data-action="admin-authentication-tab"][data-tab="flows"]',
        )
        .getAttribute("aria-selected"),
      "true",
    );
    assert.ok(
      document.querySelector(
        '[data-action="admin-auth-flow-tab"][data-tab="flow-list"]',
      ),
    );
    assert.deepEqual(
      [...document.querySelectorAll('[data-action="admin-auth-flow-tab"]')].map(
        (tab) => tab.dataset.tab,
      ),
      ["flow-list", "settings", "graph", "executions", "bindings"],
    );
    assert.deepEqual(
      [...document.querySelectorAll('[data-action="admin-auth-flow-tab"]')].map(
        (tab) => tab.textContent.trim(),
      ),
      [
        "Top-level flows",
        "Flow settings",
        "Flow graph",
        "Executions",
        "Bindings",
      ],
    );
    assert.ok(
      document.querySelector(
        '.admin-auth-page-header [data-action="admin-auth-flow-create"]',
      ),
    );
    assert.equal(
      document.querySelectorAll('[data-action="admin-auth-flow-create"]')
        .length,
      1,
    );
    const flowCreateButton = document.querySelector(
      '[data-action="admin-auth-flow-create"]',
    );
    flowCreateButton.click();
    await settle();
    const createForm = document.querySelector(
      '[data-form="admin-auth-flow"][data-kind="create"]',
    );
    assert.equal(createForm.elements.namedItem("priority").value, "10");
    createForm.elements.namedItem("alias").value = "Invalid Alias";
    createForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.match(
      createForm
        .querySelector('[name="alias"]')
        .closest(".field")
        .querySelector(".field-error").textContent,
      /lowercase/i,
    );
    assert.match(
      createForm
        .querySelector('[name="name"]')
        .closest(".field")
        .querySelector(".field-error").textContent,
      /name/i,
    );
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/authentication/flows" && method === "POST",
      ),
      false,
    );
    createForm.querySelector('[data-action="admin-auth-flow-cancel"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="flow-list"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-select"][data-id="9"]')
      .click();
    await settle();
    assert.deepEqual(
      [...document.querySelectorAll('[data-action="admin-auth-flow-tab"]')].map(
        (tab) => tab.dataset.tab,
      ),
      ["flow-list", "settings", "graph", "executions", "bindings"],
    );
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="settings"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-form="admin-auth-flow"][data-kind="edit"]'),
    );
    assert.equal(
      document.querySelector(".admin-auth-flow-detail-heading h2").textContent,
      "Flow graph",
    );
    assert.equal(
      document
        .querySelector('[data-form="admin-auth-flow"] [type="submit"]')
        .textContent.trim(),
      "Save flow",
    );
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="graph"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-auth-flow-sub-create"]'),
    );
    document
      .querySelector(
        '[data-action="admin-auth-flow-tab"][data-tab="executions"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-auth-execution-create"]'),
    );
    document
      .querySelector('[data-action="admin-auth-execution-create"]')
      .click();
    await settle();
    const executionForm = document.querySelector(
      '[data-form="admin-auth-execution"]',
    );
    assert.equal(executionForm.elements.namedItem("priority").value, "10");
    assert.ok(executionForm.elements.namedItem("authenticatorReference"));
    assert.ok(executionForm.elements.namedItem("configuration"));
    executionForm
      .querySelector('[data-action="admin-auth-flow-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="bindings"]')
      .click();
    await settle();
    const bindingSelect = document.querySelector(
      '[data-auth-binding-select="true"][data-binding="BROWSER"]',
    );
    assert.ok(document.querySelector(".admin-auth-binding-table"));
    assert.equal(bindingSelect.value, "9");
    bindingSelect.value = "";
    bindingSelect.dispatchEvent(new document.defaultView.Event("change"));
    assert.match(
      document.querySelector('[data-action="admin-auth-binding-save"]')
        .textContent,
      /Remove binding/,
    );
    bindingSelect.value = "9";
    bindingSelect.dispatchEvent(new document.defaultView.Event("change"));
    bindingSelect.value = "";
    bindingSelect.dispatchEvent(new document.defaultView.Event("change"));
    document.querySelector('[data-action="admin-auth-binding-save"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/authentication/bindings/BROWSER" &&
          method === "DELETE",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-authentication-tab"][data-tab="policies"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-authentication-policy-tab"][data-tab="otp-policy"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-authentication-policy"]',
    );
    form.elements.namedItem("otpRequired").checked = true;
    form.elements.namedItem("otpRequired").dispatchEvent(
      new document.defaultView.Event("change"),
    );
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.match(document.querySelector('[role="alert"]').textContent, /OTP/i);
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/settings/login" && method === "PUT",
      ).length,
      0,
    );
    form.elements.namedItem("otpEnabled").checked = true;
    form.elements.namedItem("otpIssuer").value = "Kitezh Desktop";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const saved = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/login" && method === "PUT",
    );
    assert.equal(saved.body.otpEnabled, true);
    assert.equal(saved.body.otpIssuer, "Kitezh Desktop");
    document
      .querySelector('[data-action="admin-authentication-policy-cancel"]')
      .click();
    await settle();
  } finally {
    harness.restore();
  }
});

test("native Administration Settings follows the Web tab order and exposes the matching sub-tabs", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminNavSettings: "Settings",
        settingsGeneral: "General",
        settingsLogin: "Login",
        settingsSocialLogin: "Social login",
        settingsUserFederation: "User federation",
        settingsEmail: "Email",
        settingsBruteForce: "Brute force",
        adminSessions: "Sessions",
        adminEvents: "Events",
        adminCibaPolicy: "CIBA policy",
        settingsOfflineAccess: "Offline access",
        settingsUserProfile: "User profile",
        adminLocalization: "Localization",
        adminBranding: "Branding",
        adminLocalizationSettings: "Settings",
        adminMessageOverrides: "Message overrides",
        adminEffectiveMessages: "Effective messages",
        adminEffectiveMessagesDescription: "Resolved localized messages.",
        adminLanguage: "Language",
        adminSearch: "Search",
        adminMessageKey: "Message key",
        adminMessageValue: "Message value",
        adminRecords: "records",
        adminNoMessageOverrides: "No message overrides.",
      },
      tr: {},
    },
  });
  harness.setResponse("/api/admin/server-info", "GET", () => ({ issuer: "https://issuer.test" }));
  harness.setResponse("/api/admin/settings/login", "GET", () => ({ userRegistration: true }));
  harness.setResponse("/api/admin/settings/registration-captcha", "GET", () => ({ enabled: false }));
  harness.setResponse("/api/admin/settings/social-providers", "GET", () => []);
  harness.setResponse("/api/admin/settings/ldap", "GET", () => []);
  harness.setResponse("/api/admin/settings/email", "GET", () => ({ enabled: false }));
  harness.setResponse("/api/admin/events/config", "GET", () => ({ eventsEnabled: true }));
  harness.setResponse("/api/admin/settings/ciba-policy", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/offline-access", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({ internationalizationEnabled: true }));
  harness.setResponse("/api/admin/settings/localization/messages?page=0&size=20&sort=locale,asc", "GET", () => ({ content: [] }));
  harness.setResponse("/api/admin/settings/branding", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/user-profile/page?q=&page=0&size=20&sort=displayOrder,asc", "GET", () => ({ content: [] }));
  harness.setResponse("/api/admin/settings/user-profile", "POST", ({ body }) => ({ id: 3, ...body }));

  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="configuration"]').click();
    await settle();
    assert.deepEqual(
      [...document.querySelectorAll(".admin-settings-tabs [role=tab]")].map((tab) => tab.textContent),
      ["General", "Login", "Social login", "User federation", "Email", "Brute force", "Sessions", "Events", "CIBA policy", "Offline access", "User profile", "Localization", "Branding"],
    );
    assert.match(document.querySelector(".admin-settings-panel").textContent, /https:\/\/issuer\.test/);
    document.querySelector('[data-action="admin-settings-tab"][data-tab="login"]').click();
    assert.ok(document.querySelector('[data-form="admin-settings-captcha"]'));
    assert.ok(document.querySelectorAll('.admin-settings-panel .native-settings-switch input[role="switch"]').length > 0);
    assert.equal(document.querySelector('.admin-settings-panel .native-settings-switch-control')?.parentElement?.classList.contains("native-settings-switch"), true);
    document.querySelector('[data-action="admin-settings-tab"][data-tab="social-login"]').click();
    assert.equal(document.querySelectorAll('.admin-settings-panel fieldset').length, 4);
    document.querySelector('[data-action="admin-settings-tab"][data-tab="localization"]').click();
    assert.deepEqual(
      [...document.querySelectorAll(".admin-settings-subtabs [role=tab]")].map((tab) => tab.textContent),
      ["Settings", "Message overrides", "Effective messages"],
    );
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="effective"]').click();
    assert.ok(document.querySelector("#admin-settings-effective-locale"));
    await openAdminSettingsTab(document, "user-profile");
    document.querySelector('[data-action="admin-settings-profile-create"]').click();
    const profileForm = document.querySelector('[data-form="admin-settings-profile"]');
    assert.ok(profileForm);
    profileForm.elements.namedItem("name").value = "preferredName";
    profileForm.elements.namedItem("displayName").value = "Preferred name";
    profileForm.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    assert.ok(harness.calls.some(({ path, method, body }) => path === "/api/admin/settings/user-profile" && method === "POST" && body.name === "preferredName"));
    for (const tab of ["general", "login", "social-login", "user-federation", "email", "brute-force", "sessions", "events", "ciba-policy", "offline-access", "user-profile", "localization", "branding"]) {
      await openAdminSettingsTab(document, tab);
      assert.equal(
        document.querySelectorAll('.admin-settings-panel input[type="checkbox"]:not([role="switch"])').length,
        0,
        `The ${tab} Settings tab should render boolean controls as switches`,
      );
    }
  } finally {
    harness.restore();
  }
});

test("native Administration Settings submits Web settings actions and handles profile and locale navigation", async () => {
  const harness = await renderConsole("admin");
  const profile = {
    id: 7,
    name: "displayName",
    displayName: "Display name",
    description: "Shown to users",
    type: "STRING",
    required: false,
    multivalued: false,
    enabled: true,
    displayOrder: 1,
  };
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/registration-captcha", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/social-providers", "GET", () => []);
  harness.setResponse("/api/admin/settings/email", "GET", () => ({}));
  harness.setResponse("/api/admin/events/config", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({ internationalizationEnabled: true }));
  harness.setResponse("/api/admin/settings/localization/messages?page=0&size=20&sort=locale,asc", "GET", () => ({ content: [] }));
  let profileReads = 0;
  harness.setResponse("/api/admin/settings/user-profile/page?q=&page=0&size=20&sort=displayOrder,asc", "GET", () => ({ content: profileReads++ === 0 ? [profile] : [] }));
  harness.setResponse("/api/admin/settings/user-profile/7", "DELETE", () => ({}));
  try {
    const { calls, document } = harness;
    document.defaultView.confirm = () => true;
    await settle();
    document.querySelector('[data-route="configuration"]').click();
    await settle();

    const submitSettings = async (tab, formSelector, savePath) => {
      await openAdminSettingsTab(document, tab);
      const form = document.querySelector(formSelector);
      assert.ok(form, `${tab} form should render`);
      form.reportValidity = () => true;
      if (tab === "events") form.elements.namedItem("eventsExpirationDays").value = "365";
      form.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
      await settle();
      assert.ok(calls.some(({ path, method }) => path === savePath && method === "PUT"), `${tab} settings should save; calls: ${JSON.stringify(calls.slice(-8))}`);
    };

    await submitSettings("social-login", '[data-form="admin-settings-social"]', "/api/admin/settings/social-providers");
    assert.ok(calls.some(({ path, method }) => path === "/api/admin/settings/login" && method === "PUT"));
    await openAdminSettingsTab(document, "login");
    const loginPolicyForm = document.querySelector('[data-form="admin-settings-login"]');
    assert.ok(loginPolicyForm);
    loginPolicyForm.reportValidity = () => true;
    loginPolicyForm.elements.namedItem("otpRequired").checked = true;
    loginPolicyForm.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    const invalidLoginPolicyForm = document.querySelector('[data-form="admin-settings-login"]');
    assert.ok(invalidLoginPolicyForm);
    invalidLoginPolicyForm.reportValidity = () => true;
    invalidLoginPolicyForm.elements.namedItem("otpRequired").checked = false;
    invalidLoginPolicyForm.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    assert.ok(calls.some(({ path, method }) => path === "/api/admin/settings/login" && method === "PUT"));
    await submitSettings("login", '[data-form="admin-settings-captcha"]', "/api/admin/settings/registration-captcha");
    await submitSettings("events", '[data-form="admin-settings-events"]', "/api/admin/events/config");

    await openAdminSettingsTab(document, "email");
    const emailForm = document.querySelector('[data-form="admin-email-settings"]');
    assert.ok(emailForm);
    emailForm.elements.namedItem("fromAddress").value = "admin@example.test";
    emailForm.elements.namedItem("baseUrl").value = "https://example.test";
    emailForm.elements.namedItem("host").value = "smtp.example.test";
    emailForm.elements.namedItem("port").value = "587";
    emailForm.reportValidity = () => true;
    harness.setResponse("/api/admin/settings/email/test", "POST", () => { throw new Error("SMTP connection failed"); });
    document.querySelector('[data-action="admin-settings-email-test"]').click();
    await settle();
    assert.equal(calls.filter(({ path, method }) => path === "/api/admin/settings/email/test" && method === "POST").length, 1);

    await openAdminSettingsTab(document, "user-profile");
    document.querySelector('[data-action="admin-settings-profile-edit"][data-id="7"]').click();
    assert.ok(document.querySelector('[data-form="admin-settings-profile"]'));
    document.querySelector('[data-action="admin-settings-profile-cancel"]').click();
    document.querySelector('[data-action="admin-settings-profile-delete"][data-id="7"]').click();
    document.querySelector('[data-action="admin-settings-profile-delete-confirm"]').click();
    await settle();
    assert.ok(calls.some(({ path, method }) => path === "/api/admin/settings/user-profile/7" && method === "DELETE"));

    await openAdminSettingsTab(document, "localization");
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="settings"]').click();
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="overrides"]').click();
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="effective"]').click();
    document.querySelector("#admin-settings-effective-locale").dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    document.querySelector("#admin-settings-effective-search").dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    const exerciseTabs = (selector) => {
      for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
        const tab = document.querySelector(selector);
        tab.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key, bubbles: true }));
      }
    };
    exerciseTabs(".admin-settings-subtabs [role=tab]");
    exerciseTabs(".admin-settings-tabs [role=tab]");
    await openAdminSettingsTab(document, "user-profile");
    const profileSearch = document.querySelector('[data-input="admin-settings-profile-search"]');
    profileSearch.value = "display";
    profileSearch.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  } finally {
    harness.restore();
  }
});

test("native email test connection reports success from its settings form", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({}));
  try {
    const { calls, document } = harness;
    await settle();
    document.querySelector('[data-route="configuration"]').click();
    await settle();
    await openAdminSettingsTab(document, "email");
    const form = document.querySelector('[data-form="admin-email-settings"]');
    form.elements.namedItem("fromAddress").value = "admin@example.test";
    form.elements.namedItem("baseUrl").value = "https://example.test";
    form.elements.namedItem("host").value = "smtp.example.test";
    form.elements.namedItem("port").value = "587";
    form.reportValidity = () => true;
    document.querySelector('[data-action="admin-settings-email-test"]').click();
    await settle();
    assert.ok(calls.some(({ path, method }) => path === "/api/admin/settings/email/test" && method === "POST"));
  } finally {
    harness.restore();
  }
});

test("native built-in flow settings keep Web's editable save action and submit only flow fields", async () => {
  const harness = await renderConsole("admin");
  const flow = {
    id: 9,
    alias: "browser",
    name: "Browser",
    description: "Default browser authentication flow.",
    flowType: "BASIC",
    requirement: null,
    priority: 0,
    builtIn: true,
    topLevel: true,
  };
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 1, totalPages: 1, number: 0 }),
  );
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => []);
  harness.setResponse(
    "/api/admin/authentication/execution-providers",
    "GET",
    () => ["username-password-form"],
  );
  harness.setResponse("/api/admin/authentication/flows/9", "GET", () => ({
    flow,
    executions: [],
    subFlows: [],
    nodes: [],
  }));
  harness.setResponse("/api/admin/authentication/flows/9", "PUT", (body) => ({
    ...flow,
    ...body,
  }));
  try {
    const { calls, document } = harness;
    document.defaultView.confirm = () => true;
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-authentication-tab"][data-tab="flows"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="settings"]')
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-auth-flow"][data-kind="edit"]',
    );
    assert.ok(form.elements.namedItem("alias").disabled);
    assert.ok(form.elements.namedItem("name").disabled);
    assert.equal(form.querySelector('[type="submit"]').disabled, false);
    assert.equal(
      form.querySelector('[data-action="admin-auth-flow-cancel"]'),
      null,
    );
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const saved = calls.find(
      ({ path, method }) =>
        path === "/api/admin/authentication/flows/9" && method === "PUT",
    );
    assert.deepEqual(saved.body, {
      alias: "browser",
      name: "Browser",
      description: "Default browser authentication flow.",
      flowType: "BASIC",
      priority: 0,
      requirement: null,
    });
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="bindings"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '.admin-auth-binding-table [role="status"]',
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native authentication flow editor covers flow, graph, execution and binding actions", async () => {
  const harness = await renderConsole("admin");
  const flow = {
    id: 9,
    alias: "browser",
    name: "Browser flow",
    description: "Interactive login",
    flowType: "BASIC",
    requirement: null,
    priority: 0,
    builtIn: false,
    topLevel: true,
  };
  const details = {
    flow,
    executions: [
      {
        id: 34,
        providerId: "password-form",
        displayName: "Password form",
        requirement: "REQUIRED",
        priority: 10,
        authenticatorReference: "password",
        configuration: "{}",
      },
    ],
    subFlows: [{ id: 35, alias: "forms", name: "Forms" }],
    nodes: [
      {
        id: 34,
        nodeType: "EXECUTION",
        name: "Password form",
        providerId: "password-form",
        requirement: "REQUIRED",
      },
      {
        id: 35,
        nodeType: "SUB_FLOW",
        name: "Forms",
        providerId: null,
        requirement: "ALTERNATIVE",
      },
    ],
  };
  let rejectFlowDetail = false;
  let rejectFlowCreate = false;
  let rejectSubFlowDetail = false;
  let rejectMove = false;
  let rejectExecutionCreate = false;
  let rejectExecutionDelete = false;
  let rejectBindingSave = false;
  let rejectFlowDelete = false;
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 25, totalPages: 2, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=10&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 25, totalPages: 3, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/authentication/flows?page=1&size=20&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 25, totalPages: 2, number: 1 }),
  );
  harness.setResponse(
    "/api/admin/authentication/flows?page=1&size=10&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 25, totalPages: 3, number: 1 }),
  );
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => [
    { bindingType: "BROWSER", flowId: 9, flowName: "Browser flow" },
  ]);
  harness.setResponse(
    "/api/admin/authentication/execution-providers",
    "GET",
    () => ["password-form", "webauthn-authenticator"],
  );
  harness.setResponse("/api/admin/authentication/flows/9", "GET", () => {
    if (rejectFlowDetail) {
      rejectFlowDetail = false;
      throw new Error("expected flow detail failure");
    }
    return details;
  });
  harness.setResponse("/api/admin/authentication/flows", "POST", () => {
    if (rejectFlowCreate) {
      rejectFlowCreate = false;
      throw new Error("expected flow create failure");
    }
    return { id: 10 };
  });
  harness.setResponse("/api/admin/authentication/flows/35", "GET", () => {
    if (rejectSubFlowDetail) {
      rejectSubFlowDetail = false;
      throw new Error("expected sub-flow detail failure");
    }
    return {
      ...details,
      flow: { ...flow, id: 35, alias: "forms", name: "Forms" },
      nodes: [],
    };
  });
  harness.setResponse(
    "/api/admin/authentication/bindings/BROWSER",
    "PUT",
    () => {
      if (rejectBindingSave) {
        rejectBindingSave = false;
        throw new Error("expected binding save failure");
      }
      return undefined;
    },
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9",
    "PUT",
    () => flow,
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9/sub-flows",
    "POST",
    () => ({ id: 35 }),
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9/executions",
    "POST",
    () => {
      if (rejectExecutionCreate) {
        rejectExecutionCreate = false;
        throw new Error("expected execution create failure");
      }
      return { id: 36 };
    },
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9/executions/34",
    "PUT",
    () => ({ id: 34 }),
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9/executions/34",
    "DELETE",
    () => {
      if (rejectExecutionDelete) {
        rejectExecutionDelete = false;
        throw new Error("expected execution delete failure");
      }
      return { status: 204 };
    },
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9/nodes/EXECUTION/34/position",
    "PUT",
    () => {
      if (rejectMove) {
        rejectMove = false;
        throw new Error("expected move failure");
      }
      return details;
    },
  );
  harness.setResponse(
    "/api/admin/authentication/flows/9",
    "DELETE",
    () => {
      if (rejectFlowDelete) {
        rejectFlowDelete = false;
        throw new Error("expected flow delete failure");
      }
      return { status: 204 };
    },
  );

  try {
    const { calls, document, renderer } = harness;
    Object.defineProperty(document.defaultView, "confirm", {
      configurable: true,
      value: () => true,
    });
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-authentication-tab"][data-tab="flows"]')
      .click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 250));

    const invalidPage = document.querySelector(
      '[data-action="admin-auth-flow-page"][data-page="0"]',
    );
    invalidPage.dataset.page = "-1";
    invalidPage.click();
    rejectFlowDetail = true;
    document
      .querySelector('[data-action="admin-auth-flow-select"][data-id="9"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="flow-list"]')
      .click();
    await settle();

    const nextFlowPage = document.querySelector(
      '[data-action="admin-auth-flow-page"][data-page="1"]',
    );
    assert.ok(nextFlowPage);
    assert.equal(nextFlowPage.disabled, false);
    await renderer.action("admin-auth-flow-page", nextFlowPage);
    const pageSize = document.querySelector(
      '[data-action="admin-auth-flow-page-size"]',
    );
    pageSize.value = "10";
    pageSize.dispatchEvent(new document.defaultView.Event("change"));
    await settle();

    document.querySelector('[data-action="admin-auth-flow-create"]').click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-auth-flow"][data-kind="create"]',
    );
    form.elements.namedItem("alias").value = "new-flow";
    form.elements.namedItem("name").value = "New flow";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/authentication/flows" && method === "POST",
      ),
    );
    rejectFlowCreate = true;
    document.querySelector('[data-action="admin-auth-flow-create"]').click();
    await settle();
    form = document.querySelector(
      '[data-form="admin-auth-flow"][data-kind="create"]',
    );
    form.elements.namedItem("alias").value = "retry-flow";
    form.elements.namedItem("name").value = "Retry flow";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="flow-list"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-select"][data-id="9"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="settings"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-auth-flow"][data-kind="edit"]');
    form.elements.namedItem("description").value = "Updated";
    const aliasControl = form.elements.namedItem("alias");
    aliasControl.setAttribute("aria-invalid", "true");
    aliasControl.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    assert.equal(aliasControl.getAttribute("aria-invalid"), "false");
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(calls.some(({ method, path }) => method === "PUT" && path.endsWith("/flows/9")));

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="graph"]')
      .click();
    await settle();
    rejectMove = true;
    document
      .querySelector('[data-action="admin-auth-flow-move"][data-node-id="34"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-move"][data-node-id="34"]')
      .click();
    await settle();
    rejectSubFlowDetail = true;
    document
      .querySelector('[data-action="admin-auth-flow-open-node"][data-node-type="SUB_FLOW"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-open-node"][data-node-type="SUB_FLOW"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector('[data-action="admin-auth-flow-tab"][data-tab="graph"]').getAttribute("aria-selected"),
      "true",
    );

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="flow-list"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-select"][data-id="9"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="graph"]')
      .click();
    await settle();
    document.querySelector('[data-action="admin-auth-flow-sub-create"]').click();
    await settle();
    form = document.querySelector('[data-form="admin-auth-flow"][data-kind="sub"]');
    form.elements.namedItem("alias").value = "sub-flow";
    form.elements.namedItem("name").value = "Sub flow";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(calls.some(({ method, path }) => method === "POST" && path.endsWith("/flows/9/sub-flows")));

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="executions"]')
      .click();
    await settle();
    document.querySelector('[data-action="admin-auth-execution-create"]').click();
    await settle();
    form = document.querySelector('[data-form="admin-auth-execution"]');
    form.elements.namedItem("displayName").value = "Authenticator";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(calls.some(({ method, path }) => method === "POST" && path.endsWith("/flows/9/executions")));
    rejectExecutionCreate = true;
    document.querySelector('[data-action="admin-auth-execution-create"]').click();
    await settle();
    form = document.querySelector('[data-form="admin-auth-execution"]');
    form.elements.namedItem("displayName").value = "Retry authenticator";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    document
      .querySelector('[data-action="admin-auth-flow-open-node"][data-node-type="EXECUTION"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-auth-execution"]');
    form.elements.namedItem("displayName").value = "Edited authenticator";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(calls.some(({ method, path }) => method === "PUT" && path.endsWith("/executions/34")));
    rejectExecutionDelete = true;
    document
      .querySelector('[data-action="admin-auth-execution-delete"][data-id="34"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-execution-delete"][data-id="34"]')
      .click();
    await settle();

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="bindings"]')
      .click();
    await settle();
    const bindingSelect = document.querySelector('[data-auth-binding-select="true"]');
    bindingSelect.value = "9";
    bindingSelect.dispatchEvent(new document.defaultView.Event("change"));
    rejectBindingSave = true;
    document.querySelector('[data-action="admin-auth-binding-save"]').click();
    await settle();
    document.querySelector('[data-action="admin-auth-binding-save"]').click();
    await settle();
    assert.ok(calls.some(({ method, path }) => method === "PUT" && path.endsWith("/bindings/BROWSER")));

    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="flow-list"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-select"][data-id="9"]')
      .click();
    await settle();
    rejectFlowDelete = true;
    document
      .querySelector('[data-action="admin-auth-flow-delete"]')
      .dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-delete"]')
      .dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
    await settle();
  } finally {
    harness.restore();
  }
});

test("native authentication flow empty states cover missing flows and bindings", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
    "GET",
    () => ({ content: [], totalElements: 0, totalPages: 0, number: 0 }),
  );
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => []);
  harness.setResponse(
    "/api/admin/authentication/execution-providers",
    "GET",
    () => [],
  );
  try {
    const { document } = harness;
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-authentication-tab"][data-tab="flows"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="settings"]')
      .click();
    await settle();
    assert.ok(document.querySelector(".card .muted"));
  } finally {
    harness.restore();
  }
});

test("native authentication binding table renders its empty state", async () => {
  const harness = await renderConsole("admin");
  const flow = {
    id: 9,
    alias: "browser",
    name: "Browser",
    flowType: "BASIC",
    priority: 0,
    builtIn: true,
    topLevel: true,
  };
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse(
    "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
    "GET",
    () => ({ content: [flow], totalElements: 1, totalPages: 1, number: 0 }),
  );
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => []);
  harness.setResponse(
    "/api/admin/authentication/execution-providers",
    "GET",
    () => [],
  );
  harness.setResponse("/api/admin/authentication/flows/9", "GET", () => ({
    flow,
    executions: [],
    subFlows: [],
    nodes: [],
  }));
  try {
    const { document } = harness;
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-authentication-tab"][data-tab="flows"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-auth-flow-tab"][data-tab="bindings"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('.admin-auth-binding-table [role="status"]'),
    );
  } finally {
    harness.restore();
  }
});

test("native WebAuthn policy drafts and saves nested settings", async () => {
  const harness = await renderConsole("admin");
  const settings = {
    webauthnMediation: "conditional",
    webauthnPolicy: {
      rpName: "Kitezh",
      rpId: "example.test",
      signatureAlgorithms: "ES256,RS256",
      attestation: "none",
      authenticatorAttachment: "any",
      residentKey: "preferred",
      userVerification: "preferred",
      timeoutSeconds: 300,
      avoidSameAuthenticator: true,
      acceptableAaguids: "",
    },
    webauthnPasswordlessPolicy: {
      rpName: "Kitezh",
      rpId: "example.test",
      signatureAlgorithms: "ES256,RS256",
      attestation: "none",
      authenticatorAttachment: "any",
      residentKey: "required",
      userVerification: "required",
      timeoutSeconds: 300,
      avoidSameAuthenticator: true,
      acceptableAaguids: "",
    },
  };
  let rejectPolicySave = true;
  harness.setResponse("/api/admin/settings/login", "GET", () => settings);
  harness.setResponse("/api/admin/settings/login", "PUT", ({ body }) => {
    if (rejectPolicySave) {
      rejectPolicySave = false;
      throw new Error("expected login policy save failure");
    }
    return body;
  });
  try {
    const { calls, document } = harness;
    for (
      let turn = 0;
      turn < 40 && !document.querySelector('[data-route="authentication"]');
      turn += 1
    )
      await settle();
    document.querySelector('[data-route="authentication"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-authentication-policy-tab"][data-tab="webauthn"]')
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-authentication-policy"]',
    );
    const rpId = form.elements.namedItem("webauthnPolicy.rpId");
    rpId.value = "login.example.test";
    rpId.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    const switchControl = form.elements.namedItem(
      "webauthnPolicy.avoidSameAuthenticator",
    );
    switchControl.checked = false;
    switchControl.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const saved = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/login" && method === "PUT",
    );
    assert.equal(saved.body.webauthnPolicy.rpId, "login.example.test");
    assert.equal(saved.body.webauthnPolicy.avoidSameAuthenticator, false);
    document
      .querySelector('[data-action="admin-authentication-policy-cancel"]')
      .click();
    await settle();
  } finally {
    harness.restore();
  }
});

async function openClientTab(document, tab) {
  document
    .querySelector(
      '.client-name [data-action="client-open"][data-id="console-client"]',
    )
    .click();
  await settle();
  if (tab !== "settings") {
    document
      .querySelector(`[data-action="client-tab"][data-id="${tab}"]`)
      .click();
    await settle();
  }
}

async function openAdminSettingsTab(document, tab) {
  const settingsRoute = document.querySelector('[data-route="configuration"]');
  if (settingsRoute.getAttribute("aria-current") !== "page") {
    settingsRoute.click();
    await settle();
  }
  const sectionTab = document.querySelector(
    `[data-action="admin-settings-tab"][data-tab="${tab}"]`,
  );
  assert.ok(sectionTab, `Settings should include the ${tab} tab`);
  sectionTab.click();
  await settle();
}
test("native Admin renderer covers every authorized primary route", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/whoami", "GET", () => ({
    access: {
      isAdmin: true,
      queryUsers: true,
      viewUsers: true,
      manageUsers: true,
      viewRoles: true,
      manageRoles: true,
      queryGroups: true,
      viewGroups: true,
      manageGroups: true,
      queryClients: true,
      viewClients: true,
      manageClients: true,
      viewSessions: true,
      manageSessions: true,
      viewConsents: true,
      manageConsents: true,
      viewEvents: true,
      manageEvents: true,
      viewKeys: true,
      manageKeys: true,
    },
  }));
  try {
    const { calls, document } = harness;
    Object.defineProperty(document.defaultView, "confirm", {
      configurable: true,
      value: () => true,
    });
    for (let turn = 0; turn < 60; turn += 1) {
      await settle();
      if (
        calls.some(({ path }) => path === "/api/admin/whoami") &&
        document.querySelector('[data-route="notifications"]')
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const routes = [
      "dashboard",
      "users",
      "roles",
      "groups",
      "clients",
      "client-scopes",
      "identity-providers",
      "sessions",
      "notifications",
      "consents",
      "offline-sessions",
      "events",
      "keys",
      "configuration",
      "authentication",
    ];
    for (const route of routes) {
      const link = document.querySelector(`[data-route="${route}"]`);
      assert.ok(link, `Admin navigation should include ${route}`);
      link.click();
      for (let turn = 0; turn < 30; turn += 1) {
        await settle();
        if (!document.querySelector(`[data-route="${route}"]`)?.disabled) break;
      }
      assert.equal(
        document
          .querySelector(`[data-route="${route}"]`)
          .getAttribute("aria-current"),
        "page",
      );
      assert.equal(
        document.querySelector(`[data-route="${route}"]`).disabled,
        false,
      );
      if (route === "users") {
        assert.ok(document.getElementById("admin-user-search"));
        assert.ok(
          document
            .getElementById("admin-user-query")
            .getAttribute("aria-label"),
        );
        const editButton = document.querySelector(
          '[data-action="admin-user-edit-toggle"][data-id="1"]',
        );
        assert.ok(editButton);
        editButton.click();
        await settle();
        assert.ok(document.querySelector('[data-form="admin-user-edit"]'));
        const editForm = document.querySelector(
          '[data-form="admin-user-edit"]',
        );
        editForm.elements.namedItem("firstName").value = "Grace";
        const editRole = editForm.querySelector('input[name="roles"]');
        assert.ok(editRole);
        editRole.checked = true;
        editForm.dispatchEvent(
          new document.defaultView.Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method, body }) =>
              path === "/api/admin/users/1" &&
              method === "PUT" &&
              body.firstName === "Grace",
          ),
        );
        document.querySelector('[data-route="users"]').click();
        await settle();
        document
          .querySelector('[data-action="admin-user-edit-cancel"][data-id="1"]')
          ?.click();
        await settle();
        assert.equal(
          document.querySelector('[data-form="admin-user-edit"]'),
          null,
        );
        document
          .querySelector(
            '[data-action="admin-user-action-email-toggle"][data-id="1"]',
          )
          ?.click();
        await settle();
        assert.ok(
          document.querySelector('[data-form="admin-user-action-email"]'),
        );
        document
          .querySelector('[data-form="admin-user-action-email"]')
          .dispatchEvent(
            new document.defaultView.Event("submit", {
              bubbles: true,
              cancelable: true,
            }),
          );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method }) =>
              path ===
                "/api/admin/users/1/execute-actions-email?lifespan=43200" &&
              method === "PUT",
          ),
        );
        document.querySelector('[data-route="users"]').click();
        await settle();
        document
          .querySelector(
            '[data-action="admin-user-action-email-close"][data-id="1"]',
          )
          ?.click();
        await settle();
        document
          .querySelector(
            '[data-action="admin-user-password-reset-toggle"][data-id="1"]',
          )
          .click();
        await settle();
        const resetForm = document.querySelector(
          '[data-form="admin-user-password-reset"]',
        );
        assert.ok(resetForm);
        resetForm.elements.namedItem("password").value =
          "Another-Strong-Test-42";
        resetForm.dispatchEvent(
          new document.defaultView.Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method }) =>
              path === "/api/admin/users/1/password" && method === "PUT",
          ),
        );
      }
      await exerciseVisibleEditorActions(document);
    }
    assert.ok(calls.some(({ path }) => path === "/api/admin/whoami"));
    assert.ok(calls.some(({ path }) => path.startsWith("/api/admin/users?")));
    assert.ok(calls.some(({ path }) => path.startsWith("/api/admin/roles?")));
    assert.ok(
      calls.some(({ path }) => path.startsWith("/api/admin/notifications")),
    );
    document.querySelector('[data-route="users"]').click();
    await settle();
    document.querySelector('[data-action="create-user"]').click();
    await settle();
    const createForm = document.querySelector(
      '[data-form="admin-user-create"]',
    );
    assert.ok(createForm);
    createForm.elements.namedItem("username").value = "grace";
    createForm.elements.namedItem("password").value = "Strong-Test-Password-42";
    createForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users" &&
          method === "POST" &&
          body.username === "grace" &&
          body.password === "Strong-Test-Password-42",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin user details load profile, credential, role, and session actions", async () => {
  const harness = await renderConsole("admin");
  const { calls, document, setResponse } = harness;
  setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
    enabled: true,
    emailVerified: true,
    totpEnabled: true,
    authorities: ["ROLE_USER"],
    assignedRoles: ["ROLE_USER"],
  }));
  setResponse("/api/admin/required-actions/users/1", "GET", () => [
    {
      key: "VERIFY_EMAIL",
      displayName: "Verify email",
      enabled: true,
      globalPolicy: false,
      assigned: false,
    },
  ]);
  setResponse(
    "/api/admin/users/1/webauthn/credentials?page=0&size=20",
    "GET",
    () => ({
      content: [
        {
          credentialId: "ada-key",
          label: "Work laptop",
          credentialType: "public-key",
          createdAt: "2026-01-01T00:00:00Z",
          lastUsedAt: "2026-01-02T00:00:00Z",
          signatureCount: 4,
          uvInitialized: true,
        },
      ],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );
  setResponse("/api/admin/users/1/password", "PUT", () => ({ status: 204 }));
  setResponse(
    "/api/admin/users/1/execute-actions-email?lifespan=3600",
    "PUT",
    () => ({ status: 204 }),
  );
  setResponse("/api/admin/users/1/totp", "DELETE", () => ({ status: 204 }));
  setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    definitions: [
      {
        name: "department",
        displayName: "Department",
        type: "STRING",
        enabled: true,
        builtIn: false,
      },
    ],
    attributes: { department: ["Research"] },
  }));
  setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
    content: [{ name: "ROLE_ADMIN" }, { name: "ROLE_USER" }],
  }));
  setResponse(
    "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "GET",
    () => ({
      content: [
        {
          id: "session-1",
          username: "ada",
          createdAt: "2026-01-01T00:00:00Z",
          lastAccessedAt: "2026-01-01T01:00:00Z",
          expiresAt: "2026-01-01T02:00:00Z",
          authorizationCount: 2,
          active: true,
        },
      ],
      number: 0,
      totalPages: 2,
      totalElements: 15,
    }),
  );
  setResponse(
    "/api/admin/users/1/sessions?page=0&size=20&sort=lastAccessTime,desc",
    "GET",
    () => ({
      content: [{ username: "ada", id: "session-1", authorizationCount: 2 }],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );
  setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [
        {
          clientId: "console-client",
          clientName: "Console",
          principalName: "ada",
          authorities: ["openid", "admin-api"],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
      number: 0,
      totalPages: 1,
    }),
  );
  setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [
        {
          id: "event-1",
          action: "user.updated",
          actor: "admin",
          targetType: "user",
          targetId: "1",
          details: "enabled=true",
          occurredAt: "2026-01-02T00:00:00Z",
        },
      ],
      number: 0,
      totalPages: 1,
    }),
  );
  setResponse("/api/admin/users/1/groups?page=0&size=100", "GET", () => ({
    content: [
      { id: 3, name: "Platform", path: "/Platform", roles: ["ROLE_ADMIN"] },
    ],
    number: 0,
    totalPages: 1,
  }));
  setResponse(
    "/api/admin/groups?page=0&size=100&sort=name%2Casc",
    "GET",
    () => ({ content: [{ id: 3, name: "Platform", path: "/Platform" }] }),
  );
  setResponse(
    "/api/admin/groups?q=Eng&page=0&size=10&sort=name%2Casc",
    "GET",
    () => ({ content: [{ id: 4, name: "Engineering", path: "/Engineering" }] }),
  );
  try {
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    assert.ok(document.querySelector('[data-form="admin-user-detail-save"]'));
    const detailSwitches = document.querySelectorAll(
      '[data-form="admin-user-detail-save"] .admin-user-detail-switch input[type="checkbox"]',
    );
    assert.equal(detailSwitches.length, 2);
    assert.deepEqual(
      Array.from(detailSwitches, (input) => input.name),
      ["emailVerified", "enabled"],
    );
    assert.ok(
      Array.from(detailSwitches).every((input) =>
        input.nextElementSibling?.classList.contains(
          "admin-user-detail-switch-control",
        ),
      ),
    );
    assert.equal(
      document.querySelector('[data-profile-attribute="department"]').value,
      "Research",
    );
    const department = document.querySelector(
      '[data-profile-attribute="department"]',
    );
    department.value = "Security";
    document
      .querySelector('[data-form="admin-user-detail-save"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/profile-attributes" &&
          method === "PUT" &&
          body.attributes.department[0] === "Security",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="roles"]')
      .click();
    await settle();
    const adminRole = document.querySelector(
      '[data-form="admin-user-detail-roles"] input[value="ROLE_ADMIN"]',
    );
    const userRole = document.querySelector(
      '[data-form="admin-user-detail-roles"] input[value="ROLE_USER"]',
    );
    assert.equal(
      adminRole.closest(".admin-role-option").classList.contains("selected"),
      false,
    );
    assert.equal(
      userRole.closest(".admin-role-option").classList.contains("selected"),
      true,
    );
    adminRole.checked = true;
    adminRole.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    assert.equal(
      adminRole.closest(".admin-role-option").classList.contains("selected"),
      true,
    );
    document
      .querySelector('[data-form="admin-user-detail-roles"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1" &&
          method === "PUT" &&
          body.roles.includes("ROLE_ADMIN"),
      ),
    );
    document.querySelector('[data-action="admin-user-detail-back"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-user-detail-tab"][data-tab="credentials"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-form="admin-user-detail-password"]'),
    );
    assert.ok(document.querySelector(".admin-user-credentials-grid"));
    const passwordForm = document.querySelector(
      '[data-form="admin-user-detail-password"]',
    );
    assert.equal(passwordForm.elements.namedItem("temporary").checked, true);
    assert.ok(document.querySelector('[data-form="admin-user-action-email"]'));
    assert.equal(
      document.querySelector(
        '[data-action="admin-user-detail-required-action"]',
      ).nextElementSibling.className,
      "admin-user-detail-switch-control",
    );
    assert.match(
      document.querySelector('[data-passkey-index="0"]').textContent,
      /Signature counter: 4/,
    );
    passwordForm.elements.namedItem("password").value =
      "Strong-Test-Password-42";
    passwordForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/password" &&
          method === "PUT" &&
          body.password === "Strong-Test-Password-42" &&
          body.temporary === true,
      ),
    );
    const actionEmailForm = document.querySelector(
      '[data-form="admin-user-action-email"]',
    );
    actionEmailForm.elements.namedItem("action").value = "VERIFY_EMAIL";
    actionEmailForm.elements.namedItem("lifespan").value = "3600";
    actionEmailForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/execute-actions-email?lifespan=3600" &&
          method === "PUT" &&
          body[0] === "VERIFY_EMAIL",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-required-action"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/required-actions/users/1/VERIFY_EMAIL" &&
          method === "POST",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-totp-request"]')
      .click();
    document
      .querySelector('[data-action="admin-user-detail-totp-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/totp" && method === "DELETE",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-user-detail-tab"][data-tab="sessions"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
      ),
    );
    assert.match(
      document.querySelector(".admin-user-detail-data-table").textContent,
      /ada/,
    );
    assert.match(
      document.querySelector(".admin-user-detail-data-table").textContent,
      /2/,
    );
    assert.ok(
      document.querySelector(".admin-user-session-table.is-manageable"),
    );
    assert.ok(
      document.querySelector(".admin-user-session-action .danger-button"),
    );
    assert.equal(
      document.querySelectorAll(".admin-user-detail-data-table thead th")
        .length,
      6,
    );
    assert.equal(
      document
        .querySelector(".admin-user-detail-data-table thead th:last-child")
        .textContent.trim(),
      "Actions",
    );
    assert.match(
      document.querySelector(".admin-pagination-summary").textContent,
      /1–10\s*\/\s*15/,
    );
    assert.equal(
      document.querySelector('[aria-label="First page"]').disabled,
      true,
    );
    const pageSize = document.querySelector(
      '[data-action="admin-user-detail-page-size"][data-tab="sessions"]',
    );
    pageSize.value = "20";
    pageSize.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          "/api/admin/users/1/sessions?page=0&size=20&sort=lastAccessTime,desc",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-revoke-all-sessions"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/ada/sessions" && method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-user-detail-revoke-all-sessions-confirm"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/ada/sessions" && method === "DELETE",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="groups"]')
      .click();
    await settle();
    assert.match(
      document.querySelector(".admin-user-detail-data-table").textContent,
      /Platform/,
    );
    const groupTable = document.querySelector(".admin-user-group-table");
    assert.ok(groupTable.classList.contains("is-manageable"));
    assert.equal(
      groupTable.querySelector("th:last-child .sr-only").textContent.trim(),
      "Actions",
    );
    assert.ok(
      groupTable.querySelector(".admin-user-group-action-cell .danger-button"),
    );
    const groupSearch = document.querySelector(
      "#admin-user-detail-group-search",
    );
    groupSearch.value = "Eng";
    groupSearch.dispatchEvent(
      new document.defaultView.Event("input", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path === "/api/admin/groups?q=Eng&page=0&size=10&sort=name%2Casc",
      ),
    );
    assert.equal(
      document.querySelector("#admin-user-detail-group-options option")?.value,
      "/Engineering",
    );
    groupSearch.value = "/Engineering";
    groupSearch.dispatchEvent(
      new document.defaultView.Event("input", { bubbles: true }),
    );
    assert.equal(
      document.querySelector('[data-action="admin-user-detail-add-group"]')
        .disabled,
      false,
    );
    document
      .querySelector(
        '[data-action="admin-user-detail-tab"][data-tab="consents"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-consent-details"]')
      .click();
    await settle();
    assert.match(
      document.querySelector(".admin-user-detail-expand-row").textContent,
      /admin-api/,
    );
    document
      .querySelector('[data-action="admin-user-detail-revoke-consent"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-revoke-consent-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/consents/console-client/ada" &&
          method === "DELETE",
      ),
    );
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="events"]')
      .click();
    await settle();
    assert.match(
      document.querySelector(".admin-user-detail-data-table").textContent,
      /user.updated/,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin credentials keep other panels available when passkeys fail to load", async () => {
  const harness = await renderConsole("admin");
  const { document, setResponse } = harness;
  setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    email: "ada@example.test",
    enabled: true,
    emailVerified: true,
    authorities: ["ROLE_USER"],
    assignedRoles: ["ROLE_USER"],
  }));
  setResponse("/api/admin/required-actions/users/1", "GET", () => [
    {
      key: "VERIFY_EMAIL",
      displayName: "Verify email",
      enabled: true,
      globalPolicy: false,
      assigned: false,
    },
  ]);
  setResponse(
    "/api/admin/users/1/webauthn/credentials?page=0&size=20",
    "GET",
    () => ({ status: 503, body: {} }),
  );
  try {
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-user-detail-tab"][data-tab="credentials"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-form="admin-user-detail-password"]'),
    );
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-detail-required-action"]',
      ),
    );
    assert.match(
      document.querySelector(".admin-user-passkeys-card [role=alert]")
        .textContent,
      /could not be completed/i,
    );
    assert.equal(document.querySelector(".content > .notice.error"), null);
  } finally {
    harness.restore();
  }
});
test("native Admin user creation persists profile attributes and retries a failed profile save", async () => {
  const harness = await renderConsole("admin");
  let profileSaveAttempts = 0;
  harness.setResponse("/api/admin/profile-attributes", "GET", () => [
    {
      name: "department",
      displayName: "Department",
      type: "STRING",
      enabled: true,
      builtIn: false,
      required: true,
      minLength: 2,
      maxLength: 80,
      pattern: "^[A-Za-z ]+$",
    },
    {
      name: "contactEmail",
      displayName: "Contact email",
      type: "EMAIL",
      enabled: true,
      builtIn: false,
    },
    {
      name: "seatCount",
      displayName: "Seat count",
      type: "INTEGER",
      enabled: true,
      builtIn: false,
    },
    {
      name: "enabledFeature",
      displayName: "Enabled feature",
      type: "BOOLEAN",
      enabled: true,
      builtIn: false,
    },
    {
      name: "aliases",
      displayName: "Aliases",
      type: "STRING",
      enabled: true,
      builtIn: false,
      multivalued: true,
    },
    { name: "invalid name!", type: "STRING", enabled: true, builtIn: false },
    {
      name: "disabledAttribute",
      type: "STRING",
      enabled: false,
      builtIn: false,
    },
    { name: "builtInAttribute", type: "STRING", enabled: true, builtIn: true },
  ]);
  harness.setResponse(
    "/api/admin/users/9/profile-attributes",
    "PUT",
    ({ body }) => {
      profileSaveAttempts += 1;
      if (profileSaveAttempts === 1) return { status: 503, body: {} };
      return body;
    },
  );
  try {
    const { calls, document } = harness;
    for (let turn = 0; turn < 40; turn += 1) {
      await settle();
      if (document.querySelector('[data-route="users"]')) break;
    }
    document.querySelector('[data-route="users"]').click();
    await settle();
    document.querySelector('[data-action="create-user"]').click();
    await settle();
    const createForm = document.querySelector(
      '[data-form="admin-user-create"]',
    );
    assert.ok(createForm);
    assert.ok(
      createForm.querySelector('[type="email"][name="attribute-contactEmail"]'),
    );
    assert.ok(
      createForm.querySelector('[type="number"][name="attribute-seatCount"]'),
    );
    assert.ok(
      createForm.querySelector('select[name="attribute-enabledFeature"]'),
    );
    assert.ok(createForm.querySelector('textarea[name="attribute-aliases"]'));
    assert.equal(
      createForm.querySelector('[name="attribute-invalid name!"]'),
      null,
    );
    assert.equal(
      createForm.querySelector('[name="attribute-disabledAttribute"]'),
      null,
    );
    assert.equal(
      createForm.querySelector('[name="attribute-builtInAttribute"]'),
      null,
    );
    createForm.elements.namedItem("username").value = "grace-profile";
    createForm.elements.namedItem("password").value = "Strong-Test-Password-42";
    createForm.querySelector('[name="attribute-department"]').value =
      "Research";
    createForm.querySelector('[name="attribute-contactEmail"]').value =
      "grace@example.test";
    createForm.querySelector('[name="attribute-seatCount"]').value = "4";
    createForm.querySelector('[name="attribute-enabledFeature"]').value =
      "true";
    createForm.querySelector('[name="attribute-aliases"]').value =
      "G. Hopper\nRear Admiral";
    createForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const retryForm = document.querySelector('[data-form="admin-user-create"]');
    assert.equal(retryForm.dataset.createdUserId, "9");
    assert.equal(
      retryForm.querySelector('[name="attribute-department"]').value,
      "Research",
    );
    assert.equal(profileSaveAttempts, 1);
    retryForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const profileRequests = calls.filter(
      ({ path, method }) =>
        path === "/api/admin/users/9/profile-attributes" && method === "PUT",
    );
    assert.equal(profileRequests.length, 2);
    assert.deepEqual(profileRequests[0].body.attributes, {
      department: ["Research"],
      contactEmail: ["grace@example.test"],
      seatCount: ["4"],
      enabledFeature: ["true"],
      aliases: ["G. Hopper", "Rear Admiral"],
    });
    assert.equal(profileSaveAttempts, 2);
    assert.equal(
      document
        .querySelector('[data-route="users"]')
        .getAttribute("aria-current"),
      "page",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin role-composition panel renders and cancels removals", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/roles/ROLE_USER?q=&page=0&size=10&sort=username%2Casc",
    "GET",
    () => ({
      name: "ROLE_USER",
      userCount: 0,
      users: {
        content: [],
        page: { number: 0, size: 10, totalElements: 0, totalPages: 0 },
      },
      compositeRoles: ["ROLE_ADMIN"],
      compositeClientRoles: [
        { id: 12, clientId: "console-client", name: "read" },
      ],
    }),
  );
  harness.setResponse(
    "/api/admin/roles/ROLE_USER/available-composites?q=EDIT&page=0&size=10&sort=name,asc",
    "GET",
    () => ({
      content: [
        { name: "ROLE_EDITOR" },
        { name: "ROLE_USER" },
        { name: "invalid role" },
      ],
    }),
  );
  harness.setResponse(
    "/api/admin/roles/ROLE_USER/available-client-composites?q=core&page=0&size=10&sort=name,asc",
    "GET",
    () => ({
      content: [
        { id: 42, clientId: "desktop-core", name: "read" },
        { id: 0, clientId: "desktop-core", name: "invalid" },
        { id: 43, clientId: "unsafe client", name: "invalid" },
      ],
    }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="roles"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="roles"]').disabled) break;
    }
    document
      .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
      .click();
    await settle();
    const panel = document.querySelector('[data-role-composition="ROLE_USER"]');
    assert.ok(panel);
    assert.match(panel.textContent, /ROLE_ADMIN/);
    assert.match(
      document.querySelector("#role-tab-panel").textContent,
      /console-client \/ read/,
    );
    assert.ok(
      calls.some(({ path }) => path.startsWith("/api/admin/roles/ROLE_USER?")),
    );
    panel.querySelector('input[name="q"]').value = "EDIT";
    panel
      .querySelector('input[name="q"]')
      .dispatchEvent(
        new document.defaultView.Event("input", { bubbles: true }),
      );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    const roleSearchPanel = document.querySelector(
      '[data-role-composition="ROLE_USER"]',
    );
    assert.match(roleSearchPanel.textContent, /ROLE_EDITOR/);
    assert.equal(roleSearchPanel.textContent.includes("invalid role"), false);
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          "/api/admin/roles/ROLE_USER/available-composites?q=EDIT&page=0&size=10&sort=name,asc",
      ),
    );
    const clientInput = document.querySelector('input[name="client-q"]');
    clientInput.value = "core";
    clientInput.dispatchEvent(
      new document.defaultView.Event("input", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    const clientSearchPanel = document.querySelector("#role-tab-panel");
    assert.match(clientSearchPanel.textContent, /desktop-core \/ read/);
    assert.equal(
      clientSearchPanel.textContent.includes("unsafe client"),
      false,
    );
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          "/api/admin/roles/ROLE_USER/available-client-composites?q=core&page=0&size=10&sort=name,asc",
      ),
    );
    clientSearchPanel
      .querySelector('[data-action="admin-role-composite-remove-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-role-composite-remove-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-role-composite-remove-cancel"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-role-client-composite-remove-request"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-role-client-composite-remove-confirm"]',
      ),
    );
    assert.equal(
      calls.some(({ method }) => method === "DELETE"),
      false,
      "canceling confirmation must not mutate the role",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client-scope role mappings load, save, and cancel drafts", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/client-scopes/profile/role-mappings",
    "GET",
    () => ({ applicationRoles: [], clientRoles: [] }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/role-mappings",
    "PUT",
    ({ body }) => body,
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/role-mappings/application-roles?page=0&size=100&sort=name,asc",
    "GET",
    () => ({ content: [], number: 0, totalPages: 0, totalElements: 0 }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/role-mappings/client-roles?page=0&size=100&sort=name,asc",
    "GET",
    () => ({ content: [], number: 0, totalPages: 0, totalElements: 0 }),
  );
  let mappers = [
    {
      id: "8",
      name: "email",
      mapperType: "email",
      claimName: "email",
      priority: 100,
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers?page=0&size=20&sort=name,asc",
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers/8",
    "PUT",
    ({ body }) => ({ id: "8", ...body }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers/8",
    "DELETE",
    () => {
      mappers = [];
      return { status: 204 };
    },
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers",
    "POST",
    ({ body }) => {
      const saved = { id: "9", ...body };
      mappers = [...mappers, saved];
      return saved;
    },
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }
    document
      .querySelector('[data-action="client-scope-open"][data-id="profile"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-scope-role-mappings-toggle"][data-id="profile"]',
      )
      .click();
    let panel;
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      panel = document.querySelector(
        '[data-client-scope-role-mappings-panel][data-scope-id="profile"]',
      );
      if (panel) break;
    }
    assert.ok(panel);
    panel
      .querySelector('[data-action="admin-client-scope-role-mappings-save"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/role-mappings" &&
          method === "PUT" &&
          Array.isArray(body.applicationRoles) &&
          Array.isArray(body.clientRoleIds),
      ),
    );
    document
      .querySelector('[data-action="admin-client-scope-role-mappings-cancel"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector("[data-client-scope-role-mappings-panel]"),
      null,
    );
    document
      .querySelector(
        '[data-action="admin-client-scope-mappers-toggle"][data-id="profile"]',
      )
      .click();
    await settle();
    assert.ok(document.querySelector('[data-client-scope-mapper-id="8"]'));
    document
      .querySelector('[data-action="admin-client-scope-mapper-edit"]')
      .click();
    await settle();
    let mapperForm = document.querySelector(
      '[data-form="admin-client-scope-mapper"]',
    );
    mapperForm.elements.namedItem("claimName").value = "primary_email";
    mapperForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/mappers/8" &&
          method === "PUT" &&
          body.claimName === "primary_email",
      ),
    );
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile/mappers/8" &&
          method === "DELETE",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-scope-mapper-create"][data-id="profile"]',
      )
      .click();
    await settle();
    mapperForm = document.querySelector(
      '[data-form="admin-client-scope-mapper"]',
    );
    assert.ok(mapperForm);
    mapperForm.elements.namedItem("name").value = "Email claim";
    mapperForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/mappers" &&
          method === "POST" &&
          body.name === "Email claim" &&
          body.mapperType === "email",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client-scope deletion requires confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/client-scopes/profile", "DELETE", () => ({
    status: 204,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-request"][data-id="profile"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile" && method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-request"][data-id="profile"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-confirm"][data-id="profile"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile" && method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client-scope assignments edit and persist scope choices", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/clients/console-client/scope-assignments",
    "GET",
    () => ({
      defaultScopes: [],
      optionalScopes: [],
      availableScopes: [
        {
          name: "profile",
          displayName: "Profile",
          description: "Profile scope",
        },
      ],
    }),
  );
  harness.setResponse(
    "/api/admin/clients/console-client/scope-assignments",
    "PUT",
    ({ body }) => body,
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "scopes");
    await settle();
    const panel = document.querySelector(
      '[data-client-scope-assignments-panel][data-client-id="console-client"]',
    );
    assert.ok(panel);
    panel.querySelector('[name="defaultScopes"]').checked = true;
    panel
      .querySelector('[data-form="admin-client-scope-assignments"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/clients/console-client/scope-assignments" &&
          method === "PUT" &&
          body.defaultScopes.includes("profile"),
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin localization settings save asynchronously without duplicate submissions", async () => {
  const harness = await renderConsole("admin");
  let finishSave;
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
  }));
  harness.setResponse(
    "/api/admin/settings/localization/messages?page=0&size=20&sort=locale,asc",
    "GET",
    () => ({ content: [], totalElements: 0, totalPages: 0, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/settings/localization",
    "PUT",
    () =>
      new Promise((resolve) => {
        finishSave = () =>
          resolve({
            internationalizationEnabled: true,
            defaultLocale: "tr",
            supportedLocales: ["en", "tr"],
          });
      }),
  );
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "localization");
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="settings"]').click();
    const form = document.querySelector(
      '[data-form="admin-localization-settings"]',
    );
    assert.ok(form);
    form.elements.namedItem("defaultLocale").value = "tr";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const busyButton = document.querySelector(
      '[data-form="admin-localization-settings"] button[type="submit"]',
    );
    assert.equal(busyButton.disabled, true);
    assert.ok(busyButton.querySelector(".spinner"));
    const busyLabel = busyButton.textContent;
    document
      .querySelector('[data-form="admin-localization-settings"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    const saves = calls.filter(
      ({ path, method }) =>
        path === "/api/admin/settings/localization" && method === "PUT",
    );
    assert.equal(saves.length, 1);
    assert.equal(saves[0].body.defaultLocale, "tr");
    assert.deepEqual(saves[0].body.supportedLocales, ["en", "tr"]);
    finishSave();
    await settle();
    const completedButton = document.querySelector(
      '[data-form="admin-localization-settings"] button[type="submit"]',
    );
    assert.equal(completedButton.disabled, false);
    assert.equal(completedButton.querySelector(".spinner"), null);
    assert.equal(completedButton.textContent, busyLabel);
    assert.match(document.querySelector(".content").textContent, /saved/i);
  } finally {
    harness.restore();
  }
});
test("native Admin login policy requires OTP before it can be mandatory", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login", "GET", () => ({
    sessionTimeoutMinutes: 30,
    passwordMinimumLength: 12,
    bruteForceMaxFailures: 5,
    otpEnabled: false,
    otpRequired: false,
  }));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({
    enabled: false,
    fromAddress: "auth@example.test",
    baseUrl: "https://example.test",
    host: "smtp.example.test",
    port: 587,
  }));
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "login");
    const form = document.querySelector('[data-form="admin-settings-login"]');
    assert.ok(form);
    form.elements.namedItem("sessionTimeoutMinutes").value = "30";
    form.elements.namedItem("passwordMinimumLength").value = "12";
    form.elements.namedItem("bruteForceMaxFailures").value = "5";
    form.elements.namedItem("otpRequired").checked = true;
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
          path === "/api/admin/settings/login" && method === "PUT",
      ),
      false,
      "mandatory OTP must not be sent while OTP is disabled",
    );
    assert.match(
      document.querySelector('[data-form="admin-settings-login"]')?.parentElement?.querySelector('[role="alert"]')?.textContent ?? "",
      /OTP/i,
    );
    const updatedForm = document.querySelector(
      '[data-form="admin-settings-login"]',
    );
    updatedForm.elements.namedItem("otpEnabled").checked = true;
    updatedForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/login" && method === "PUT",
    );
    assert.ok(save);
    assert.equal(save.body.otpEnabled, true);
    assert.equal(save.body.otpRequired, true);
    assert.equal(save.body.passwordMinimumLength, 12);
  } finally {
    harness.restore();
  }
});
test("native Admin email settings preserve the configured username and clear the secret draft", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({
    enabled: true,
    fromAddress: "auth@example.test",
    baseUrl: "https://example.test",
    host: "smtp.example.test",
    port: 587,
    username: "service-account",
    smtpAuth: true,
    starttls: true,
    ssl: false,
  }));
  harness.setResponse("/api/admin/settings/email", "PUT", ({ body }) => ({
    ...body,
    username: body.username,
    password: undefined,
  }));
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "email");
    const form = document.querySelector('[data-form="admin-email-settings"]');
    assert.ok(form);
    assert.equal(form.elements.namedItem("username").value, "service-account");
    form.elements.namedItem("password").value = "sensitive-test-secret";
    form.elements.namedItem("fromAddress").value = "auth@example.test";
    form.elements.namedItem("baseUrl").value = "https://example.test";
    form.elements.namedItem("host").value = "smtp.example.test";
    form.elements.namedItem("port").value = "587";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/email" && method === "PUT",
    );
    assert.ok(save);
    assert.equal(save.body.username === "service-account", true);
    assert.equal(save.body.password === "sensitive-test-secret", true);
    const updatedForm = document.querySelector(
      '[data-form="admin-email-settings"]',
    );
    assert.equal(updatedForm.elements.namedItem("password").value, "");
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("sensitive-test-secret"),
      false,
      "the secret must not remain in the rendered form after saving",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client-scope creation validates and normalizes the draft", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/client-scopes", "POST", ({ body }) => ({
    id: "claims",
    ...body,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }
    document.querySelector('[data-action="create-client-scope"]').click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-client-scope-create"]',
    );
    assert.ok(form);
    form.elements.namedItem("name").value = "  ";
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
          path === "/api/admin/client-scopes" && method === "POST",
      ),
      false,
      "an empty normalized scope name must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));
    form = document.querySelector('[data-form="admin-client-scope-create"]');
    form.elements.namedItem("name").value = "  claims  ";
    form.elements.namedItem("displayName").value = " User Claims ";
    form.elements.namedItem("description").value = " Optional claims ";
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
          path === "/api/admin/client-scopes" &&
          method === "POST" &&
          body.name === "claims" &&
          body.displayName === "User Claims" &&
          body.description === "Optional claims",
      ),
    );
    assert.ok(document.querySelector('[data-route="client-scopes"]'));
  } finally {
    harness.restore();
  }
});
test("native Administration Settings shows a forbidden localization load without exposing its form", async () => {
  const harness = await renderConsole("admin");
  let forbidden = true;
  harness.setResponse("/api/admin/settings/localization", "GET", () => {
    if (forbidden) {
      forbidden = false;
      return { status: 403, kind: "forbidden", body: { detail: "Forbidden" } };
    }
    return {
      internationalizationEnabled: true,
      defaultLocale: "en",
      supportedLocales: ["en", "tr"],
    };
  });
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "localization");
    assert.match(document.querySelector('[role="alert"]').textContent, /could not be loaded/i);
    assert.equal(document.querySelector('[data-form="admin-localization-settings"]'), null);
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/settings/localization" && method === "GET",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin role creation rejects malformed names and submits normalized data", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/roles", "POST", ({ body }) => ({
    id: 44,
    ...body,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="roles"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="roles"]').disabled) break;
    }
    document.querySelector('[data-action="create-role"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-role-create"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "auditor";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === "/api/admin/roles" && method === "POST",
      ),
      false,
      "role identifiers outside ROLE_* format must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));
    form = document.querySelector('[data-form="admin-role-create"]');
    form.elements.namedItem("name").value = "  ROLE_AUDITOR  ";
    form.elements.namedItem("description").value = " Audit access ";
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
          path === "/api/admin/roles" &&
          method === "POST" &&
          body.name === "ROLE_AUDITOR" &&
          body.description === "Audit access",
      ),
    );
    assert.ok(
      document.querySelector("#role-tab-details"),
      "Creation opens the new native detail screen",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin user deletion requires confirmation and can be canceled", async () => {
  const harness = await renderConsole("admin");
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-unlock"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/unlock" && method === "POST",
      ),
    );
    document
      .querySelector('[data-action="admin-user-toggle-enabled"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-user-toggle-confirm"]'),
    );
    document.querySelector('[data-action="admin-user-toggle-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/enabled" &&
          method === "PUT" &&
          body.enabled === false,
      ),
    );
    document
      .querySelector('[data-action="admin-user-delete-request"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-delete-confirm"][data-id="1"]',
      ),
    );
    document.querySelector('[data-action="admin-user-delete-cancel"]').click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1" && method === "DELETE",
      ),
      false,
      "canceling confirmation must leave the user intact",
    );
    document
      .querySelector('[data-action="admin-user-delete-request"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-delete-confirm"][data-id="1"]')
      .click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/users/1" && method === "DELETE",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin user editor requires a role and clears email verification without email", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1", "PUT", ({ body }) => body);
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-edit-toggle"][data-id="1"]')
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-user-edit"]');
    assert.ok(form);
    form.querySelector('[name="roles"]').checked = false;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === "/api/admin/users/1" && method === "PUT",
      ),
      false,
    );
    form = document.querySelector('[data-form="admin-user-edit"]');
    assert.ok(
      [...form.querySelectorAll(".field-error")].some(
        (element) => element.textContent,
      ),
    );
    form.querySelector('[name="roles"]').checked = true;
    form.elements.namedItem("email").value = "";
    form.elements.namedItem("emailVerified").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) => path === "/api/admin/users/1" && method === "PUT",
    );
    assert.ok(save);
    assert.deepEqual(save.body.roles, ["ROLE_USER"]);
    assert.equal(save.body.emailVerified, false);
  } finally {
    harness.restore();
  }
});
test("native Admin user access controls confirm disable, reset MFA, unlock, and send action email", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/enabled", "PUT", ({ body }) => body);
  harness.setResponse("/api/admin/users/1/totp", "DELETE", () => ({
    status: 204,
  }));
  harness.setResponse("/api/admin/users/1/unlock", "POST", () => ({
    status: 204,
  }));
  harness.setResponse(
    "/api/admin/users/1/execute-actions-email?lifespan=3600",
    "PUT",
    () => ({ status: 204 }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-toggle-enabled"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-toggle-confirm"][data-id="1"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-toggle-confirm"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/enabled" &&
          method === "PUT" &&
          body.enabled === false,
      ),
    );
    document
      .querySelector(
        '[data-action="admin-user-totp-reset-request"][data-id="1"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-user-totp-reset-confirm"][data-id="1"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/totp" && method === "DELETE",
      ),
    );
    document
      .querySelector('[data-action="admin-user-unlock"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/unlock" && method === "POST",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-user-action-email-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-user-action-email"]',
    );
    assert.ok(form);
    form.elements.namedItem("action").value = "VERIFY_EMAIL";
    form.elements.namedItem("lifespan").value = "3600";
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
          path === "/api/admin/users/1/execute-actions-email?lifespan=3600" &&
          method === "PUT" &&
          body[0] === "VERIFY_EMAIL",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin password reset validates strength and never keeps the submitted value", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/password", "PUT", () => ({
    status: 204,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-user-password-reset-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-user-password-reset"]',
    );
    assert.ok(form);
    form.elements.namedItem("password").value = "short";
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
          path === "/api/admin/users/1/password" && method === "PUT",
      ),
      false,
    );
    form = document.querySelector('[data-form="admin-user-password-reset"]');
    const submittedPassword = "desktop-test-password-42";
    form.elements.namedItem("password").value = submittedPassword;
    form.elements.namedItem("temporary").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const reset = calls.find(
      ({ path, method }) =>
        path === "/api/admin/users/1/password" && method === "PUT",
    );
    assert.ok(reset);
    assert.equal(reset.body.password, submittedPassword);
    assert.equal(reset.body.temporary, true);
    assert.equal(
      document.querySelector('[data-form="admin-user-password-reset"]'),
      null,
    );
    assert.equal(document.body.textContent.includes(submittedPassword), false);
  } finally {
    harness.restore();
  }
});
test("native Admin OIDC provider creation validates endpoints and clears the client secret", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers/example-oidc",
    "GET",
    () => ({
      id: "example-oidc",
      providerType: "oidc",
      displayName: "Example Identity Provider",
      alias: "example-oidc",
      registrationId: "example-oidc",
      clientSecretConfigured: true,
    }),
  );
  harness.setResponse("/api/admin/identity-providers", "POST", ({ body }) => ({
    id: "example-oidc",
    providerType: "oidc",
    clientSecretConfigured: true,
    ...Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== "clientSecret"),
    ),
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document.querySelector('[data-action="admin-provider-create"]').click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-connection"]',
    );
    assert.ok(form);
    const fields = {
      registrationId: "example-oidc",
      displayName: "Example Identity Provider",
      alias: "example-oidc",
      iconKey: "generic",
      clientId: "native-console",
      clientSecret: "sensitive-provider-secret",
      authorizationUri: "https://issuer.example.test/authorize",
      tokenUri: "https://issuer.example.test/token",
    };
    for (const [name, value] of Object.entries(fields))
      form.elements.namedItem(name).value = value;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers" && method === "POST",
    );
    assert.ok(save);
    assert.equal(
      save.body.clientSecret === "sensitive-provider-secret",
      true,
      "the secret is sent only in the authorized provider save request",
    );
    assert.equal(save.body.providerType, "oidc");
    assert.equal(save.body.registrationId, "example-oidc");
    assert.ok(
      document.querySelector(
        '[data-form="admin-identity-provider-connection"]',
      ),
    );
    assert.equal(
      document
        .querySelector('[data-form="admin-identity-provider-connection"]')
        .elements.namedItem("clientSecret").value,
      "",
    );
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("sensitive-provider-secret"),
      false,
      "the provider secret must not remain in rendered state",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin SAML provider creation validates metadata and clears private keys", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers/example-saml",
    "GET",
    () => ({
      id: "example-saml",
      providerType: "saml",
      displayName: "Example SAML",
      alias: "example-saml",
      registrationId: "example-saml",
    }),
  );
  let finishSave;
  harness.setResponse(
    "/api/admin/identity-providers",
    "POST",
    ({ body }) =>
      new Promise((resolve) => {
        finishSave = () => resolve({ id: "example-saml", ...body });
      }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document.querySelector('[data-action="admin-provider-create"]').click();
    const providerType = document.querySelector("[data-provider-create-type]");
    providerType.value = "saml";
    providerType.dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    await settle();
    let form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    assert.ok(form);
    const setField = (name, value) => {
      form.elements.namedItem(name).value = value;
    };
    setField("registrationId", "example-saml");
    setField("displayName", "Example SAML");
    setField("alias", "example-saml");
    setField("iconKey", "generic");
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
          path === "/api/admin/identity-providers" && method === "POST",
      ),
      false,
      "SAML requires a metadata URI or complete manual configuration",
    );
    form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    form.elements.namedItem("samlMetadataUri").value =
      "https://issuer.example.test/metadata";
    form.elements.namedItem("samlSigningPrivateKey").value =
      "-----BEGIN PRIVATE KEY-----\\nSIGNING_SENTINEL\\n-----END PRIVATE KEY-----";
    form.elements.namedItem("samlDecryptionPrivateKey").value =
      "-----BEGIN PRIVATE KEY-----\\nDECRYPTION_SENTINEL\\n-----END PRIVATE KEY-----";
    form.elements.namedItem("samlWantAssertionsSigned").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    const saveButton = form.querySelector('button[type="submit"]');
    assert.equal(saveButton.disabled, true);
    assert.ok(saveButton.querySelector(".spinner"));
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/identity-providers" && method === "POST",
      ).length,
      1,
      "a pending SAML save must ignore duplicate submissions",
    );
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers" && method === "POST",
    );
    assert.equal(save.body.providerType, "saml");
    assert.equal(
      save.body.samlMetadataUri,
      "https://issuer.example.test/metadata",
    );
    assert.equal(
      save.body.samlSigningPrivateKey.includes("SIGNING_SENTINEL"),
      true,
    );
    assert.equal(
      save.body.samlDecryptionPrivateKey.includes("DECRYPTION_SENTINEL"),
      true,
    );
    finishSave();
    await settle();
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("SIGNING_SENTINEL"),
      false,
      "private key input must be cleared from the rendered form after save",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin OIDC details match the Web form and save policy options together", async () => {
  const harness = await renderConsole("admin");
  const providerPath = "/api/admin/identity-providers/example/native-policy";
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "example",
          providerType: "oidc",
          alias: "example",
          displayName: "Example",
          enabled: true,
          configured: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    "/api/admin/identity-providers/example/native-policy",
    "GET",
    () => ({
      displayName: "Example",
      enabled: true,
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: false,
      guiOrder: 1,
      showInAccountConsole: "always",
      syncMode: "import",
    }),
  );
  harness.setResponse("/api/admin/identity-providers/example", "GET", () => ({
    id: "example",
    providerType: "oidc",
    alias: "example",
    displayName: "Example",
    registrationId: "example",
    clientId: "example-client",
    clientSecretConfigured: true,
    authorizationUri: "https://issuer.example.test/authorize",
    tokenUri: "https://issuer.example.test/token",
    userInfoUri: "",
    jwkSetUri: "",
    issuerUri: "",
    scopes: "openid profile email",
    userNameAttribute: "sub",
    clientAuthenticationMethod: "client_secret_basic",
    requiredClaims: "sub,email",
    guiOrder: 1,
    syncMode: "import",
    showInAccountConsole: "always",
    shortStateParameter: false,
    caseSensitiveUsername: false,
    storeTokens: false,
    storedTokensReadable: false,
  }));
  harness.setResponse(
    "/api/admin/identity-providers/example",
    "PUT",
    ({ body }) => body,
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document
      .querySelector('a[data-action="admin-provider-open"][data-id="example"]')
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-connection"]',
    );
    assert.ok(form);
    assert.equal(form.elements.namedItem("displayName").value, "Example");
    assert.equal(
      document.querySelectorAll('[data-form="admin-identity-provider-policy"]')
        .length,
      0,
    );
    assert.equal(
      document.querySelectorAll(".identity-provider-checkbox").length,
      9,
    );
    form.elements.namedItem("enabled").checked = false;
    form.elements.namedItem("hideOnLogin").checked = true;
    form.elements.namedItem("mfaRequired").checked = true;
    form.elements.namedItem("shortStateParameter").checked = true;
    form.elements.namedItem("guiOrder").value = "7";
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
          path === "/api/admin/identity-providers/example" &&
          method === "PUT" &&
          body.displayName === "Example" &&
          body.enabled === false &&
          body.hideOnLogin === true &&
          body.mfaRequired === true &&
          body.shortStateParameter === true &&
          body.guiOrder === 7,
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin passkey management renames and confirms credential deletion", async () => {
  const harness = await renderConsole("admin");
  const credentialPath = "/api/admin/users/1/webauthn/credentials/credential_1";
  harness.setResponse(
    "/api/admin/users/1/webauthn/credentials?page=0&size=100",
    "GET",
    () => ({
      content: [
        {
          credentialId: "credential_1",
          label: "Work laptop",
          transports: ["internal"],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(credentialPath, "PUT", ({ body }) => body);
  harness.setResponse(credentialPath, "DELETE", () => ({ status: 204 }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-passkeys-toggle"][data-id="1"]')
      .click();
    await settle();
    const card = document.querySelector('[data-passkey-index="0"]');
    assert.ok(card);
    card
      .querySelector('[data-action="admin-user-passkey-rename-toggle"]')
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-user-passkey-rename"]',
    );
    assert.ok(form);
    form.elements.namedItem("label").value = "  Updated laptop  ";
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
          path === credentialPath &&
          method === "PUT" &&
          body.label === "Updated laptop",
      ),
    );
    document
      .querySelector('[data-action="admin-user-passkey-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-passkey-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-passkey-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === credentialPath && method === "DELETE",
      ),
      false,
    );
    document
      .querySelector('[data-action="admin-user-passkey-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-passkey-delete-confirm"]')
      .click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) => path === credentialPath && method === "DELETE",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin passkey pagination loads and returns to bounded pages", async () => {
  const harness = await renderConsole("admin");
  const firstPagePath =
    "/api/admin/users/1/webauthn/credentials?page=0&size=100";
  const secondPagePath =
    "/api/admin/users/1/webauthn/credentials?page=1&size=100";
  harness.setResponse(firstPagePath, "GET", () => ({
    content: [
      { credentialId: "credential_1", label: "Work laptop", transports: [] },
    ],
    totalElements: 2,
    totalPages: 2,
    number: 0,
  }));
  harness.setResponse(secondPagePath, "GET", () => ({
    content: [
      { credentialId: "credential_2", label: "Security key", transports: [] },
    ],
    totalElements: 2,
    totalPages: 2,
    number: 1,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-passkeys-toggle"][data-id="1"]')
      .click();
    await settle();
    assert.ok(document.querySelector('[data-passkey-index="0"]'));
    document
      .querySelector('[data-action="admin-user-passkey-page"][data-index="1"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector('[data-passkey-index="0"] strong').textContent,
      "Security key",
    );
    assert.ok(calls.some(({ path }) => path === secondPagePath));
    document
      .querySelector('[data-action="admin-user-passkey-page"][data-index="0"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector('[data-passkey-index="0"] strong').textContent,
      "Work laptop",
    );
    assert.equal(
      calls.filter(({ path }) => path === firstPagePath).length,
      2,
      "opening the panel and returning to its first page should load page zero",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin user profile attributes normalize multi-value and boolean fields", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    attributes: {
      departments: ["Platform"],
      publicProfile: ["false"],
      contactEmail: ["ada@example.test"],
      seatCount: ["4"],
      biography: ["Identity engineer"],
    },
    definitions: [
      {
        name: "departments",
        displayName: "Departments",
        enabled: true,
        builtIn: false,
        multivalued: true,
        required: true,
      },
      {
        name: "publicProfile",
        displayName: "Public profile",
        type: "BOOLEAN",
        enabled: true,
        builtIn: false,
        multivalued: false,
        required: false,
      },
      {
        name: "contactEmail",
        displayName: "Contact email",
        type: "EMAIL",
        enabled: true,
        builtIn: false,
        minLength: 5,
        maxLength: 120,
      },
      {
        name: "seatCount",
        displayName: "Seat count",
        type: "INTEGER",
        enabled: true,
        builtIn: false,
        minLength: 1,
        maxLength: 3,
        pattern: "^[0-9]+$",
      },
      {
        name: "biography",
        displayName: "Biography",
        type: "STRING",
        enabled: true,
        builtIn: false,
        pattern: "^[A-Za-z ]+$",
      },
    ],
  }));
  harness.setResponse(
    "/api/admin/users/1/profile-attributes",
    "PUT",
    ({ body }) => ({ attributes: body.attributes }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-user-profile-attributes-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-user-profile-attributes"]',
    );
    assert.ok(form);
    assert.equal(
      form.querySelector('[name="attribute-contactEmail"]').type,
      "email",
    );
    assert.equal(
      form.querySelector('[name="attribute-seatCount"]').type,
      "number",
    );
    assert.equal(
      form.querySelector('[name="attribute-seatCount"]').getAttribute("step"),
      "1",
    );
    assert.equal(
      form.querySelector('[name="attribute-biography"]').type,
      "text",
    );
    assert.equal(
      form
        .querySelector('[name="attribute-biography"]')
        .getAttribute("pattern"),
      "^[A-Za-z ]+$",
    );
    form.querySelector('[data-profile-attribute="departments"]').value =
      " Platform \n Security \n \n";
    form.querySelector('[data-profile-attribute="publicProfile"]').value =
      "false";
    form.querySelector('[data-profile-attribute="contactEmail"]').value =
      "ada@example.test";
    form.querySelector('[data-profile-attribute="seatCount"]').value = "4";
    form.querySelector('[data-profile-attribute="biography"]').value =
      "Identity engineer";
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
          path === "/api/admin/users/1/profile-attributes" &&
          method === "PUT" &&
          body.attributes.departments.join(",") === "Platform,Security" &&
          body.attributes.publicProfile[0] === "false" &&
          body.attributes.contactEmail[0] === "ada@example.test" &&
          body.attributes.seatCount[0] === "4" &&
          body.attributes.biography[0] === "Identity engineer",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin user avatar validates, uploads, and confirms removal", async () => {
  const harness = await renderConsole("admin");
  globalThis.__KITEZH_NATIVE_BOOTSTRAP__.apiBaseUrl =
    "https://kitezh.onrender.com";
  const previousCreateImageBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    writable: true,
    value: async () => ({ width: 32, height: 32, close() {} }),
  });
  harness.setResponse("/api/admin/users/1/avatar", "PUT", () => ({
    avatarUrl: "/avatars/550e8400-e29b-41d4-a716-446655440000?v=1",
  }));
  harness.setResponse("/api/admin/users/1/avatar", "DELETE", () => ({
    status: 204,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-avatar-toggle"][data-id="1"]')
      .click();
    await settle();
    const upload = document.querySelector(
      '[data-action="admin-user-avatar-upload"]',
    );
    upload.click();
    await settle();
    assert.match(document.querySelector(".content").textContent, /avatar/i);
    assert.equal(
      calls.some(
        ({ path, method }) => path.endsWith("/avatar") && method === "PUT",
      ),
      false,
    );
    const fileInput = document.querySelector('[data-admin-avatar-file="1"]');
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [
        {
          type: "image/png",
          size: 5,
          arrayBuffer: async () =>
            new Uint8Array([104, 101, 108, 108, 111]).buffer,
        },
      ],
    });
    document.querySelector('[data-action="admin-user-avatar-upload"]').click();
    await settle();
    assert.ok(
      document.querySelector(
        'img[src="https://kitezh.onrender.com/avatars/550e8400-e29b-41d4-a716-446655440000?v=1"]',
      ),
    );
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/avatar" &&
          method === "PUT" &&
          body.dataBase64 === "aGVsbG8=",
      ),
    );
    document
      .querySelector('[data-action="admin-user-avatar-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-avatar-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-avatar-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/avatar" && method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector(
        'img[src="https://kitezh.onrender.com/avatars/550e8400-e29b-41d4-a716-446655440000?v=1"]',
      ),
      null,
    );
  } finally {
    harness.restore();
    if (previousCreateImageBitmap) {
      Object.defineProperty(
        globalThis,
        "createImageBitmap",
        previousCreateImageBitmap,
      );
    } else {
      delete globalThis.createImageBitmap;
    }
  }
});
test("native Admin confidential client validates redirects and reveals its secret once", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients", "POST", ({ body }) => ({
    client: {
      id: "created-console",
      clientId: body.clientId,
      clientName: body.clientName,
      scopes: body.scopes,
    },
    clientSecret: "one-time-client-secret",
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document.querySelector('[data-action="create-client"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-client-create"]');
    assert.ok(form);
    form.elements.namedItem("clientId").value = "native-console";
    form.elements.namedItem("clientName").value = "Native Console";
    form.elements.namedItem("redirectUris").value = "javascript:alert(1)";
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
          path === "/api/admin/clients" && method === "POST",
      ),
      false,
      "unsafe redirect destinations must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));
    form = document.querySelector('[data-form="admin-client-create"]');
    form.elements.namedItem("redirectUris").value =
      "https://console.example.test/callback";
    form.elements.namedItem("postLogoutRedirectUris").value =
      "https://console.example.test/logout";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const create = calls.find(
      ({ path, method }) => path === "/api/admin/clients" && method === "POST",
    );
    assert.ok(create);
    assert.equal(create.body.requireProofKey, true);
    assert.equal(
      create.body.clientAuthenticationMethods[0],
      "client_secret_basic",
    );
    assert.equal(
      document.querySelector('[data-one-time-client-secret="true"]')
        ?.textContent === "one-time-client-secret",
      true,
    );
    assert.equal(
      document.querySelector('[data-form="admin-client-create"]'),
      null,
    );
    document
      .querySelector('[data-action="client-create-secret-dismiss"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector('[data-one-time-client-secret="true"]'),
      null,
    );
    assert.ok(document.querySelector('[data-route="clients"]'));
  } finally {
    harness.restore();
  }
});
test("native Admin policy and branding settings render and persist their forms", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/ciba-policy", "GET", () => ({
    requestLifespanSeconds: 120,
    pollingIntervalSeconds: 5,
    deliveryMode: "poll",
    userVerification: "preferred",
    mfaRequired: true,
    stepUpRequired: false,
    stepUpAcr: "urn:example:loa:2",
  }));
  harness.setResponse("/api/admin/settings/offline-access", "GET", () => ({
    idleTimeout: "P30D",
    maxLifespan: "P180D",
    maxLimited: true,
  }));
  harness.setResponse("/api/admin/settings/branding", "GET", () => ({
    applicationName: "Kitezh",
    primaryColor: "#112233",
    accentColor: "#445566",
    backgroundColor: "#ffffff",
    logoPath: "/assets/logo.svg",
  }));
  harness.setResponse("/api/admin/server-info", "GET", () => ({
    issuer: "https://issuer.example.test",
    activeSigningKey: {
      kid: "key-1",
      type: "RSA",
      algorithm: "RS256",
      use: "sig",
    },
  }));
  harness.setResponse(
    "/api/admin/settings/ciba-policy",
    "PUT",
    (request) => request.body,
  );
  harness.setResponse(
    "/api/admin/settings/offline-access",
    "PUT",
    (request) => request.body,
  );
  harness.setResponse(
    "/api/admin/settings/branding",
    "PUT",
    (request) => request.body,
  );
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "ciba-policy");
    const ciba = document.querySelector('[data-form="admin-ciba-policy"]');
    assert.ok(ciba);
    ciba.elements.namedItem("stepUpRequired").checked = true;
    ciba.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/ciba-policy" &&
          method === "PUT" &&
          body.stepUpRequired,
      ),
    );
    document.querySelector('[data-action="admin-settings-tab"][data-tab="offline-access"]').click();
    await settle();
    const offline = document.querySelector(
      '[data-form="admin-offline-access-policy"]',
    );
    assert.ok(offline);
    offline.elements.namedItem("maxLimited").checked = false;
    offline.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/offline-access" &&
          method === "PUT" &&
          body.maxLimited === false,
      ),
    );
    document.querySelector('[data-action="admin-settings-tab"][data-tab="branding"]').click();
    await settle();
    const branding = document.querySelector('[data-form="admin-branding"]');
    assert.ok(branding);
    branding.elements.namedItem("applicationName").value = "Kitezh Desktop";
    branding.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/branding" &&
          method === "PUT" &&
          body.applicationName === "Kitezh Desktop",
      ),
    );
    assert.equal(
      document.querySelector(
        '[data-form="admin-branding"] input[name="applicationName"]',
      ).value,
      "Kitezh Desktop",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin dashboard shows healthy server, signing key, and recent events", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/dashboard", "GET", () => ({
    clients: 7,
    users: 22,
    sessions: 3,
    consents: 5,
  }));
  harness.setResponse(
    "/api/admin/events?size=6&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [
        {
          action: "user.updated",
          actor: "admin@example.test",
          targetType: "user",
          targetId: "42",
          occurredAt: "2026-10-12T08:30:00Z",
        },
      ],
    }),
  );
  harness.setResponse("/api/admin/server-info", "GET", () => ({
    issuer: "https://issuer.example.test",
    activeSigningKey: { kid: "key-1", algorithm: "RS256" },
  }));
  harness.setResponse("/actuator/health/readiness", "GET", () => ({
    status: 200,
    body: { status: "UP" },
  }));
  try {
    const { document } = harness;
    document.querySelector('[data-route="dashboard"]').click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /issuer\.example\.test/,
    );
    assert.match(document.querySelector(".content").textContent, /key-1/);
    assert.match(
      document.querySelector(".content").textContent,
      /user\.updated/,
    );
    assert.match(document.querySelector('[role="status"]').textContent, /UP/);
    assert.equal(document.querySelectorAll(".stat-value")[0].textContent, "7");
  } finally {
    harness.restore();
  }
});
test("native Admin LDAP overview displays configured provider status", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/ldap", "GET", () => [
    {
      id: 1,
      name: "Corporate Directory",
      vendor: "Active Directory",
      authenticationType: "simple",
      editMode: "READ_ONLY",
      enabled: true,
      lastSyncImported: 4,
    },
  ]);
  try {
    const { document } = harness;
    await openAdminSettingsTab(document, "user-federation");
    assert.match(
      document.querySelector(".content").textContent,
      /Corporate Directory/,
    );
    assert.match(
      document.querySelector(".content").textContent,
      /Active Directory/,
    );
    assert.match(document.querySelector(".content").textContent, /4/);
  } finally {
    harness.restore();
  }
});
test("native Admin sessions search and revocation controls use bounded contracts", async () => {
  const harness = await renderConsole("admin");
  let active = true;
  harness.setResponse("/api/admin/sessions/session-1", "DELETE", () => {
    active = false;
    return { status: 204 };
  });
  const sessionPage = () => ({
    content: active
      ? [
          {
            id: "session-1",
            username: "ada",
            authorizationCount: 2,
            active: true,
          },
        ]
      : [],
    number: 0,
    totalPages: 1,
  });
  harness.setResponse(
    "/api/admin/sessions?q=&status=active&page=0&size=20&sort=lastAccessTime%2Cdesc",
    "GET",
    sessionPage,
  );
  harness.setResponse(
    "/api/admin/sessions?q=ada&status=expired&page=0&size=20&sort=lastAccessTime%2Cdesc",
    "GET",
    sessionPage,
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="sessions"]').click();
    await settle();
    const search = document.getElementById("admin-session-search");
    search.elements.namedItem("q").value = "ada";
    search.elements.namedItem("status").value = "expired";
    search.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path }) => path.includes("q=ada") && path.includes("status=expired"),
      ),
    );
    document
      .querySelector('[data-action="admin-session-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-session-delete-confirm"]'),
    );
    document
      .querySelector('[data-action="admin-session-delete-cancel"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-session-delete-request"]'),
    );
    document
      .querySelector('[data-action="admin-session-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-session-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/sessions/session-1" && method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector('[data-action="admin-session-delete-request"]'),
      null,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin consent and offline-session revocation require confirmation", async () => {
  const harness = await renderConsole("admin");
  let consentActive = true;
  let offlineSessionActive = true;
  harness.setResponse(
    "/api/admin/consents?q=&clientId=&username=&scope=&page=0&size=10&sort=id.principalName%2Casc",
    "GET",
    () => ({
      content: consentActive
        ? [
            {
              clientId: "console-client",
              clientName: "Console",
              principalName: "ada@example.test",
              authorities: ["openid"],
            },
          ]
        : [],
      number: 0,
      totalPages: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/consents/consents/console-client/ada%40example.test",
    "DELETE",
    () => {
      consentActive = false;
      return { status: 204 };
    },
  );
  harness.setResponse(
    "/api/admin/offline-sessions?page=0&size=20",
    "GET",
    () => ({
      content: offlineSessionActive
        ? [
            {
              id: "offline-session-1",
              clientId: "console-client",
              clientName: "Console",
              username: "ada",
            },
          ]
        : [],
      number: 0,
      totalPages: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/offline-sessions/offline-session-1",
    "DELETE",
    () => {
      offlineSessionActive = false;
      return { status: 204 };
    },
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="consents"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-consent-revoke-confirm"]'),
    );
    document
      .querySelector('[data-action="admin-consent-revoke-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path.includes("console-client/ada%40example.test") &&
          method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector('[data-action="admin-consent-revoke-request"]'),
      null,
    );
    document.querySelector('[data-route="offline-sessions"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-offline-session-revoke-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-offline-session-revoke-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/offline-sessions/offline-session-1" &&
          method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector(
        '[data-action="admin-offline-session-revoke-request"]',
      ),
      null,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin signing-key rotation requires a second confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/keys/rotate", "POST", () => ({
    kid: "signing-key-2",
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="keys"]').click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /signing-key-1/,
    );
    document.querySelector('[data-action="admin-key-rotate-request"]').click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-key-rotate-confirm"]'),
    );
    document.querySelector('[data-action="admin-key-rotate-cancel"]').click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/keys/rotate" && method === "POST",
      ),
      false,
    );
    document.querySelector('[data-action="admin-key-rotate-request"]').click();
    await settle();
    document.querySelector('[data-action="admin-key-rotate-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/keys/rotate" && method === "POST",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin bulk user updates validate selection and confirm before submit", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/bulk", "POST", ({ body }) => body);
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    await settle();
    const checkbox = document.querySelector(
      '[data-action="admin-user-bulk-select"][data-id="1"]',
    );
    assert.ok(checkbox);
    checkbox.click();
    await settle();
    const enable = document.querySelector(
      '[data-action="admin-user-bulk-enable"]',
    );
    assert.ok(enable);
    enable.click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-user-bulk-confirm"]'),
    );
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/bulk" && method === "POST",
      ),
      false,
    );
    document.querySelector('[data-action="admin-user-bulk-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/bulk" &&
          method === "POST" &&
          body.action === "ENABLE" &&
          body.userIds.includes(1),
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin identity-provider mapper CRUD validates and persists mappings", async () => {
  const harness = await renderConsole("admin");
  const mapperPath = "/api/admin/identity-providers/github/mappers";
  let mappers = [
    {
      id: "email-mapper",
      name: "email",
      sourceClaim: "email",
      target: "email",
      mapperType: "user-attribute",
      syncMode: "import",
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "github",
          alias: "github",
          providerType: "oidc",
          displayName: "GitHub",
          enabled: true,
          configured: true,
          mapperCount: mappers.length,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${mapperPath}?q=&page=0&size=10&sort=name%2Casc`,
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${mapperPath}?q=email&page=0&size=10&sort=name%2Casc`,
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse("/api/admin/identity-providers/github", "GET", () => ({
    id: "github",
    alias: "github",
    providerType: "oidc",
    displayName: "GitHub",
    registrationId: "github",
    clientId: "github-client",
    clientSecretConfigured: true,
  }));
  harness.setResponse(
    "/api/admin/identity-providers/github/native-policy",
    "GET",
    () => ({
      displayName: "GitHub",
      enabled: true,
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: false,
      guiOrder: 1,
      showInAccountConsole: "always",
      syncMode: "import",
    }),
  );
  harness.setResponse(`${mapperPath}/email-mapper`, "PUT", ({ body }) => ({
    id: "email-mapper",
    ...body,
  }));
  harness.setResponse(mapperPath, "POST", ({ body }) => {
    const saved = { id: "given-name", ...body };
    mappers = [...mappers, saved];
    return saved;
  });
  harness.setResponse(`${mapperPath}/email-mapper`, "DELETE", () => {
    mappers = [];
    return { status: 204 };
  });
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector('a[data-action="admin-provider-open"][data-id="github"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-tab"][data-tab="mappers"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(".provider-mappers-card .admin-detail-heading h2"),
    );
    assert.ok(document.querySelector(".provider-mappers-table-surface"));
    assert.ok(
      document.querySelector(
        ".provider-mapper-search-input .provider-search-icon svg",
      ),
    );
    assert.equal(
      document.querySelectorAll(
        "#admin-provider-mapper-search button[type=submit]",
      ).length,
      0,
    );
    assert.match(
      document.querySelector(".provider-mapper-result-count").textContent,
      /1\s+records?/,
    );
    assert.equal(
      document.querySelectorAll(
        ".provider-mapper-pagination .provider-page-button",
      ).length,
      4,
    );
    assert.equal(
      document.querySelector("#admin-provider-mapper-size").value,
      "10",
    );
    const searchInput = document.querySelector(
      "#admin-provider-mapper-search input[name=q]",
    );
    searchInput.value = "email";
    searchInput.dispatchEvent(
      new document.defaultView.Event("input", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path === `${mapperPath}?q=email&page=0&size=10&sort=name%2Casc`,
      ),
    );
    assert.ok(
      document.querySelector('[data-provider-mapper-id="email-mapper"]'),
      JSON.stringify(calls.map(({ path }) => path)),
    );
    document
      .querySelector('[data-action="admin-provider-mapper-edit"]')
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    form.elements.namedItem("target").value = "primaryEmail";
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
          path === `${mapperPath}/email-mapper` &&
          method === "PUT" &&
          body.target === "primaryEmail",
      ),
    );
    document
      .querySelector('[data-action="admin-provider-mapper-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-provider-mapper-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-provider-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${mapperPath}/email-mapper` && method === "DELETE",
      ),
    );
    document
      .querySelector('[data-action="admin-provider-mapper-create"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "givenName";
    form.elements.namedItem("sourceClaim").value = "given_name";
    form.elements.namedItem("target").value = "firstName";
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
          path === mapperPath &&
          method === "POST" &&
          body.name === "givenName" &&
          body.target === "firstName",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin OIDC connection updates preserve configured secrets", async () => {
  const harness = await renderConsole("admin");
  const provider = {
    id: "github",
    registrationId: "github",
    providerType: "oidc",
    displayName: "GitHub",
    alias: "github",
    iconKey: "github",
    enabled: true,
    clientId: "public-client-id",
    clientSecretConfigured: true,
    authorizationUri: "https://github.example.test/authorize",
    tokenUri: "https://github.example.test/token",
    userInfoUri: "https://github.example.test/userinfo",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid profile email",
    userNameAttribute: "login",
  };
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({ content: [provider], totalElements: 1, totalPages: 1, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/identity-providers/github",
    "GET",
    () => provider,
  );
  harness.setResponse(
    "/api/admin/identity-providers/github",
    "PUT",
    ({ body }) => ({ ...provider, ...body, clientSecretConfigured: true }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector('a[data-action="admin-provider-open"][data-id="github"]')
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-connection"]',
    );
    assert.ok(form);
    assert.equal(form.elements.namedItem("clientSecret").value, "");
    form.elements.namedItem("displayName").value = "GitHub Enterprise";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const update = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers/github" && method === "PUT",
    );
    assert.ok(update);
    assert.equal(update.body.clientSecret, "");
    assert.equal(update.body.displayName, "GitHub Enterprise");
    assert.ok(
      document.querySelector(
        '[data-form="admin-identity-provider-connection"]',
      ),
    );
    assert.equal(
      document
        .querySelector('[data-form="admin-identity-provider-connection"]')
        .elements.namedItem("clientSecret").value,
      "",
    );
  } finally {
    harness.restore();
  }
});
test("native Admin identity-provider deletion requires confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "github",
          alias: "github",
          registrationId: "github",
          providerType: "oidc",
          displayName: "GitHub",
          enabled: true,
          configured: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse("/api/admin/identity-providers/github", "DELETE", () => ({
    status: 204,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-request"][data-id="github"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-identity-provider-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/identity-providers/github" &&
          method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-request"][data-id="github"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-confirm"][data-id="github"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/identity-providers/github" &&
          method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin identity-provider list keeps the display name separate from a distinct alias", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "google",
          alias: "google",
          registrationId: "google",
          providerType: "oidc",
          displayName: "Google",
          iconKey: "google",
          enabled: true,
          configured: true,
        },
        {
          id: "workforce",
          alias: "workforce-sso",
          registrationId: "workforce-sso",
          providerType: "saml",
          displayName: "Workforce SSO",
          iconKey: "microsoft",
          enabled: true,
          configured: false,
        },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
    }),
  );
  try {
    const { document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    const googleLabel = document.querySelector(
      '[data-action="admin-provider-open"][data-id="google"] .provider-label',
    );
    assert.equal(googleLabel.querySelector("strong").textContent, "Google");
    assert.equal(googleLabel.querySelector("small"), null);
    assert.ok(
      document.querySelector(
        '[data-action="admin-provider-open"][data-id="google"] .provider-icon svg path',
      ),
    );
    const workforceLabel = document.querySelector(
      '[data-action="admin-provider-open"][data-id="workforce"] .provider-label',
    );
    assert.equal(
      workforceLabel.querySelector("strong").textContent,
      "Workforce SSO",
    );
    assert.equal(
      workforceLabel.querySelector("small").textContent,
      "workforce-sso",
    );
    assert.equal(
      document.querySelectorAll(
        "#admin-identity-provider-search button[type=submit]",
      ).length,
      0,
    );
    assert.ok(document.querySelector(".provider-search-icon svg"));
    assert.equal(
      document.querySelectorAll(
        ".provider-pagination-controls .provider-page-button",
      ).length,
      4,
    );
    assert.equal(
      document.querySelectorAll(
        ".identity-provider-page .admin-data-table tbody tr",
      ).length,
      2,
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client mapper CRUD validates and persists mappings", async () => {
  const harness = await renderConsole("admin");
  const mapperPath = "/api/admin/clients/console-client/mappers";
  let mappers = [
    {
      id: "17",
      name: "email",
      source: "email",
      mapperType: "email",
      claimName: "email",
      priority: 100,
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    mapperPath + "?page=0&size=10&sort=name,asc",
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(`${mapperPath}/17`, "PUT", ({ body }) => ({
    id: "17",
    ...body,
  }));
  harness.setResponse(mapperPath, "POST", ({ body }) => {
    const saved = { id: "18", ...body };
    mappers = [...mappers, saved];
    return saved;
  });
  harness.setResponse(`${mapperPath}/17`, "DELETE", () => {
    mappers = [];
    return { status: 204 };
  });
  harness.setResponse("/api/admin/clients/console-client", "DELETE", () => ({
    status: 204,
  }));
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "mappers");
    await settle();
    assert.ok(document.querySelector('[data-client-mapper-id="17"]'));
    document.querySelector('[data-action="admin-client-mapper-edit"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-client-mapper"]');
    assert.ok(form);
    form.elements.namedItem("claimName").value = "primary_email";
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
          path === `${mapperPath}/17` &&
          method === "PUT" &&
          body.claimName === "primary_email",
      ),
    );
    document
      .querySelector('[data-action="admin-client-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${mapperPath}/17` && method === "DELETE",
      ),
    );
    document
      .querySelector('[data-action="admin-client-mapper-create"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-client-mapper"]');
    form.elements.namedItem("name").value = "primary-email";
    form.elements.namedItem("claimName").value = "email";
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
          path === mapperPath &&
          method === "POST" &&
          body.name === "primary-email" &&
          body.mapperType === "email",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-delete-request"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-cancel"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-request"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-confirm"][data-id="console-client"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/clients/console-client" && method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});
test("native Admin client configuration validates, saves, and excludes the service username", async () => {
  const harness = await renderConsole("admin");
  const client = {
    id: "console-client",
    clientId: "console-client",
    clientName: "Console Client",
    clientAuthenticationMethods: ["client_secret_basic"],
    authorizationGrantTypes: ["authorization_code"],
    redirectUris: [],
    postLogoutRedirectUris: [],
    scopes: ["openid"],
    dpopSigningAlgorithms: ["RS256"],
    serviceAccountUsername: "internal-service-user",
  };
  harness.setResponse("/api/admin/clients/console-client", "GET", () => client);
  harness.setResponse(
    "/api/admin/clients/console-client",
    "PUT",
    ({ body }) => body,
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "settings");
    await settle();
    let form = document.querySelector(
      '[data-form="admin-client-configuration"]',
    );
    assert.ok(form);
    assert.equal(form.textContent.includes("internal-service-user"), false);
    form.elements.namedItem("redirectUris").value = "not-a-url";
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
          path === "/api/admin/clients/console-client" && method === "PUT",
      ),
      false,
      "invalid redirect URIs must not reach the API",
    );
    form = document.querySelector('[data-form="admin-client-configuration"]');
    form.elements.namedItem("redirectUris").value =
      "https://client.example.test/callback";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const update = calls.find(
      ({ path, method }) =>
        path === "/api/admin/clients/console-client" && method === "PUT",
    );
    assert.ok(update);
    assert.deepEqual(update.body.redirectUris, [
      "https://client.example.test/callback",
    ]);
    assert.equal("serviceAccountUsername" in update.body, false);
    assert.equal(update.body.cibaClientNotificationToken, "");
  } finally {
    harness.restore();
  }
});
test("native Admin client role assignment and composite panels load bounded candidates", async () => {
  const harness = await renderConsole("admin");
  const rolePath = "/api/admin/clients/console-client/roles/23";
  harness.setResponse(
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc",
    "GET",
    () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}?page=0&size=20&sort=username,asc`,
    "GET",
    () => ({
      users: { content: [{ id: 1, username: "ada" }] },
      groups: {
        content: [{ id: 3, name: "Engineering", path: "/Engineering" }],
      },
      compositeRealmRoles: [{ name: "ROLE_AUDITOR" }],
      compositeRoles: [{ id: 27, clientId: "reports", name: "EXPORT" }],
    }),
  );
  harness.setResponse(
    `${rolePath}/available-users?q=grace&page=0&size=10&sort=username,asc`,
    "GET",
    () => ({
      content: [{ id: 4, username: "grace" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}/users?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({
      users: {
        content: [
          { id: 1, username: "ada" },
          { id: 4, username: "grace" },
        ],
      },
    }),
  );
  harness.setResponse(
    `${rolePath}/available-realm-composites?q=ROLE&page=0&size=10&sort=name,asc`,
    "GET",
    () => ({
      content: [{ name: "ROLE_EDITOR" }, { name: "bad role" }],
      totalElements: 2,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}/realm-composites/ROLE_EDITOR?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({ compositeRealmRoles: [{ name: "ROLE_EDITOR" }] }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "roles");
    await settle();
    assert.ok(document.querySelector('[data-client-role-id="23"]'));
    document
      .querySelector(
        '[data-action="admin-client-role-assignments-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    let assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assert.ok(assignment);
    assignment.querySelector('[name="user-q"]').value = "g";
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-search"][data-member-kind="user"]',
      )
      .click();
    await settle();
    assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assert.ok(
      assignment.querySelector('[data-assignment-search-error="user"]')
        .textContent,
    );
    assignment.querySelector('[name="user-q"]').value = "grace";
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-search"][data-member-kind="user"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          `${rolePath}/available-users?q=grace&page=0&size=10&sort=username,asc`,
      ),
    );
    assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-add"][data-member-id="4"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${rolePath}/users?page=0&size=20&sort=username,asc` &&
          method === "POST" &&
          body.userId === 4,
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-role-composites-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    const composites = document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    assert.ok(composites);
    composites.querySelector('[name="realm-composite-q"]').value = "ROLE";
    composites
      .querySelector(
        '[data-action="admin-client-role-composite-search"][data-member-kind="realm"]',
      )
      .click();
    await settle();
    const updatedComposites = document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    assert.ok(updatedComposites.textContent.includes("ROLE_EDITOR"));
    assert.equal(updatedComposites.textContent.includes("bad role"), false);
    updatedComposites
      .querySelector('[data-action="admin-client-role-composite-add-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-add-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-add-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_EDITOR?page=0&size=20&sort=username,asc` &&
          method === "POST",
      ),
    );
    assert.ok(calls.some(({ path }) => path === "clear-all-sessions"));
  } finally {
    harness.restore();
  }
});
test("native Admin client roles validate edits and require confirmed deletion", async () => {
  const harness = await renderConsole("admin");
  let finishDelete;
  harness.setResponse(
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc",
    "GET",
    () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    "/api/admin/clients/console-client/roles/23",
    "PUT",
    ({ body }) => ({ id: 23, ...body }),
  );
  harness.setResponse(
    "/api/admin/clients/console-client/roles/23",
    "DELETE",
    () =>
      new Promise((resolve) => {
        finishDelete = () => resolve({ status: 204 });
      }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "roles");
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-edit"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-client-role-update"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "invalid role name";
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
          path === "/api/admin/clients/console-client/roles/23" &&
          method === "PUT",
      ),
      false,
      "invalid client role names must not reach the API",
    );
    form = document.querySelector('[data-form="admin-client-role-update"]');
    form.elements.namedItem("name").value = "REPORT_READER";
    form.elements.namedItem("description").value = "Read-only reports";
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
          path === "/api/admin/clients/console-client/roles/23" &&
          method === "PUT" &&
          body.name === "REPORT_READER" &&
          body.description === "Read-only reports",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-role-delete-request"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-client-role-delete-confirm"][data-client-role-id="23"]',
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-role-delete-cancel"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/clients/console-client/roles/23" &&
          method === "DELETE",
      ),
      false,
      "canceling role deletion must preserve the role",
    );
    document
      .querySelector(
        '[data-action="admin-client-role-delete-request"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-delete-confirm"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    const busyDelete = document.querySelector(
      '[data-action="admin-client-role-delete-confirm"][data-client-role-id="23"]',
    );
    assert.equal(busyDelete.disabled, true);
    assert.ok(busyDelete.querySelector(".spinner"));
    busyDelete.click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/clients/console-client/roles/23" &&
          method === "DELETE",
      ).length,
      1,
    );
    finishDelete();
    await settle();
    assert.equal(document.querySelector('[data-client-role-id="23"]'), null);
  } finally {
    harness.restore();
  }
});
test("native Admin client-role composite removal confirms before invalidating sessions", async () => {
  const harness = await renderConsole("admin");
  const rolePath = "/api/admin/clients/console-client/roles/23";
  harness.setResponse(
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc",
    "GET",
    () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}?page=0&size=20&sort=username,asc`,
    "GET",
    () => ({
      users: { content: [] },
      groups: { content: [] },
      compositeRealmRoles: [{ name: "ROLE_AUDITOR" }],
      compositeRoles: [],
    }),
  );
  harness.setResponse(
    `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc`,
    "DELETE",
    () => ({ compositeRealmRoles: [], compositeRoles: [] }),
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    await openClientTab(document, "roles");
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composites-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-request"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-request"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-confirm"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
    );
    assert.ok(calls.some(({ path }) => path === "clear-all-sessions"));
  } finally {
    harness.restore();
  }
});
test("native Admin message overrides edit, create, and delete localized messages", async () => {
  const harness = await renderConsole("admin");
  let overrides = [
    {
      id: 12,
      locale: "tr",
      bundle: "messages",
      messageKey: "welcome.message",
      messageValue: "Hoş geldiniz",
    },
  ];
  const messagePath = "/api/admin/settings/localization/messages";
  const page = () => ({
    content: overrides,
    totalElements: overrides.length,
    totalPages: 1,
    number: 0,
  });
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
    availableLocales: ["en", "tr"],
    availableBundles: ["messages"],
  }));
  harness.setResponse(
    `${messagePath}?page=0&size=20&sort=locale,asc`,
    "GET",
    page,
  );
  harness.setResponse(`${messagePath}/12`, "PUT", ({ body }) => {
    overrides = overrides.map((item) =>
      item.id === 12 ? { ...item, ...body } : item,
    );
    return { id: 12, ...body };
  });
  harness.setResponse(`${messagePath}/12`, "DELETE", () => {
    overrides = overrides.filter((item) => item.id !== 12);
    return { status: 204 };
  });
  harness.setResponse(messagePath, "POST", ({ body }) => {
    overrides = [...overrides, { id: 13, ...body }];
    return { id: 13, ...body };
  });
  try {
    const { calls, document } = harness;
    await openAdminSettingsTab(document, "localization");
    document.querySelector('[data-action="admin-settings-localization-tab"][data-tab="overrides"]').click();
    await settle();
    const edit = document.querySelector(
      '[data-form="admin-localization-message"]',
    );
    assert.ok(edit);
    edit.elements.namedItem("messageValue").value = "Merhaba";
    edit.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${messagePath}/12` &&
          method === "PUT" &&
          body.messageValue === "Merhaba",
      ),
    );
    document
      .querySelector('[data-action="admin-message-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${messagePath}/12` && method === "DELETE",
      ),
    );
    const create = document.querySelector(
      '[data-form="admin-localization-message-create"]',
    );
    create.elements.namedItem("locale").value = "tr";
    create.elements.namedItem("bundle").value = "messages";
    create.elements.namedItem("messageKey").value = "account.notice";
    create.elements.namedItem("messageValue").value = "Hesabınız hazır";
    create.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === messagePath &&
          method === "POST" &&
          body.messageKey === "account.notice",
      ),
    );
  } finally {
    harness.restore();
  }
});
