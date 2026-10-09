import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(desktopDirectory, "src", "native");
const outputDirectory = path.join(desktopDirectory, "dist", "native");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(path.join(sourceDirectory, "native.html"), path.join(outputDirectory, "native.html"));
await cp(path.join(sourceDirectory, "renderer.mjs"), path.join(outputDirectory, "renderer.mjs"));
