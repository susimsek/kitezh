import assert from "node:assert/strict";
import test from "node:test";

import { createPreferenceStorage } from "./preference-storage.ts";

const isTheme = (value: string | null): value is "system" | "light" | "dark" =>
  value === "system" || value === "light" || value === "dark";

test("preference storage rejects unsupported persisted values", async () => {
  const storage = createPreferenceStorage(
    {
      getItemAsync: async () => "sepia",
      setItemAsync: async () => undefined,
      deleteItemAsync: async () => undefined,
    },
    "kitezh.mobile.theme",
    isTheme,
  );

  assert.equal(await storage.read(), null);
});

test("preference storage times out stalled reads and writes", async () => {
  let releaseWrite: (() => void) | undefined;
  let shouldStall = true;
  const storage = createPreferenceStorage(
    {
      getItemAsync: () => new Promise<string | null>(() => undefined),
      setItemAsync: async () => {
        if (shouldStall) {
          shouldStall = false;
          await new Promise<void>((resolve) => {
            releaseWrite = resolve;
          });
        }
      },
      deleteItemAsync: async () => undefined,
    },
    "kitezh.mobile.theme",
    isTheme,
    5,
  );

  await assert.rejects(storage.read(), /preference_storage_timeout/);
  await assert.rejects(storage.save("dark"), /preference_storage_timeout/);
  releaseWrite?.();
  await storage.save("light");
});

test("preference writes serialize in selection order and recover after failure", async () => {
  const writes: string[] = [];
  let releaseFirstWrite: (() => void) | undefined;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  let shouldFail = true;
  const storage = createPreferenceStorage(
    {
      getItemAsync: async () => null,
      setItemAsync: async (_key, value) => {
        writes.push(value);
        if (value === "dark" && shouldFail) {
          shouldFail = false;
          throw new Error("storage unavailable");
        }
        if (value === "light") await firstWrite;
      },
      deleteItemAsync: async () => undefined,
    },
    "kitezh.mobile.theme",
    isTheme,
  );

  const failedWrite = storage.save("dark");
  const queuedWrite = storage.save("light");
  await assert.rejects(failedWrite, /storage unavailable/);
  assert.deepEqual(writes, ["dark", "light"]);

  releaseFirstWrite?.();
  await queuedWrite;
  assert.deepEqual(writes, ["dark", "light"]);
  await storage.save("system");
  assert.deepEqual(writes, ["dark", "light", "system"]);
});
