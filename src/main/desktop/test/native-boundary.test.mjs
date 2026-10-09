import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("native desktop renderer does not depend on the Web component tree", async () => {
  const source = await readFile(
    path.join(desktopDirectory, "src", "native", "renderer.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /React|React-Bootstrap|localStorage|next\/|src\/main\/web/);
  assert.match(source, /api\.api\.request/);
  assert.doesNotMatch(source, /getSession|refreshToken|accessToken/);
  assert.match(source, /aria-busy/);
  assert.match(source, /social-start/);
  assert.match(source, /onCallback/);
});
