import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const mapperPath = "/api/admin/identity-providers/github/mappers";

function mapper(id, sourceClaim = "email") {
  return {
    id,
    name: `${id}-mapper`,
    sourceClaim,
    target: "email",
    mapperType: "user-attribute",
  };
}

test("identity-provider mapper matrix covers pages, page-size reset, sorting and empty search", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/identity-providers?") )
        return {
          content: [{ id: "github", alias: "github", displayName: "GitHub", providerType: "oidc" }],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      if (path === "/api/admin/identity-providers/github")
        return { id: "github", alias: "github", displayName: "GitHub", providerType: "oidc" };
      if (path === "/api/admin/identity-providers/github/native-policy")
        return { displayName: "GitHub", enabled: true };
      if (!path.startsWith(`${mapperPath}?`)) return null;

      const params = new URL(path, "http://local").searchParams;
      const query = params.get("q");
      const page = Number(params.get("page"));
      const size = Number(params.get("size"));
      const sort = params.get("sort");
      if (query === "missing-claim")
        return { content: [], totalElements: 0, totalPages: 0, number: 0 };
      if (sort === "sourceClaim,asc")
        return { content: [mapper("sorted", "given_name")], totalElements: 1, totalPages: 1, number: 0 };
      if (size === 20)
        return { content: [mapper("page-size-1"), mapper("page-size-2")], totalElements: 23, totalPages: 2, number: 0 };
      if (page === 1)
        return { content: [mapper("mapper-page-2", "preferred_username")], totalElements: 23, totalPages: 3, number: 1 };
      return {
        content: Array.from({ length: 10 }, (_, index) => mapper(`mapper-${index + 1}`)),
        totalElements: 23,
        totalPages: 3,
        number: 0,
      };
    },
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document.querySelector('[data-action="admin-provider-open"][data-id="github"]').click();
    await settle();
    document.querySelector('[data-action="admin-provider-tab"][data-tab="mappers"]').click();
    await settle();

    assert.equal(document.querySelectorAll(".provider-mappers-card tbody tr").length, 10);
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*3/);
    document.querySelector('[data-provider-mapper-page="1"]').click();
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /2\s*\/\s*3/);
    assert.ok(calls.some(({ path }) => new URL(path, "http://local").searchParams.get("page") === "1" && path.startsWith(mapperPath)));

    const pageSize = document.getElementById("admin-provider-mapper-size");
    pageSize.value = "20";
    pageSize.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await settle();
    assert.match(document.querySelector(".provider-page-indicator").textContent, /1\s*\/\s*2/);
    assert.ok(calls.some(({ path }) => path.startsWith(mapperPath) && new URL(path, "http://local").searchParams.get("size") === "20"));

    const search = document.querySelector('#admin-provider-mapper-search input[name="q"]');
    search.value = "missing-claim";
    search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.ok(document.querySelector(".provider-mapper-empty"));
    assert.equal(document.querySelector(".provider-mapper-pagination"), null);
    document.querySelector('[data-action="admin-provider-mapper-clear"]').click();
    await settle();
    assert.equal(document.querySelector(".provider-mapper-empty"), null);
    assert.equal(document.querySelector('#admin-provider-mapper-search input[name="q"]').value, "");

    document.getElementById("admin-provider-mapper-sort").value = "sourceClaim,asc";
    document.getElementById("admin-provider-mapper-sort").dispatchEvent(
      new document.defaultView.Event("change", { bubbles: true }),
    );
    await settle();
    assert.ok(document.querySelector('[data-provider-mapper-id="sorted"]'));
    assert.ok(calls.some(({ path }) => path.startsWith(mapperPath) && new URL(path, "http://local").searchParams.get("sort") === "sourceClaim,asc"));
  } finally {
    harness.restore();
  }
});
