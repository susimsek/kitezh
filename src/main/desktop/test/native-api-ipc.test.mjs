import assert from "node:assert/strict";
import { test } from "node:test";
import { registerNativeApiIpc } from "../dist/native-api-ipc.js";

function createNativeApiHarness() {
  const handlers = new Map();
  const calls = [];
  registerNativeApiIpc({
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    assertTrustedSender(event) {
      if (!event?.trusted) throw new Error("Untrusted IPC sender");
    },
    assertConsole(value) {
      if (value !== "account" && value !== "admin") {
        throw new Error("Invalid console");
      }
    },
    async request(request) {
      calls.push(request);
      return { status: 200, kind: null, body: { ok: true } };
    },
  });

  return {
    calls,
    invoke(event, request) {
      return handlers.get("desktop:api-request")(event, request);
    },
  };
}

test("validates trusted sender, console and relative API paths before delegation", async () => {
  const harness = createNativeApiHarness();

  await assert.rejects(
    harness.invoke({ trusted: false }, { console: "account", path: "/api/account" }),
    /Untrusted IPC sender/,
  );
  await assert.rejects(
    harness.invoke({ trusted: true }, null),
    /Invalid native API request/,
  );
  await assert.rejects(
    harness.invoke({ trusted: true }, { console: "other", path: "/api/account" }),
    /Invalid console/,
  );
  for (const path of ["api/account", "//api/account", "/api/../admin"]) {
    await assert.rejects(
      harness.invoke({ trusted: true }, { console: "account", path }),
      /Invalid native API path/,
    );
  }

  assert.deepEqual(harness.calls, []);
});

test("normalizes locale and forwards the validated native API request", async () => {
  const harness = createNativeApiHarness();
  const body = { enabled: true };

  const result = await harness.invoke(
    { trusted: true },
    {
      console: "admin",
      locale: "tr",
      method: "PUT",
      path: "/api/admin/settings",
      body,
    },
  );

  assert.deepEqual(result, { status: 200, kind: null, body: { ok: true } });
  assert.deepEqual(harness.calls, [
    {
      console: "admin",
      locale: "tr",
      method: "PUT",
      path: "/api/admin/settings",
      body,
    },
  ]);

  await harness.invoke(
    { trusted: true },
    { console: "account", locale: "fr", path: "/api/account/me" },
  );
  assert.equal(harness.calls.at(-1).locale, "en");
});
