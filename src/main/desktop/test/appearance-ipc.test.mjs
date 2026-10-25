import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDesktopAppearanceIpc } from "../dist/appearance-ipc.js";

function createAppearanceHarness() {
  const handlers = new Map();
  const calls = [];
  let theme = "system";
  let language = "en";
  let languageMode = "system";
  registerDesktopAppearanceIpc({
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    assertTrustedSender(event) {
      calls.push("assert-trusted");
      if (!event?.trusted) throw new Error("Untrusted IPC sender");
    },
    applyTheme(value) {
      theme = value;
      calls.push(["apply-theme", value]);
    },
    persistTheme(value) {
      calls.push(["persist-theme", value]);
    },
    getTheme: () => theme,
    async applyLanguage(value) {
      languageMode = value === "tr" || value === "en" ? value : "system";
      language = languageMode === "system" ? "en" : languageMode;
      calls.push(["apply-language", value]);
    },
    getLanguage: () => language,
    getLanguageMode: () => languageMode,
  });

  return {
    calls,
    invoke(channel, event = { trusted: true }, value) {
      return handlers.get(channel)(event, value);
    },
  };
}

test("normalizes an unknown theme to system and persists each theme change", () => {
  const harness = createAppearanceHarness();

  harness.invoke("desktop:theme-set", undefined, "unknown-theme");
  harness.invoke("desktop:theme-set", undefined, "dark");

  assert.deepEqual(
    harness.calls.filter((call) => Array.isArray(call)),
    [
      ["apply-theme", "system"],
      ["persist-theme", "system"],
      ["apply-theme", "dark"],
      ["persist-theme", "dark"],
    ],
  );
  assert.equal(harness.invoke("desktop:theme-get"), "dark");
});

test("applies a language selection and exposes both the effective language and selected mode", async () => {
  const harness = createAppearanceHarness();

  await harness.invoke("desktop:language-set", undefined, "tr");

  assert.equal(harness.invoke("desktop:language-get"), "tr");
  assert.equal(harness.invoke("desktop:language-mode-get"), "tr");
  await harness.invoke("desktop:language-set", undefined, "invalid");
  assert.equal(harness.invoke("desktop:language-mode-get"), "system");
});

test("rejects untrusted renderer calls before changing desktop appearance", async () => {
  const harness = createAppearanceHarness();

  assert.throws(
    () => harness.invoke("desktop:theme-set", { trusted: false }, "light"),
    /Untrusted IPC sender/,
  );
  await assert.rejects(
    Promise.resolve().then(() =>
      harness.invoke("desktop:language-set", { trusted: false }, "tr"),
    ),
    /Untrusted IPC sender/,
  );

  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "apply-theme"), false);
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "apply-language"), false);
});
