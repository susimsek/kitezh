const signInAdmin = () => {
  cy.visit("/");
  cy.setCookie("locale", "en");
  cy.visit("/admin/");

  cy.env(["adminUsername", "adminPassword"], { log: false }).then(
    ({ adminUsername, adminPassword }) => {
      cy.get('input[name="username"]', { timeout: 15_000 })
        .should("be.visible")
        .type(String(adminUsername));
      cy.get('input[name="password"]').type(String(adminPassword), { log: false });
      cy.get('button[type="submit"]').click();
    },
  );

  cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
  cy.contains("h1", "Dashboard", { timeout: 20_000 }).should("be.visible");
  cy.get(".admin-sidebar").should("exist");
};

describe("admin console", () => {
  it("signs in from /admin, keeps the callback URL clean and survives reload", () => {
    cy.visit("/");
    cy.setCookie("locale", "en");
    cy.visit("/admin");

    cy.env(["adminUsername", "adminPassword"], { log: false }).then(
      ({ adminUsername, adminPassword }) => {
        cy.get('input[name="username"]', { timeout: 15_000 })
          .should("be.visible")
          .type(String(adminUsername));
        cy.get('input[name="password"]').type(String(adminPassword), { log: false });
      },
    );

    cy.get('button[type="submit"]').click();

    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");

    cy.reload();

    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
  });

  it("opens every existing admin console resource page", () => {
    const pages = [
      ["/clients", "Clients"],
      ["/users", "Users"],
      ["/roles", "Roles"],
      ["/groups", "Groups"],
      ["/sessions", "Sessions"],
      ["/consents", "Consents"],
      ["/keys", "Keys"],
      ["/events", "Events"],
    ] as const;

    signInAdmin();
    cy.contains("h1", "Dashboard").should("be.visible");

    pages.forEach(([path, label]) => {
      cy.contains(".admin-sidebar a", label).click();
      cy.location("pathname", { timeout: 15_000 }).should("match", new RegExp(`^/admin${path}/?$`));
      cy.contains("h1", label, { timeout: 15_000 }).should("be.visible");
    });
  });

  it("updates event settings and clears audit events", () => {
    signInAdmin();
    cy.intercept("GET", "/api/admin/events/config").as("eventSettings");
    cy.intercept("PUT", "/api/admin/events/config").as("saveEventSettings");
    cy.intercept("DELETE", "/api/admin/events").as("clearEvents");
    cy.contains(".admin-sidebar a", "Settings").click();
    cy.contains(".admin-detail-tabs a", "Events").click();
    cy.wait("@eventSettings");
    cy.contains("button", "Save event settings", { timeout: 15_000 }).should("be.visible").click();
    cy.wait("@saveEventSettings");
    cy.contains("Event settings saved.").should("be.visible");
    cy.contains(".admin-sidebar a", "Events").click();
    cy.contains("button", "Clear all events").click();
    cy.contains("Clear all stored administrative events?").should("be.visible");
    cy.get(".modal").contains("button", "Clear all events").click();
    cy.wait("@clearEvents");
  });

  it("shows an error when event settings cannot be saved", () => {
    signInAdmin();
    cy.intercept("GET", "/api/admin/events/config").as("eventSettings");
    cy.intercept("PUT", "/api/admin/events/config", { statusCode: 500 }).as(
      "saveEventSettingsError",
    );
    cy.contains(".admin-sidebar a", "Settings").click();
    cy.contains(".admin-detail-tabs a", "Events").click();
    cy.wait("@eventSettings");
    cy.contains("button", "Save event settings", { timeout: 15_000 }).should("be.visible").click();
    cy.wait("@saveEventSettingsError");
    cy.contains("Event settings could not be loaded or saved.").should("be.visible");
  });

  it("opens each settings section with its own route and save action", () => {
    const sections = [
      ["General", "/admin/settings", null],
      ["Login", "/admin/settings/login", "Save settings"],
      ["Email", "/admin/settings/email", "Save email settings"],
      ["Brute force", "/admin/settings/brute-force", "Save settings"],
      ["Sessions", "/admin/settings/sessions", "Save settings"],
      ["Events", "/admin/settings/events", "Save event settings"],
    ] as const;

    signInAdmin();
    cy.contains(".admin-sidebar a", "Settings").click();
    cy.location("pathname").should("match", /^\/admin\/settings\/?$/);

    sections.forEach(([label, path, saveLabel]) => {
      cy.contains(".admin-detail-tabs a", label).click();
      cy.location("pathname", { timeout: 15_000 }).should("eq", path);
      cy.get(".admin-detail-tabs a.active").should("contain.text", label);
      if (saveLabel) {
        const sectionKey = path.split("/").pop();
        const loginSettingsSections = ["login", "brute-force", "sessions"];
        if (sectionKey && loginSettingsSections.includes(sectionKey)) {
          cy.get(`#login-settings-${sectionKey}`)
            .closest("section")
            .contains("button", saveLabel, { timeout: 15_000 })
            .should("be.visible");
        } else {
          cy.contains("button", saveLabel, { timeout: 15_000 }).should("be.visible");
        }
      }
      if (label === "Email") {
        cy.get("#email-from-address").clear().type("admin@example.com");
        cy.get("#email-username").clear();
        cy.get("#email-host").clear().type("smtp.example.com");
        cy.get("#email-base-url").clear().type("http://localhost:9090");
        cy.intercept("POST", "/api/admin/settings/email/test", { statusCode: 204 }).as(
          "testEmailConnection",
        );
        cy.contains("button", "Test connection", { timeout: 15_000 }).should("be.visible").click();
        cy.wait("@testEmailConnection");
        cy.contains("Test email sent successfully.").should("be.visible");
      }
    });
  });

  it("opens authentication policies under their own navigation", () => {
    signInAdmin();
    cy.contains(".admin-sidebar a", "Authentication").click();
    cy.location("pathname").should("match", /^\/admin\/authentication\/?$/);
    cy.contains(".admin-detail-tabs a", "OTP policy").click();
    cy.location("pathname").should("eq", "/admin/authentication/policies/otp-policy");
    cy.get("#login-settings-otp-policy")
      .closest("section")
      .contains("button", "Save settings", { timeout: 15_000 })
      .should("be.visible");
    cy.contains(".admin-detail-tabs a", "WebAuthn policy").click();
    cy.location("pathname").should("eq", "/admin/authentication/policies/webauthn");
  });

  it("opens the create forms and validates required fields", () => {
    signInAdmin();

    cy.contains(".admin-sidebar a", "Clients").click();
    cy.contains("a", "Create client").click();
    cy.location("pathname").should("match", /^\/admin\/clients\/new\/?$/);
    cy.contains("button", "Next").click();
    cy.contains("button", "Next").click();
    cy.get('button[type="submit"]').click();
    cy.get(".invalid-feedback:visible").should("have.length.greaterThan", 0);

    cy.contains(".admin-sidebar a", "Users").click();
    cy.contains("a", "Create user").click();
    cy.location("pathname").should("match", /^\/admin\/users\/new\/?$/);
    cy.get('input[name="username"]').clear();
    cy.get('input[name="password"]').clear();
    cy.get('button[type="submit"]').click();
    cy.get(".invalid-feedback:visible").should("have.length.greaterThan", 0);
  });

  it("opens existing client and user detail/edit pages", () => {
    signInAdmin();

    cy.visit("/admin/clients/demo-client/settings");
    cy.location("pathname").should("eq", "/admin/clients/demo-client/settings");

    cy.contains(".admin-sidebar a", "Users").click();
    cy.get("tbody tr", { timeout: 15_000 }).first().find('button[aria-label$=" actions"]').click();
    cy.get(".dropdown-menu.show").contains("a", "Edit").click();
    cy.location("pathname").should("match", /^\/admin\/users\/[^/]+\/details\/?$/);
    cy.contains("Created at", { timeout: 15_000 }).should("be.visible");
    cy.contains("Updated at", { timeout: 15_000 }).should("be.visible");
    cy.get('input[name="firstName"]').should("exist");
    cy.get('input[name="lastName"]').should("exist");
    cy.contains("a", "Credentials").click();
    cy.contains("Required actions", { timeout: 15_000 }).should("be.visible");
    cy.contains("Temporary password").should("be.visible");
    cy.contains(".admin-detail-tabs a", "Sessions").click();
    cy.contains("button", "Sign out all sessions", { timeout: 15_000 }).should("be.visible");
  });

  it("opens the client capability, mapper, credential and scope-evaluation flows", () => {
    signInAdmin();

    cy.visit("/admin/clients/demo-client/settings");
    cy.location("pathname").should("eq", "/admin/clients/demo-client/settings");
    cy.contains("Client enabled", { timeout: 15_000 }).should("be.visible");
    cy.contains("private_key_jwt").should("be.visible");
    cy.contains("tls_client_auth").should("be.visible");
    cy.contains("Root URL").should("be.visible");
    cy.contains("Front-channel logout").should("be.visible");
    cy.contains("Back-channel logout").should("be.visible");

    cy.contains(".admin-detail-tabs a", "Credentials").click();
    cy.contains("Client secret", { timeout: 15_000 }).should("be.visible");
    cy.contains("button", "Regenerate secret").should("be.visible");

    cy.contains(".admin-detail-tabs a", "Protocol mappers").click();
    cy.location("pathname").should("match", /^\/admin\/clients\/[^/]+\/mappers\/?$/);
    cy.contains("Create mapper", { timeout: 15_000 }).should("be.visible");
    cy.contains("user-property").should("be.visible");
    cy.contains("hardcoded-claim").should("be.visible");

    cy.intercept("GET", "/api/admin/clients/*/scope-evaluation*").as("scopeEvaluation");
    cy.contains(".admin-detail-tabs a", "Scope evaluation").click();
    cy.location("pathname").should("match", /^\/admin\/clients\/[^/]+\/evaluation\/?$/);
    cy.get('input[placeholder="openid profile"]').type("openid profile");
    cy.get('input[placeholder="user"]').type("user");
    cy.contains("button", "Evaluate").click();
    cy.wait("@scopeEvaluation").its("response.statusCode").should("eq", 200);
    cy.contains("Effective scopes", { timeout: 15_000 }).should("be.visible");
  });

  it("rejects a callback without a saved authorization transaction", () => {
    cy.visit("/");
    cy.setCookie("locale", "en");
    cy.visit("/admin/callback#code=stale-code&state=stale-state");

    cy.location("pathname", { timeout: 20_000 }).should("eq", "/admin/callback");
    cy.location("hash").should("eq", "");
    cy.contains("The administration session could not be established.").should("be.visible");
  });

  it("opens and closes the responsive navigation", () => {
    cy.viewport(390, 844);
    signInAdmin();

    cy.get('button[aria-label="Toggle navigation"]').click();
    cy.get(".admin-sidebar").should("have.class", "is-open");
    cy.get(".admin-sidebar-backdrop").should("be.visible").click({ force: true });
    cy.get(".admin-sidebar").should("not.have.class", "is-open");
  });
});
