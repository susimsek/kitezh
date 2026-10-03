describe("admin login", () => {
  type ConsoleKind = "admin" | "account";
  type StoredTokens = {
    accessToken: string;
    expiresAt: number;
    idToken?: string;
    refreshToken: string;
  };
  type SessionPage = {
    content: Array<{ id: string }>;
    totalElements: number;
  };

  const decodeJwt = (token: string) => {
    const payload = token.split(".")[1];
    if (!payload) throw new Error("Expected a JWT access token");
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(Cypress.Buffer.from(base64, "base64").toString("utf8")) as {
      sid?: string;
    };
  };

  const storedTokens = (consoleKind: ConsoleKind) =>
    cy.window().then((window) => {
      const stored = window.localStorage.getItem(`AUTH_CONSOLE_TOKEN:${consoleKind}`);
      if (!stored) throw new Error(`Expected persisted ${consoleKind} tokens`);
      return JSON.parse(stored) as StoredTokens;
    });

  const signIn = (
    startPath: string,
    usernameKey = "adminUsername",
    passwordKey = "adminPassword",
  ) => {
    cy.visit(startPath);
    cy.env([usernameKey, passwordKey], { log: false }).then((credentials) => {
      cy.get('input[name="username"]', { timeout: 15_000 })
        .should("be.visible")
        .type(String(credentials[usernameKey]));
      cy.get('input[name="password"]').type(String(credentials[passwordKey]), { log: false });
    });
    cy.get('button[type="submit"]').click();
  };

  const signOut = () => {
    cy.get(".console-user-toggle").click();
    cy.contains(".console-user-menu .dropdown-item", /Sign out|Çıkış/).click();
    cy.get('input[name="username"]', { timeout: 20_000 }).should("be.visible");
  };

  const sessionCount = () =>
    storedTokens("admin").then(({ accessToken }) => {
      return cy
        .request({
          headers: { Authorization: `Bearer ${accessToken}` },
          url: "/api/admin/sessions?size=100&status=active",
        })
        .its("body.totalElements");
    });

  const oidcSessionId = async (sessionId: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
    return Cypress.Buffer.from(new Uint8Array(digest))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const currentJpaSession = () =>
    storedTokens("admin").then(({ accessToken }) => {
      const currentOidcSessionId = decodeJwt(accessToken).sid;
      expect(currentOidcSessionId).to.be.a("string");
      expect(currentOidcSessionId).to.have.length.greaterThan(0);
      return cy
        .request<SessionPage>({
          headers: { Authorization: `Bearer ${accessToken}` },
          url: "/api/admin/sessions?size=100&status=active",
        })
        .then(async ({ body }) => {
          const sessions = await Promise.all(
            body.content.map(async (session) => ({
              ...session,
              oidcSessionId: await oidcSessionId(session.id),
            })),
          );
          const current = sessions.find(
            (session) => session.oidcSessionId === currentOidcSessionId,
          );
          expect(current, "JPA session matching the access-token sid").not.to.equal(undefined);
          return {
            accessToken,
            id: current?.id ?? "",
            oidcSessionId: currentOidcSessionId as string,
            sessions,
          };
        });
    });

  const removeSessionsExceptCurrent = () =>
    currentJpaSession().then(({ accessToken, oidcSessionId: currentOidcSessionId, sessions }) => {
      sessions
        .filter(({ oidcSessionId: candidate }) => candidate !== currentOidcSessionId)
        .forEach(({ id }) => {
          cy.request({
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
            url: `/api/admin/sessions/${encodeURIComponent(id)}`,
          })
            .its("status")
            .should("eq", 204);
        });
      return cy.wrap(currentOidcSessionId);
    });

  const expireStoredAccessToken = (consoleKind: ConsoleKind) => {
    cy.window().then((window) => {
      const key = `AUTH_CONSOLE_TOKEN:${consoleKind}`;
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}") as StoredTokens;
      stored.expiresAt = 0;
      window.localStorage.setItem(key, JSON.stringify(stored));
    });
  };

  beforeEach(() => {
    cy.visit("/");
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.setCookie("locale", "en");
  });

  it("signs in from /admin and keeps the URL clean after reload", () => {
    cy.intercept("GET", "/account/avatar").as("privateAvatar");
    cy.intercept("POST", "/oauth2/token").as("tokenExchange");
    cy.intercept("GET", "/api/admin/whoami").as("whoami");
    signIn("/admin");

    cy.wait("@tokenExchange", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);
    cy.wait("@whoami", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);

    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
    cy.get(".console-user-avatar-image", { timeout: 20_000 })
      .should("be.visible")
      .and("have.attr", "src")
      .and("include", "/avatars/");
    removeSessionsExceptCurrent();
    sessionCount().should("eq", 1);
    cy.get("@tokenExchange.all").then((requests) => {
      cy.wrap(requests.length).as("exchangesBeforeReload");
    });

    cy.reload();

    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
    cy.location("search").should("eq", "");
    cy.location("hash").should("eq", "");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
    cy.get("@privateAvatar.all").should("have.length", 0);
    cy.get("@tokenExchange.all").then((requests) => {
      cy.get<number>("@exchangesBeforeReload").should("eq", requests.length);
    });
    sessionCount().should("eq", 1);
    signOut();
  });

  it("reuses one browser session for Admin and Account, then clears both token sets on logout", () => {
    cy.intercept("POST", "/oauth2/token").as("tokenExchange");
    signIn("/admin/");

    cy.wait("@tokenExchange", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);
    removeSessionsExceptCurrent().as("adminSessionId");
    sessionCount().should("eq", 1);
    storedTokens("admin").then(({ refreshToken }) => {
      expect(refreshToken).to.be.a("string");
      expect(refreshToken).to.have.length.greaterThan(0);
    });

    cy.get(".console-user-toggle").click();
    cy.contains(".console-user-menu a", /Account Console|Hesap Konsolu/).click();

    cy.wait("@tokenExchange", { timeout: 20_000 }).its("response.statusCode").should("eq", 200);
    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/account\/personal-info\/?$/);
    cy.get('input[name="username"]').should("not.exist");
    storedTokens("admin").then((admin) => {
      storedTokens("account").then((account) => {
        const adminSessionId = decodeJwt(admin.accessToken).sid;
        const accountSessionId = decodeJwt(account.accessToken).sid;
        expect(adminSessionId).to.equal(accountSessionId);
        cy.get<string>("@adminSessionId").should("eq", accountSessionId);
      });
      expect(admin.refreshToken).to.be.a("string");
      expect(admin.refreshToken).to.have.length.greaterThan(0);
      storedTokens("account").then((account) => {
        expect(account.refreshToken).to.be.a("string");
        expect(account.refreshToken).to.have.length.greaterThan(0);
        expect(account.refreshToken).not.to.equal(admin.refreshToken);
      });
    });
    sessionCount().should("eq", 1);

    signOut();
    cy.window().then((window) => {
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).to.equal(null);
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account")).to.equal(null);
    });
    cy.request({ url: "/oidc/session-status", failOnStatusCode: false })
      .its("status")
      .should("eq", 401);
  });

  it("rotates the refresh token and rejects the previous token", () => {
    cy.intercept("POST", "/oauth2/token", (request) => {
      if (String(request.body).includes("grant_type=refresh_token")) request.alias = "refresh";
    });
    signIn("/admin/");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
    removeSessionsExceptCurrent();

    storedTokens("admin").then(({ refreshToken: previousRefreshToken }) => {
      expireStoredAccessToken("admin");
      cy.reload();
      cy.wait("@refresh", { timeout: 20_000 }).then(({ request, response }) => {
        expect(String(request.body)).to.include("client_id=admin-console");
        expect(response?.statusCode).to.equal(200);
      });
      cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
      storedTokens("admin").then(({ refreshToken }) => {
        expect(refreshToken).not.to.equal(previousRefreshToken);
      });
      cy.request({
        method: "POST",
        url: "/oauth2/token",
        form: true,
        failOnStatusCode: false,
        body: {
          client_id: "admin-console",
          grant_type: "refresh_token",
          refresh_token: previousRefreshToken,
        },
      }).then((response) => {
        expect(response.status).to.equal(400);
        expect(response.body.error).to.equal("invalid_grant");
      });
    });
    sessionCount().should("eq", 1);
    signOut();
  });

  it("clears permanent refresh failures and returns to form login", () => {
    cy.intercept("POST", "/oauth2/token", (request) => {
      if (String(request.body).includes("grant_type=refresh_token")) request.alias = "refresh";
    });
    signIn("/admin/");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
    removeSessionsExceptCurrent();

    currentJpaSession().then(({ accessToken, id }) => {
      cy.request({
        method: "DELETE",
        url: `/api/admin/sessions/${encodeURIComponent(id)}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .its("status")
        .should("eq", 204);
    });
    expireStoredAccessToken("admin");
    cy.reload();
    cy.wait("@refresh", { timeout: 20_000 }).its("response.statusCode").should("eq", 400);
    cy.get('input[name="username"]', { timeout: 20_000 }).should("be.visible");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).to.equal(null);
    });
  });

  it("allows a regular user into Account Console but denies Admin Console", () => {
    signIn("/account/", "userUsername", "userPassword");
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");

    cy.visit("/admin/");
    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/auth-error\/?$/);
    cy.location("search").should("eq", "?type=access_denied");
    cy.get(".admin-sidebar").should("not.exist");

    cy.visit("/account/");
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
    signOut();
  });

  it("clears both console token sets when logout starts from Admin Console", () => {
    signIn("/admin/");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
    removeSessionsExceptCurrent();
    cy.get(".console-user-toggle").click();
    cy.contains(".console-user-menu a", /Account Console|Hesap Konsolu/).click();
    cy.get(".account-sidebar", { timeout: 20_000 }).should("be.visible");
    cy.visit("/admin/");
    cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");

    signOut();
    cy.window().then((window) => {
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).to.equal(null);
      expect(window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account")).to.equal(null);
    });
    cy.request({ url: "/oidc/session-status", failOnStatusCode: false })
      .its("status")
      .should("eq", 401);
  });

  it("rejects a callback without a saved authorization transaction", () => {
    cy.visit("/admin/callback#code=stale-code&state=stale-state");

    cy.location("pathname").should("eq", "/admin/callback");
    cy.location("hash").should("eq", "");
    cy.contains("The administration session could not be established.").should("be.visible");
  });

  it("keeps Turkish login and logout cookie-localized without URL prefixes", () => {
    cy.setCookie("locale", "tr");
    signIn("/admin/");
    cy.location("pathname", { timeout: 20_000 }).should("match", /^\/admin\/?$/);
    cy.contains("h1", "Genel Bakış", { timeout: 20_000 }).should("be.visible");
    signOut();
    cy.location("pathname").should("eq", "/login");
    cy.location("search").should("eq", "");
  });
});
