import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import { verifyUpdateManifestSignature } from "../dist/update.js";

test("accepts a signed update manifest and rejects changed content", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const manifest = Buffer.from("version: 0.1.3\n");
  const signature = sign(null, manifest, privateKey);

  assert.equal(
    verifyUpdateManifestSignature(manifest, signature, publicKey),
    true,
  );
  assert.equal(
    verifyUpdateManifestSignature(
      Buffer.from("version: 0.1.4\n"),
      signature,
      publicKey,
    ),
    false,
  );
});
