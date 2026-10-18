import assert from "node:assert/strict";
import test from "node:test";

import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("identity-provider pagination updates pages, bounds controls, and resets when page size changes", async () => {
  const requests = [];
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (!path.startsWith("/api/admin/identity-providers?")) return null;
      requests.push(path);
      const query = new URL(path, "https://desktop.invalid").searchParams;
      const page = Number(query.get("page") ?? 0);
      const size = Number(query.get("size") ?? 10);
      const totalElements = 25;
      return {
        content: [{ id: `provider-${page}`, alias: `provider-${page}`, providerType: "oidc" }],
        number: page,
        size,
        totalPages: Math.ceil(totalElements / size),
        totalElements,
      };
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*3/);
    const controls = () => [...document.querySelectorAll(".provider-page-button")];
    assert.equal(controls()[0].disabled, true, "first page is disabled on page zero");
    assert.equal(controls()[1].disabled, true, "previous page is disabled on page zero");
    assert.equal(controls()[2].disabled, false);
    assert.equal(controls()[3].disabled, false);

    controls()[2].click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /2\s*\/\s*3/);
    assert.equal(document.querySelector(".provider-table-card tbody tr .provider-label").textContent, "provider-1");

    [...document.querySelectorAll(".provider-page-button")][3].click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /3\s*\/\s*3/);
    assert.equal(
      document.querySelector('[data-identity-provider-page="3"]').disabled,
      true,
      "out-of-range page buttons are disabled",
    );
    assert.equal(
      [...document.querySelectorAll(".provider-page-button")][2].disabled,
      true,
      "next page is disabled at the last page",
    );

    const size = document.getElementById("admin-identity-provider-size");
    size.value = "20";
    size.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*2/);
    assert.ok(requests.some((path) => path.includes("page=2")));
    assert.ok(requests.some((path) => path.includes("page=0") && path.includes("size=20")));
  } finally {
    harness.restore();
  }
});
