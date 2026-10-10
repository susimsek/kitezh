import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { messages } from "../../shared/dist/i18n.js";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("shared English and Turkish catalogs contain the same non-empty message keys", () => {
  const englishKeys = Object.keys(messages.en).sort();
  assert.deepEqual(Object.keys(messages.tr).sort(), englishKeys);
  for (const key of englishKeys) {
    assert.equal(typeof messages.en[key], "string", `English message: ${key}`);
    assert.ok(messages.en[key].trim(), `English message is empty: ${key}`);
    assert.equal(typeof messages.tr[key], "string", `Turkish message: ${key}`);
    assert.ok(messages.tr[key].trim(), `Turkish message is empty: ${key}`);
  }
});

test("native renderer static message references exist in both shared catalogs", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "src", "native", "renderer.mjs"),
    "utf8",
  );
  const keys = [...source.matchAll(/\btext\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1],
  );

  assert.ok(keys.length > 0, "native renderer should use shared message keys");
  const missingKeys = [...new Set(keys)].filter(
    (key) =>
      !Object.hasOwn(messages.en, key) || !Object.hasOwn(messages.tr, key),
  );
  assert.deepEqual(
    missingKeys,
    [],
    "all renderer message keys need EN and TR values",
  );
});

test("native desktop renderer does not depend on the Web component tree", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "src", "native", "renderer.mjs"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /React|React-Bootstrap|localStorage|next\/|src\/main\/web/,
  );
  assert.match(source, /api\.api\.request/);
  assert.doesNotMatch(source, /getSession|refreshToken|accessToken/);
  assert.match(source, /aria-busy/);
  assert.match(source, /social-start/);
  assert.match(source, /onCallback/);
});

test("native Admin selection does not call Account APIs", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "src", "native", "renderer.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /if \(state\.console === "admin"\) return adminContent\(\)/,
  );
  assert.match(source, /\/api\/admin\/dashboard/);
  assert.match(
    source,
    /state\.route = state\.console === "admin" \? "dashboard" : "profile"/,
  );
});
