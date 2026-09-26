describe("account console", () => {
  type StoredTokens = { accessToken: string };
  type ApplicationPage = { content: Array<{ clientId: string }> };

  const storedAccountTokens = () =>
    cy.window().then((window) => {
      const stored = window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account");
      if (!stored) throw new Error("Expected persisted account tokens");
      return JSON.parse(stored) as StoredTokens;
    });

  const signInAccount = () => {
    cy.visit("/account/");
    cy.env(["adminUsername", "adminPassword"], { log: false }).then(
      ({ adminUsername, adminPassword }) => {
        cy.get('input[name="username"]', { timeout: 15_000 })
          .should("be.visible")
          .type(String(adminUsername));
        cy.get('input[name="password"]').type(String(adminPassword), { log: false });
      },
    );
    cy.get('button[type="submit"]').click();
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
  };

  const signOut = () => {
    cy.get(".console-user-toggle").click();
    cy.contains(".console-user-menu .dropdown-item", /Sign out|Çıkış/).click();
    cy.get('input[name="username"]', { timeout: 20_000 }).should("be.visible");
  };

  const removeOtherSessions = () =>
    storedAccountTokens().then(({ accessToken }) => {
      cy.request({
        method: "DELETE",
        url: "/api/account/sessions/others",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .its("status")
        .should("eq", 204);
    });

  const createSecondBrowserSession = () => {
    signInAccount();
    removeOtherSessions();
    cy.clearCookies();
    cy.clearLocalStorage();
    signInAccount();
  };

  it("restores the browser SSO session after an immediate reload", () => {
    cy.visit("/account");
    cy.env(["adminUsername", "adminPassword"], { log: false }).then(
      ({ adminUsername, adminPassword }) => {
        cy.get('input[name="username"]', { timeout: 15_000 })
          .should("be.visible")
          .type(String(adminUsername));
        cy.get('input[name="password"]').type(String(adminPassword), { log: false });
      },
    );
    cy.get('button[type="submit"]').click();
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");

    cy.reload();

    cy.location("pathname", { timeout: 20_000 }).should(
      "match",
      /^\/account(?:\/personal-info)?\/?$/,
    );
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
    signOut();
  });

  it("signs in from /account, validates forms and keeps the callback URL clean", () => {
    cy.intercept("POST", "/oauth2/token").as("token");
    cy.intercept("GET", "/api/account/profile").as("profile");
    cy.intercept("PUT", "/api/account/profile").as("updateProfile");
    cy.visit("/account");
    cy.env(["adminUsername", "adminPassword"], { log: false }).then(
      ({ adminUsername, adminPassword }) => {
        cy.get('input[name="username"]', { timeout: 15_000 })
          .should("be.visible")
          .type(String(adminUsername));
        cy.get('input[name="password"]').type(String(adminPassword), { log: false });
      },
    );
    cy.get('button[type="submit"]').click();

    cy.wait("@token", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);
    cy.wait("@profile", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);

    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/account\/personal-info\/?$/);
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
    cy.get("#account-username").should("have.value", "admin");

    cy.get("#account-email").clear().type("not-an-email").blur();
    cy.get("#account-email").should("have.class", "is-invalid");
    cy.get("#account-email").clear().type("admin@example.test");
    cy.get("#account-first-name").clear().type("Admin");
    cy.get("#account-last-name").clear().type("User");
    cy.get('[data-cy="save-profile"]').click();
    cy.wait("@updateProfile").its("response.statusCode").should("eq", 200);
    cy.get('[data-cy="save-profile"]').should("be.disabled");

    cy.intercept("GET", "/api/account/webauthn/credentials*").as("passkeyCredentials");
    cy.contains("a", /Security|Güvenlik/).click();
    cy.wait("@passkeyCredentials").its("response.statusCode").should("eq", 200);
    cy.contains("h2", /Passkeys|Geçiş anahtarları/).should("be.visible");
    cy.get("#account-new-password").type("short").blur();
    cy.get("#account-new-password").should("have.class", "is-invalid");
    cy.get("#account-new-password").clear().type("temporary-password-1");
    cy.get("#account-confirm-password").type("different-password").blur();
    cy.get("#account-confirm-password").should("have.class", "is-invalid");

    cy.intercept("PUT", "/api/account/password", (request) => {
      request.reply({ delay: 300, statusCode: 204, body: null });
    }).as("changePassword");
    cy.get("#account-current-password").type("admin", { log: false });
    cy.get("#account-new-password").clear().type("temporary-password-1", { log: false });
    cy.get("#account-confirm-password").clear().type("temporary-password-1", { log: false });
    cy.get('[data-cy="save-password"]').click();
    cy.get('[data-cy="save-password"]')
      .should("be.disabled")
      .find(".spinner-border")
      .should("exist");
    cy.wait("@changePassword").its("response.statusCode").should("eq", 204);

    cy.contains("a", /Device activity|Cihaz etkinliği/).click();
    cy.get('[data-cy="session-row"]', { timeout: 10_000 }).should("have.length.at.least", 1);

    cy.contains("a", /Applications|Uygulamalar/).click();
    cy.location("pathname").should("match", /^\/account\/applications\/?$/);

    cy.get("@token.all").then((exchangesBeforeReload) => {
      cy.wrap(exchangesBeforeReload.length).as("exchangesBeforeReload");
    });
    cy.reload();
    cy.wait("@profile", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);
    cy.get("@token.all").then((exchangesAfterReload) => {
      cy.get<number>("@exchangesBeforeReload").should("eq", exchangesAfterReload.length);
    });
    cy.location("search", { timeout: 20_000 }).should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
    signOut();
  });

  it("updates and removes the account avatar", () => {
    cy.intercept("GET", "/api/account/profile/avatar").as("avatar");
    cy.intercept("PUT", "/api/account/profile/avatar").as("updateAvatar");
    cy.intercept("DELETE", "/api/account/profile/avatar").as("deleteAvatar");
    signInAccount();
    cy.wait("@avatar").its("response.statusCode").should("eq", 200);

    cy.get('input[type="file"][accept="image/jpeg,image/png"]').selectFile(
      "cypress/fixtures/avatar.png",
      { force: true },
    );
    cy.wait("@updateAvatar").its("response.statusCode").should("eq", 200);

    cy.contains("button", /Remove avatar|Avatarı kaldır/).click();
    cy.get(".modal")
      .contains("button", /Remove avatar|Avatarı kaldır/)
      .click();
    cy.wait("@deleteAvatar").its("response.statusCode").should("eq", 204);
    signOut();
  });

  it("signs out one selected browser session", () => {
    cy.intercept("DELETE", /\/api\/account\/sessions\/[^/]+$/).as("deleteSession");
    createSecondBrowserSession();
    cy.visit("/account/sessions/");
    cy.get('[data-cy="session-row"]', { timeout: 20_000 }).should("have.length", 2);

    cy.get('[data-cy="session-row"]:not(.current)')
      .should("have.length", 1)
      .contains("button", /Sign out|Çıkış/)
      .click();
    cy.get(".modal")
      .contains("button", /Sign out|Çıkış/)
      .click();
    cy.wait("@deleteSession").its("response.statusCode").should("eq", 204);
    cy.get('[data-cy="session-row"]', { timeout: 20_000 }).should("have.length", 1);
    signOut();
  });

  it("signs out every other browser session", () => {
    cy.intercept("DELETE", "/api/account/sessions/others").as("deleteOthers");
    createSecondBrowserSession();
    cy.visit("/account/sessions/");
    cy.get('[data-cy="session-row"]', { timeout: 20_000 }).should("have.length", 2);

    cy.get('[data-cy="sign-out-others"]').click();
    cy.get(".modal")
      .contains("button", /Sign out other sessions|Diğer oturumları kapat/)
      .click();
    cy.wait("@deleteOthers").its("response.statusCode").should("eq", 204);
    cy.get('[data-cy="session-row"]', { timeout: 20_000 }).should("have.length", 1);
    signOut();
  });

  it("signs out all browser sessions and clears browser tokens", () => {
    signInAccount();
    removeOtherSessions();
    cy.intercept("DELETE", "/api/account/sessions/others").as("deleteOthers");
    cy.visit("/account/sessions/");
    cy.get('[data-cy="session-row"]', { timeout: 20_000 }).should("have.length", 1);

    cy.contains("button", /Sign out all sessions|Tüm oturumları kapat/).click();
    cy.get(".modal")
      .contains("button", /Sign out all sessions|Tüm oturumları kapat/)
      .click();
    cy.wait("@deleteOthers").its("response.statusCode").should("eq", 204);
    cy.get('input[name="username"]', { timeout: 20_000 }).should("be.visible");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).to.equal(null);
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account")).to.equal(null);
    });
    cy.request({ url: "/oidc/session-status", failOnStatusCode: false })
      .its("status")
      .should("eq", 401);
  });

  it("creates and revokes an application consent", () => {
    signInAccount();
    removeOtherSessions();
    storedAccountTokens().then(({ accessToken }) => {
      cy.request<ApplicationPage>({
        url: "/api/account/applications?size=100",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(({ body }) => {
        if (body.content.some(({ clientId }) => clientId === "demo-client")) {
          cy.request({
            method: "DELETE",
            url: "/api/account/applications/demo-client",
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .its("status")
            .should("eq", 204);
        }
      });
    });

    cy.intercept("GET", "http://127.0.0.1:8081/**", {
      statusCode: 200,
      body: "Authorization received",
    }).as("demoRedirect");
    cy.visit(
      "/oauth2/authorize?response_type=code&client_id=demo-client&redirect_uri=" +
        encodeURIComponent("http://127.0.0.1:8081/login/oauth2/code/demo-client") +
        "&scope=openid%20profile&state=e2e-consent&ui_locales=en",
    );
    cy.location("pathname", { timeout: 20_000 }).should("eq", "/consent");
    cy.contains("button", "Allow access", { timeout: 20_000 }).click();
    cy.wait("@demoRedirect", { timeout: 20_000 });

    cy.visit("/account/applications/");
    cy.get('[data-cy="application-row"]', { timeout: 20_000 })
      .contains("Demo Client")
      .should("be.visible");
    cy.intercept("DELETE", "/api/account/applications/demo-client").as("revokeApplication");
    cy.get('[data-cy="application-row"]')
      .contains("Demo Client")
      .parents('[data-cy="application-row"]')
      .contains("button", /Revoke access|Erişimi kaldır/)
      .click();
    cy.get(".modal")
      .contains("button", /Revoke access|Erişimi kaldır/)
      .click();
    cy.wait("@revokeApplication").its("response.statusCode").should("eq", 204);
    cy.contains('[data-cy="application-row"]', "Demo Client").should("not.exist");
    signOut();
  });

  it("rejects an Account callback without a saved authorization transaction", () => {
    cy.visit("/account/callback#code=stale-code&state=stale-state");

    cy.location("pathname").should("eq", "/account/callback");
    cy.location("hash").should("eq", "");
    cy.contains("The account session could not be established.").should("be.visible");
  });
});
