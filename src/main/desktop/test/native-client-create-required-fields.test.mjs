import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("client creation requires an identifier, display name, and at least one scope", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients", "POST", ({ body }) => ({
    client: {
      id: "required-fields-client",
      clientId: body.clientId,
      clientName: body.clientName,
      scopes: body.scopes,
    },
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    await settle();
    document.querySelector('[data-action="create-client"]').click();
    await settle();

    let form = document.querySelector('[data-form="admin-client-create"]');
    form.elements.namedItem("authenticationMode").value = "public";
    form.elements.namedItem("redirectUris").value =
      "https://required-fields.example.test/callback";
    form.elements.namedItem("clientId").value = " ";
    form.elements.namedItem("clientName").value = " ";
    form.elements.namedItem("scopes").value = "  \n";
    const submit = async () => {
      form.dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
      form = document.querySelector('[data-form="admin-client-create"]');
    };
    await submit();
    assert.equal(
      calls.some(({ path, method }) => path === "/api/admin/clients" && method === "POST"),
      false,
    );
    assert.ok(form.querySelector('[name="clientId"][aria-invalid="true"]'));
    assert.ok(form.querySelector('[name="clientName"][aria-invalid="true"]'));
    assert.ok(form.querySelector('[name="scopes"][aria-invalid="true"]'));

    form.elements.namedItem("clientId").value = "scope-required-client";
    form.elements.namedItem("clientName").value = "Scope Required Client";
    form.elements.namedItem("scopes").value = "openid profile";
    await submit();
    const create = calls.find(
      ({ path, method }) => path === "/api/admin/clients" && method === "POST",
    );
    assert.ok(create);
    assert.deepEqual(create.body.scopes, ["openid", "profile"]);
  } finally {
    harness.restore();
  }
});
