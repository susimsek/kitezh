import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native Admin events combine advanced filters, pagination and filter reset", async () => {
  const harness = await renderConsole("admin");
  const pageZero = "/api/admin/events?page=0&size=10&sort=occurredAt%2Cdesc";
  const pageTwo = "/api/admin/events?page=2&size=10&sort=occurredAt%2Cdesc";
  harness.setResponse(pageZero, "GET", () => ({
    content: Array.from({ length: 10 }, (_, index) => ({
      id: `event-${index}`,
      action: "user.updated",
      actor: "admin",
      targetType: "user",
      targetId: String(index + 1),
      occurredAt: "2026-10-12T08:30:00Z",
    })),
    totalElements: 26,
    totalPages: 3,
    number: 0,
  }));
  harness.setResponse(pageTwo, "GET", () => ({
    content: [{
      id: "event-last",
      action: "user.updated",
      actor: "admin",
      targetType: "user",
      targetId: "26",
      occurredAt: "2026-10-12T08:30:00Z",
    }],
    totalElements: 26,
    totalPages: 3,
    number: 2,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="events"]').click();
    await settle();
    assert.match(document.querySelector(".admin-session-page-indicator").textContent.trim(), /1 \/ 3$/);

    document.querySelector('[data-admin-event-page="2"]').click();
    await settle();
    assert.match(document.querySelector(".admin-session-page-indicator").textContent.trim(), /3 \/ 3$/);
    assert.match(document.querySelector(".admin-event-table").textContent, /event-last|26/);
    assert.ok(calls.some(({ path }) => path === pageTwo));

    document.querySelector('[data-action="admin-event-filter-toggle"]').click();
    await settle();
    const form = document.getElementById("admin-event-search");
    form.elements.namedItem("q").value = " password.reset ";
    form.elements.namedItem("action").value = "user.updated";
    form.elements.namedItem("targetType").value = "user";
    form.elements.namedItem("targetId").value = " 42 ";
    form.elements.namedItem("from").value = "2026-10-01";
    form.elements.namedItem("to").value = "2026-10-18";
    form.dispatchEvent(new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await settle();

    const filteredRequest = calls
      .filter(({ path }) => path.startsWith("/api/admin/events?"))
      .at(-1);
    const params = new URL(filteredRequest.path, "http://local").searchParams;
    assert.equal(params.get("page"), "0");
    assert.equal(params.get("q"), "password.reset");
    assert.equal(params.get("action"), "user.updated");
    assert.equal(params.get("targetType"), "user");
    assert.equal(params.get("targetId"), "42");
    assert.equal(params.get("from"), new Date("2026-10-01T00:00:00").toISOString());
    assert.equal(params.get("to"), new Date("2026-10-18T23:59:59.999").toISOString());
    assert.ok(document.querySelector(".admin-event-active-filters"));

    document.querySelector('[data-action="admin-event-clear-filters"]').click();
    await settle();
    assert.equal(document.querySelector('[data-route="events"]').getAttribute("aria-current"), "page");
    assert.equal(document.getElementById("admin-event-query").value, "");
    assert.equal(document.querySelector(".admin-event-active-filters"), null);
    const resetRequest = calls.filter(({ path }) => path.startsWith("/api/admin/events?")).at(-1);
    const resetParams = new URL(resetRequest.path, "http://local").searchParams;
    assert.equal(resetParams.get("page"), "0");
    assert.equal(resetParams.has("action"), false);
    assert.equal(resetParams.has("from"), false);
  } finally {
    harness.restore();
  }
});
