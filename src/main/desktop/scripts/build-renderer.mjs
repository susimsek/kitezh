import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDirectory = path.resolve(desktopDirectory, "../web");
const rendererDirectory = path.join(desktopDirectory, "renderer");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const result = spawnSync(pnpm, ["--dir", webDirectory, "build"], {
  shell: process.platform === "win32",
  stdio: "inherit",
});
if (result.error) {
  console.error(`Unable to start pnpm: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

await rm(rendererDirectory, { recursive: true, force: true });
await mkdir(rendererDirectory, { recursive: true });
await cp(path.join(webDirectory, "out"), rendererDirectory, { recursive: true });
