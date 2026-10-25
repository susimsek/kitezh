import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("sparse provider mapper edit keeps a server-rejected draft for retry", async () => {
  const mapperPath = "/api/admin/identity-providers/github/mappers";
  const mapper = {
    id: "sparse-mapper",
    name: "email",
    sourceClaim: "email",
    target: "email",
    mapperType: "user-attribute",
  };
  let updateCount = 0;
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/identity-providers?"))
        return {
          content: [
            {
              id: "github",
              alias: "github",
              providerType: "oidc",
              displayName: "GitHub",
              enabled: true,
              mapperCount: 1,
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      if (path === "/api/admin/identity-providers/github")
        return {
          id: "github",
          alias: "github",
          providerType: "oidc",
          displayName: "GitHub",
        };
      if (path === "/api/admin/identity-providers/github/native-policy")
        return {
          displayName: "GitHub",
          enabled: true,
          guiOrder: 1,
        };
      if (path.startsWith(`${mapperPath}?`))
        return {
          content: [mapper],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      return null;
    },
  });
  harness.setResponse(`${mapperPath}/sparse-mapper`, "PUT", ({ body }) => {
    updateCount += 1;
    if (updateCount === 1)
      return {
        status: 400,
        body: {
          violations: [{ field: "target", message: "Target is invalid" }],
        },
      };
    Object.assign(mapper, body);
    return mapper;
  });

  try {
    const { document, calls } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-open"][data-id="github"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-tab"][data-tab="mappers"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-mapper-edit"][data-id="sparse-mapper"]')
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    assert.equal(form.elements.namedItem("syncMode").value, "inherit");
    assert.equal(form.elements.namedItem("addToIdToken").checked, false);
    assert.equal(form.elements.namedItem("addToAccessToken").checked, false);

    form.elements.namedItem("target").value = "primaryEmail";
    form.elements.namedItem("addToIdToken").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    assert.equal(form.elements.namedItem("target").value, "primaryEmail");
    assert.equal(form.elements.namedItem("addToIdToken").checked, true);
    assert.equal(form.querySelector('[name="target"]').disabled, false);

    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(updateCount, 2);
    assert.equal(document.querySelector('[data-form="admin-provider-mapper"]'), null);
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${mapperPath}/sparse-mapper` &&
          method === "PUT" &&
          body.target === "primaryEmail" &&
          body.addToIdToken === true &&
          body.addToAccessToken === false,
      ),
    );
  } finally {
    harness.restore();
  }
});
