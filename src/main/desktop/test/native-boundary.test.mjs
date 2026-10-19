import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { messages } from "../../shared/dist/catalog.js";
import { iconMetadata } from "../../shared/dist/icons.js";
import { userMessages } from "../src/native/user-messages.mjs";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function runtimeSourceFiles(rootDirectory) {
  const pendingDirectories = [rootDirectory];
  const sourceFiles = [];
  const excludedDirectories = new Set([
    ".expo",
    ".next",
    "build",
    "coverage",
    "dist",
    "e2e",
    "node_modules",
    "test",
  ]);
  const sourceExtension = /\.(?:ts|tsx|mjs)$/;
  const testFile = /\.(?:test|spec)\.[^.]+$/;

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
        pendingDirectories.push(entryPath);
      } else if (
        entry.isFile() &&
        sourceExtension.test(entry.name) &&
        !testFile.test(entry.name)
      ) {
        sourceFiles.push(entryPath);
      }
    }
  }

  return sourceFiles;
}

test("shared English and Turkish catalogs contain the same non-empty message keys", () => {
  const englishKeys = Object.keys(messages.en.native).sort();
  assert.deepEqual(Object.keys(messages.tr.native).sort(), englishKeys);
  for (const key of englishKeys) {
    assert.equal(
      typeof messages.en.native[key],
      "string",
      `English message: ${key}`,
    );
    assert.ok(
      messages.en.native[key].trim(),
      `English message is empty: ${key}`,
    );
    assert.equal(
      typeof messages.tr.native[key],
      "string",
      `Turkish message: ${key}`,
    );
    assert.ok(
      messages.tr.native[key].trim(),
      `Turkish message is empty: ${key}`,
    );
  }
});

test("shared Web catalogs align keys and message placeholders across locales", () => {
  const english = flattenMessages(messages.en.web);
  const turkish = flattenMessages(messages.tr.web);
  const englishKeys = Object.keys(english).sort();
  assert.deepEqual(Object.keys(turkish).sort(), englishKeys);
  for (const key of englishKeys) {
    assert.ok(english[key].trim(), `English message is empty: ${key}`);
    assert.ok(turkish[key].trim(), `Turkish message is empty: ${key}`);
    assert.deepEqual(
      placeholders(turkish[key]),
      placeholders(english[key]),
      `Message placeholders differ: ${key}`,
    );
  }
});

test("shared icon metadata resolves generic action labels in both locales", () => {
  for (const [name, metadata] of Object.entries(iconMetadata)) {
    assert.ok(metadata.unicode.trim(), `${name} icon needs a glyph`);
    assert.ok(
      messages.en.native[metadata.labelKey],
      `English label is missing for ${name}`,
    );
    assert.ok(
      messages.tr.native[metadata.labelKey],
      `Turkish label is missing for ${name}`,
    );
  }

  assert.equal(iconMetadata.add.labelKey, "actionAdd");
  assert.equal(iconMetadata.delete.labelKey, "actionDelete");
  assert.equal(iconMetadata.edit.labelKey, "actionEdit");
});

function flattenMessages(value, prefix = "") {
  return Object.entries(value).reduce((result, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[path] = child;
    else if (child && typeof child === "object" && !Array.isArray(child))
      Object.assign(result, flattenMessages(child, path));
    return result;
  }, {});
}

function placeholders(message) {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

test("native renderer static messages exist in both shared or Desktop catalogs", async () => {
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
  assert.deepEqual(
    Object.keys(userMessages.en).sort(),
    Object.keys(userMessages.tr).sort(),
  );
  for (const locale of ["en", "tr"]) {
    assert.ok(
      Object.values(userMessages[locale]).every(
        (value) => typeof value === "string" && value.trim(),
      ),
    );
  }
  const catalogs = {
    en: { ...messages.en.native, ...userMessages.en },
    tr: { ...messages.tr.native, ...userMessages.tr },
  };
  const missingKeys = [...new Set(keys)].filter(
    (key) =>
      !Object.hasOwn(catalogs.en, key) || !Object.hasOwn(catalogs.tr, key),
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
  assert.doesNotMatch(source, /\b(?:getSession|refreshToken|accessToken)\b/);
  assert.match(source, /aria-busy/);
  assert.match(source, /social-start/);
  assert.match(source, /onCallback/);
});

test("native build bundles the organizations screen into its single renderer module", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "scripts", "build-native-renderer.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /import \{ createOrganizationScreens \} from "\.\/organizations\.mjs"/,
  );
  assert.match(source, /path\.join\(sourceDirectory, "organizations\.mjs"\)/);
});

test("native organization create form matches Web control layout", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "src", "native", "native.html"),
    "utf8",
  );
  assert.match(
    source,
    /\.organization-create-card \.actions\s*\{\s*justify-content:\s*flex-end/s,
  );
  assert.match(
    source,
    /\.organization-create-card textarea\s*\{\s*min-height:\s*104px/s,
  );
  assert.match(
    source,
    /\.organization-cancel-button\s*\{\s*border-color:\s*#6c757d/s,
  );
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

test("desktop does not initialize Electron crash reporting", async () => {
  const sourceFiles = await runtimeSourceFiles(
    path.join(desktopDirectory, "src"),
  );
  const sources = await Promise.all(
    sourceFiles.map((sourcePath) => readFile(sourcePath, "utf8")),
  );
  const crashReporterStarts = sources.flatMap((source, index) =>
    [...source.matchAll(/\bcrashReporter\.start\s*\(/g)].map(() =>
      path.relative(desktopDirectory, sourceFiles[index]),
    ),
  );

  assert.deepEqual(
    crashReporterStarts,
    [],
    "Electron crash reporting must remain disabled so memory dumps are not collected or uploaded",
  );
});

test("Web and Mobile runtime logging cannot expose rejected exception values", async () => {
  const repositoryDirectory = path.resolve(desktopDirectory, "..", "..", "..");
  const webDirectory = path.join(repositoryDirectory, "src", "main", "web");
  const mobileDirectory = path.join(
    repositoryDirectory,
    "src",
    "main",
    "mobile",
    "src",
  );
  const [webFiles, mobileFiles] = await Promise.all([
    runtimeSourceFiles(webDirectory),
    runtimeSourceFiles(mobileDirectory),
  ]);
  const [webSources, mobileSources] = await Promise.all([
    Promise.all(webFiles.map((file) => readFile(file, "utf8"))),
    Promise.all(mobileFiles.map((file) => readFile(file, "utf8"))),
  ]);
  const consoleCall =
    /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(([^)]*)\)/gs;
  const webCalls = webSources.flatMap((source) =>
    [...source.matchAll(consoleCall)].map((match) => match[1].trim()),
  );
  const mobileCalls = mobileSources.flatMap((source) =>
    [...source.matchAll(consoleCall)].map((match) => match[1].trim()),
  );

  assert.deepEqual(webCalls, [
    '"Unable to resolve the latest desktop release"',
  ]);
  assert.deepEqual(mobileCalls, []);
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
  assert.match(source, /\/api\/admin\/whoami/);
  assert.match(source, /firstAuthorizedAdminRoute\(\)/);
  assert.match(
    source,
    /filter\(\(\[, , , allowed\]\) => allowed\(state\.data\.adminAccess\)\)/,
  );
});
