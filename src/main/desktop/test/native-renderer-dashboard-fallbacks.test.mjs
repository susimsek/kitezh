import assert from "node:assert/strict";
import test from "node:test";

import { renderConsole, settle } from "./native-renderer-harness.mjs";

const scenarios = [
  {
    name: "degraded services and invalid counters",
    dashboard: { clients: -1, users: "4", sessions: 2.5, consents: 0 },
    events: { status: 503, kind: "http", body: null },
    serverInfo: { status: 503, kind: "http", body: null },
    readiness: { status: 503, kind: "http", body: null },
    expectedStats: ["—", "—", "—", "0"],
    expectedHealth: "DOWN",
    expectedIssuer: "—",
    expectedEvents: "adminNoRecentEvents",
    expectedKey: true,
  },
  {
    name: "healthy service with malformed event content and no signing key",
    dashboard: { clients: 0, users: 3, sessions: 1, consents: 2 },
    events: { content: { malformed: true } },
    serverInfo: { issuer: "https://issuer.example.test" },
    readiness: { status: 200, body: { status: "UP" } },
    expectedStats: ["0", "3", "1", "2"],
    expectedHealth: "UP",
    expectedIssuer: "issuer.example.test",
    expectedEvents: "adminNoRecentEvents",
    expectedKey: true,
  },
];

for (const scenario of scenarios) {
  test(`native Admin dashboard shows safe fallbacks for ${scenario.name}`, async () => {
    const harness = await renderConsole("admin");
    harness.setResponse("/api/admin/dashboard", "GET", () => scenario.dashboard);
    harness.setResponse(
      "/api/admin/events?size=6&sort=occurredAt,desc",
      "GET",
      () => scenario.events,
    );
    harness.setResponse("/api/admin/server-info", "GET", () => scenario.serverInfo);
    harness.setResponse("/actuator/health/readiness", "GET", () => scenario.readiness);

    try {
      harness.document.querySelector('[data-route="dashboard"]').click();
      await settle();
      const { document } = harness;
      assert.deepEqual(
        [...document.querySelectorAll(".stat-value")].map((node) => node.textContent),
        scenario.expectedStats,
      );
      assert.match(document.querySelector('[role="status"]').textContent, new RegExp(scenario.expectedHealth));
      assert.match(document.querySelector(".issuer-value").textContent, new RegExp(scenario.expectedIssuer));
      assert.match(document.querySelector(".dashboard-event-list").textContent, new RegExp(scenario.expectedEvents));
      if (scenario.expectedKey)
        assert.ok(document.querySelector(".dashboard-panel .empty-value"));
    } finally {
      harness.restore();
    }
  });
}
