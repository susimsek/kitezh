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
  const keys = [
    ...[...source.matchAll(/\btext\(\s*["']([^"']+)["']\s*\)/g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/\[\s*["']([^"']+)["']\s*,\s*server\./g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/["'](admin[A-Z][A-Za-z0-9]+)["']/g)].map(
      (match) => match[1],
    ),
  ];

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

test("desktop runtime sources do not write directly to console logs", async () => {
  const sourcePaths = [
    path.join(desktopDirectory, "src", "main.ts"),
    path.join(desktopDirectory, "src", "preload.ts"),
    path.join(desktopDirectory, "src", "native", "renderer.mjs"),
    path.join(desktopDirectory, "src", "api", "desktop-api.ts"),
  ];
  const sources = await Promise.all(
    sourcePaths.map((sourcePath) => readFile(sourcePath, "utf8")),
  );

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(
      source,
      /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(/,
      `${path.relative(desktopDirectory, sourcePaths[index])} must not log runtime data directly`,
    );
  }
});

test("native renderer cannot read or replace sessions through IPC", async () => {
  const [mainSource, preloadSource] = await Promise.all([
    readFile(path.join(desktopDirectory, "src", "main.ts"), "utf8"),
    readFile(path.join(desktopDirectory, "src", "preload.ts"), "utf8"),
  ]);

  assert.doesNotMatch(mainSource, /desktop:auth-(get-session|set-session)/);
  assert.match(preloadSource, /startLogin: \(consoleName: ConsoleName\)/);
  assert.doesNotMatch(
    preloadSource,
    /getSession|setSession|refreshToken|accessToken/,
  );
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
