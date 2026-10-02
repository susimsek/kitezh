const enableDemoServiceAccount = () => {
  cy.loginAdmin("en");
  cy.visit("/admin/clients/demo-client/settings");
  cy.get('input[name="serviceAccountEnabled"]')
    .should("be.visible")
    .then(($toggle) => {
      if (!$toggle.is(":checked")) {
        cy.wrap($toggle).check();
      }
    });
  cy.intercept("PUT", "/api/admin/clients/demo-client").as("saveClient");
  cy.contains("button", "Save", { timeout: 15_000 }).click();
  cy.wait("@saveClient").its("response.statusCode").should("eq", 200);
  cy.contains("Client saved successfully.").should("be.visible");
};

describe("service-account roles", () => {
  afterEach(() => {
    cy.visitAdmin("/clients/demo-client/settings", "en");
    cy.get('input[name="serviceAccountEnabled"]').then(($toggle) => {
      if ($toggle.is(":checked")) {
        cy.intercept("PUT", "/api/admin/clients/demo-client").as("cleanupClient");
        cy.wrap($toggle).uncheck();
        cy.contains("button", "Save", { timeout: 15_000 }).click();
        cy.wait("@cleanupClient").its("response.statusCode").should("eq", 200);
      }
    });
  });

  it("opens the deep link, assigns application roles, and revokes tokens", () => {
    enableDemoServiceAccount();
    cy.intercept("GET", "/api/admin/clients/demo-client/service-account").as("serviceAccount");
    cy.intercept("GET", "/api/admin/clients/demo-client/roles*").as("clientRoles");
    cy.intercept("GET", "/api/admin/roles*").as("applicationRoles");
    cy.intercept("PUT", "/api/admin/clients/demo-client/service-account/roles").as("saveRoles");
    cy.intercept("POST", "/api/admin/clients/demo-client/service-account/revoke").as(
      "revokeTokens",
    );

    cy.visit("/admin/clients/demo-client/roles");
    cy.location("pathname").should("eq", "/admin/clients/demo-client/roles");
    cy.wait(["@serviceAccount", "@clientRoles", "@applicationRoles"]);
    cy.contains("h2", "Service-account roles").should("be.visible");
    cy.contains("h3", "Application roles").should("be.visible");
    cy.contains("h3", "Client roles").should("be.visible");

    cy.get('input[id="service-account-application-role-ROLE_ADMIN"]').check();
    cy.contains("button", "Save").click();
    cy.wait("@saveRoles")
      .its("request.body")
      .should("deep.equal", {
        roleIds: [],
        applicationRoles: ["ROLE_ADMIN"],
      });
    cy.contains("Client saved successfully.").should("be.visible");

    cy.contains("button", "Revoke tokens").click();
    cy.contains("Revoke all active tokens issued to this service account?").should("be.visible");
    cy.get(".modal").contains("button", "Revoke tokens").click();
    cy.wait("@revokeTokens").its("response.statusCode").should("eq", 204);
    cy.contains("Service-account tokens revoked successfully.").should("be.visible");
  });

  it("shows a global alert when service-account roles cannot be saved", () => {
    enableDemoServiceAccount();
    cy.intercept("GET", "/api/admin/clients/demo-client/service-account").as("serviceAccount");
    cy.intercept("GET", "/api/admin/clients/demo-client/roles*").as("clientRoles");
    cy.intercept("GET", "/api/admin/roles*").as("applicationRoles");
    cy.intercept("PUT", "/api/admin/clients/demo-client/service-account/roles", {
      statusCode: 500,
      body: {},
    }).as("saveRolesError");

    cy.visit("/admin/clients/demo-client/roles");
    cy.wait(["@serviceAccount", "@clientRoles", "@applicationRoles"]);
    cy.get('input[id="service-account-application-role-ROLE_ADMIN"]').check();
    cy.contains("button", "Save").click();
    cy.wait("@saveRolesError");
    cy.get(".console-global-alert").should(
      "contain.text",
      "Service-account roles could not be loaded.",
    );
    cy.contains("button", "Save").should("be.enabled");
  });
});
