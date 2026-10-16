import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  assertUpdateInfoMatchesSignedManifest,
  assertUpdateManifestSignature,
  verifyUpdateManifestSignature,
} from "../dist/update.js";

const signedManifest = Buffer.from(
  "version: 0.1.4\nreleaseDate: '2026-10-11T08:00:00.000Z'\nfiles:\n  - url: kitezh-0.1.4-win-x64-setup.exe\n    sha512: signed-checksum\n    size: 128\n",
);
const consumedUpdateInfo = {
  version: "0.1.4",
  releaseDate: "2026-10-11T08:00:00.000Z",
  files: [
    {
      url: "kitezh-0.1.4-win-x64-setup.exe",
      sha512: "signed-checksum",
      size: 128,
    },
  ],
  tag: "v0.1.4",
  releaseName: "Kitezh 0.1.4",
  releaseNotes: [],
};

test("requires updater-consumed metadata to match the signed release manifest", () => {
  assert.doesNotThrow(() =>
    assertUpdateInfoMatchesSignedManifest(signedManifest, consumedUpdateInfo),
  );

  assert.throws(
    () =>
      assertUpdateInfoMatchesSignedManifest(signedManifest, {
        ...consumedUpdateInfo,
        files: [
          {
            ...consumedUpdateInfo.files[0],
            url: "attacker.exe",
          },
        ],
      }),
    /does not match the signed manifest/,
  );
  assert.throws(
    () =>
      assertUpdateInfoMatchesSignedManifest(signedManifest, {
        ...consumedUpdateInfo,
        files: [
          {
            ...consumedUpdateInfo.files[0],
            sha512: "attacker-checksum",
          },
        ],
      }),
    /does not match the signed manifest/,
  );
});

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
  assert.doesNotThrow(() =>
    assertUpdateManifestSignature(manifest, signature, publicKey),
  );
  assert.throws(
    () => assertUpdateManifestSignature(manifest, Buffer.alloc(0), publicKey),
    /signature is missing/,
  );
  assert.throws(
    () =>
      assertUpdateManifestSignature(
        Buffer.from("version: 0.1.4\n"),
        signature,
        publicKey,
      ),
    /signature is invalid/,
  );
});
