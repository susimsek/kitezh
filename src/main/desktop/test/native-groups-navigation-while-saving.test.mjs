import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("group navigation stays on the current detail route while settings save", async () => {
  let finishSave;
  const group = {
    id: 3,
    name: "Engineering",
    path: "/Engineering",
    roles: ["ROLE_USER"],
    attributes: {},
    parentId: null,
    defaultGroup: false,
  };
  const harness = await renderConsole("admin", {
    response: (path, method, body) => {
      if (path === "/api/admin/groups" && method === "GET")
        return {
          content: [group],
          page: { size: 10, number: 0, totalPages: 1, totalElements: 1 },
        };
      if (path === "/api/admin/groups/3" && method === "GET") return group;
      if (path === "/api/admin/groups/3" && method === "PUT")
        return new Promise((resolve) => {
          finishSave = () => resolve({ ...group, ...body });
        });
      return null;
    },
  });

  try {
    const { document, dom, calls } = harness;
    const { window } = dom;
    document.querySelector('[data-route="groups"]').click();
    await settle();
    document.querySelector('[data-action="group-open"][data-id="3"]').click();
    await settle();

    const form = document.querySelector('[data-form="native-group-settings"]');
    assert.ok(form);
    const name = form.elements.namedItem("name");
    name.value = "Platform";
    name.dispatchEvent(new window.Event("input", { bubbles: true }));
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.equal(typeof finishSave, "function");
    assert.ok(calls.some(({ path, method }) => path === "/api/admin/groups/3" && method === "PUT"));

    window.history.pushState(null, "", "#/admin/groups?page=4");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await settle();
    assert.equal(window.location.hash, "#/admin/groups/3/details");
    assert.ok(document.querySelector('[data-form="native-group-settings"]'));

    finishSave();
    await settle();
    assert.equal(
      document.querySelector('[data-form="native-group-settings"]').elements.namedItem("name").value,
      "Platform",
    );
  } finally {
    harness.restore();
  }
});
