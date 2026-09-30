const signInAdmin = () => {
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
  cy.get(".admin-sidebar", { timeout: 20_000 }).should("be.visible");
};

describe("Admin REST browser demonstration", () => {
  beforeEach(() => {
    cy.setCookie("locale", "en");
  });

  it("shows admin and user event history with filters", () => {
    signInAdmin();
    cy.contains(".admin-sidebar a", "Events").click();
    cy.location("pathname").should("eq", "/admin/events");
    cy.contains("h1", "Events").should("be.visible");
    cy.contains("a", "Admin events").should("be.visible");
    cy.contains("a", "User events").click();
    cy.location("pathname").should("eq", "/admin/events/user");
    cy.contains("h1", "User events").should("be.visible");
    cy.contains("button", "Filter user events").should("be.visible").click();
    cy.get('input[aria-label="Username"]').should("be.visible");
    cy.get('input[aria-label="Client ID"]').should("be.visible");
    cy.get('input[aria-label="IP address"]').should("be.visible");
    cy.screenshot("admin-user-events");
  });

  it("shows event settings, event type selection, and listener management", () => {
    signInAdmin();
    cy.contains(".admin-sidebar a", "Settings").click();
    cy.contains(".admin-detail-tabs a", "Events").click();
    cy.location("pathname").should("eq", "/admin/settings/events");
    cy.contains("h2", "Event settings").should("be.visible");
    cy.contains("h2", "User event settings").should("be.visible");
    cy.contains("Successful login").should("be.visible");
    cy.contains("Failed login").should("be.visible");
    cy.contains("h2", "Event listeners").scrollIntoView().should("be.visible");
    cy.contains("Event listeners").should("be.visible");
    cy.contains("button", "Add listener").should("be.visible");
    cy.screenshot("admin-event-settings-listeners");
  });
});
