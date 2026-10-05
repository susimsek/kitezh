import { createPrivateKey, sign } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const releaseDirectory = path.resolve(
  process.argv[2] ?? path.dirname(fileURLToPath(import.meta.url)),
  ...(process.argv[2] ? [] : ["../release"]),
);
const privateKeyValue = process.env.UPDATE_MANIFEST_SIGNING_KEY;

if (!privateKeyValue) {
  console.warn(
    "UPDATE_MANIFEST_SIGNING_KEY is not configured; update manifests will remain unsigned.",
  );
  process.exit(0);
}

const privateKey = createPrivateKey(privateKeyValue);
const entries = await readdir(releaseDirectory, { withFileTypes: true });
const manifests = entries
  .filter((entry) => entry.isFile() && /^latest.*\.yml$/.test(entry.name))
  .map((entry) => entry.name);

if (manifests.length === 0) {
  throw new Error(`No update manifests found in ${releaseDirectory}`);
}

for (const manifest of manifests) {
  const content = await readFile(path.join(releaseDirectory, manifest));
  const signature = sign(null, content, privateKey).toString("base64");
  await writeFile(path.join(releaseDirectory, `${manifest}.sig`), `${signature}\n`);
}

console.log(`Signed ${manifests.length} update manifest(s).`);
