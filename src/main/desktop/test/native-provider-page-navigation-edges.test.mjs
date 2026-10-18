import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("provider list navigates first, previous, and last pages from different positions", async () => {
  const requestedPages = [];
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (!path.startsWith("/api/admin/identity-providers?")) return null;
      const page = Number(new URL(path, "https://desktop.invalid").searchParams.get("page") ?? 0);
      requestedPages.push(page);
      return {
        content: [{ id: `provider-${page}`, alias: `provider-${page}`, providerType: "oidc" }],
        number: page,
        size: 10,
        totalPages: 3,
        totalElements: 25,
      };
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();

    const page = (target) =>
      document.querySelector(`[data-identity-provider-page="${target}"]`);
    page("2").click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /3\s*\/\s*3/);
    page("0").click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*3/);

    page("1").click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /2\s*\/\s*3/);
    page("0").click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*3/);

    assert.ok(requestedPages.includes(2));
    assert.ok(requestedPages.filter((requestedPage) => requestedPage === 0).length >= 2);
    assert.ok(requestedPages.includes(1));
  } finally {
    harness.restore();
  }
});
