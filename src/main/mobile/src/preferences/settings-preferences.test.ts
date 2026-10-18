import assert from "node:assert/strict";
import test from "node:test";

import { resetSettingsPreferences } from "./settings-preferences.ts";

test("settings reset restores the successful preference if the other reset fails", async () => {
  const calls: string[] = [];
  const didReset = await resetSettingsPreferences(
    {
      reset: async () => {
        calls.push("locale.reset");
        return true;
      },
      restore: async () => {
        calls.push("locale.restore");
        return true;
      },
    },
    {
      reset: async () => {
        calls.push("theme.reset");
        return false;
      },
      restore: async () => {
        calls.push("theme.restore");
        return true;
      },
    },
  );

  assert.equal(didReset, false);
  assert.deepEqual(calls, ["locale.reset", "theme.reset", "locale.restore"]);
});

test("settings reset does not roll back when both preferences reset successfully", async () => {
  const calls: string[] = [];
  const didReset = await resetSettingsPreferences(
    {
      reset: async () => {
        calls.push("locale.reset");
        return true;
      },
      restore: async () => {
        calls.push("locale.restore");
        return true;
      },
    },
    {
      reset: async () => {
        calls.push("theme.reset");
        return true;
      },
      restore: async () => {
        calls.push("theme.restore");
        return true;
      },
    },
  );

  assert.equal(didReset, true);
  assert.deepEqual(calls, ["locale.reset", "theme.reset"]);
});
