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
};

describe("composite roles", () => {
  it("creates, assigns, and rejects a cyclic composite role graph", () => {
    const suffix = Date.now().toString();
    const parentRole = `ROLE_E2E_COMPOSITE_PARENT_${suffix}`;
    const childRole = `ROLE_E2E_COMPOSITE_CHILD_${suffix}`;

    signInAdmin();
    cy.contains(".admin-sidebar a", "Roles").click();

    [parentRole, childRole].forEach((roleName) => {
      cy.contains("a", "Create role").click();
      cy.location("pathname").should("eq", "/admin/roles/new");
      cy.get('input[name="name"]').type(roleName);
      cy.get('textarea[name="description"]').type("Chrome E2E composite role");
      cy.get('button[type="submit"]').click();
      cy.location("pathname", { timeout: 15_000 }).should(
        "eq",
        `/admin/roles/${encodeURIComponent(roleName)}/details`,
      );
      cy.contains("h1", roleName).should("be.visible");
      cy.contains(".admin-sidebar a", "Roles").click();
    });

    cy.visit(`/admin/roles/${encodeURIComponent(parentRole)}/users`);
    cy.intercept("GET", `/api/admin/roles/${encodeURIComponent(parentRole)}/available-users*`).as(
      "availableRoleUsers",
    );
    cy.get('input[aria-label="Search users"]').type("user");
    cy.wait("@availableRoleUsers");
    cy.get("#role-user-suggestions .list-group-item").should("have.length.at.least", 3);
    cy.get("#role-user-suggestions").contains("user2").should("be.visible");
    cy.get("#role-user-suggestions").contains("user3").should("be.visible");

    cy.visit(`/admin/roles/${encodeURIComponent(parentRole)}`);
    cy.intercept(
      "GET",
      `/api/admin/roles/${encodeURIComponent(parentRole)}/available-composites*`,
    ).as("availableCompositeRoles");
    cy.get("#role-composite-search").type(childRole);
    cy.wait("@availableCompositeRoles");
    cy.get("#role-composite-search").clear();
    cy.get("#role-composite-search")
      .closest(".position-relative")
      .find(".list-group")
      .should("not.exist");
    cy.get("#role-composite-search").type(childRole);
    cy.wait("@availableCompositeRoles");
    cy.contains(".list-group-item", childRole).click();
    cy.get("#role-composite-search")
      .closest(".position-relative")
      .contains("button", "Assign")
      .click();
    cy.contains("Composite child role added.").should("be.visible");
    cy.contains(".font-monospace", childRole).should("be.visible");

    cy.visit(`/admin/roles/${encodeURIComponent(childRole)}`);
    cy.intercept(
      "POST",
      `/api/admin/roles/${encodeURIComponent(childRole)}/composites/${encodeURIComponent(parentRole)}*`,
    ).as("cycleAttempt");
    cy.get("#role-composite-search").type(parentRole);
    cy.contains(".list-group-item", parentRole).click();
    cy.get("#role-composite-search")
      .closest(".position-relative")
      .contains("button", "Assign")
      .click();
    cy.wait("@cycleAttempt").its("response.statusCode").should("be.oneOf", [400, 409]);
    cy.contains("The role operation could not be completed.").should("be.visible");

    const clientRole = `client-composite-child-${suffix}`;
    cy.window().then((win) => {
      const tokens = JSON.parse(win.localStorage.getItem("AUTH_CONSOLE_TOKEN:admin") ?? "{}");
      cy.request({
        method: "POST",
        url: "/api/admin/clients/demo-client/roles",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        body: { name: clientRole, description: "Chrome E2E client composite role" },
      }).then(({ body }) => {
        cy.visit(`/admin/roles/${encodeURIComponent(parentRole)}`);
        cy.intercept(
          "GET",
          `/api/admin/roles/${encodeURIComponent(parentRole)}/available-client-composites*`,
        ).as("availableClientCompositeRoles");
        cy.get("#role-client-composite-search").type(clientRole);
        cy.wait("@availableClientCompositeRoles")
          .its("response.body.content")
          .should("have.length", 1);
        cy.contains(".list-group-item", `demo-client:${clientRole}`).should("be.visible");

        cy.request({
          method: "DELETE",
          url: `/api/admin/clients/demo-client/roles/${body.id}`,
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
      });
    });
  });
});
