import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await mkdir(output, { recursive: true });
await copyFile(
  path.join(root, "src", "theme-runtime.cjs"),
  path.join(output, "theme-runtime.cjs"),
);
await copyFile(
  path.join(root, "src", "client-metadata.cjs"),
  path.join(output, "client-metadata.cjs"),
);
