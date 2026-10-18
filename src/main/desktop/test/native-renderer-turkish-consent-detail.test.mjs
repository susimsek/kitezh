import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("Turkish user consent details render localized labels and sparse metadata", async () => {
  const harness = await renderConsole("admin", { locale: "tr" });
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
  }));
  harness.setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [
        {
          clientId: "sparse-client",
          clientName: "",
          principalName: "",
          authorities: [],
          createdAt: "2026-10-01T10:00:00Z",
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );

  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="consents"]')
      .click();
    await settle();

    const row = document.querySelector(".admin-user-detail-data-table tbody tr");
    assert.match(row.textContent, /sparse-client/);
    assert.match(row.textContent, /Ayrıntılar/);
    assert.match(row.textContent, /İzni kaldır/);

    row.querySelector('[data-action="admin-user-detail-consent-details"]').click();
    await settle();
    const details = document.querySelector(".admin-user-detail-expand-row");
    assert.match(details.textContent, /Kullanıcı/);
    assert.match(details.textContent, /İzin oluşturulma/);
    assert.match(details.textContent, /Son güncelleme/);
    assert.match(details.textContent, /İzinler/);
    assert.match(details.textContent, /ada/);
    assert.match(details.textContent, /2026/);
    assert.match(details.textContent, /—/);
  } finally {
    harness.restore();
  }
});
