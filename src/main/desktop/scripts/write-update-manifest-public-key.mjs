import { createPrivateKey, createPublicKey } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assetsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets",
);
const publicKeyPath = path.join(
  assetsDirectory,
  "update-manifest-public-key.pem",
);
const privateKeyValue = process.env.UPDATE_MANIFEST_SIGNING_KEY;

if (!privateKeyValue) {
  throw new Error(
    "UPDATE_MANIFEST_SIGNING_KEY is required for desktop releases.",
  );
}

const publicKey = createPublicKey(createPrivateKey(privateKeyValue)).export({
  type: "spki",
  format: "pem",
});
await mkdir(assetsDirectory, { recursive: true });
await writeFile(publicKeyPath, publicKey, { mode: 0o644 });
console.log("Bundled the update manifest verification key.");
