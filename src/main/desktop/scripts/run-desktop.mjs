import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const isWindows = process.platform === "win32";
const pnpm = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const electron = path.join(
  desktopDirectory,
  "node_modules",
  ...(isWindows ? ["electron", "dist", "electron.exe"] : [".bin", "electron"]),
);
const mode = process.argv[2] ?? "production";
const environment = { ...process.env };

if (mode === "local" && !environment.DESKTOP_API_BASE_URL) {
  environment.DESKTOP_API_BASE_URL = "http://localhost:9090";
}
if (mode === "local" && !environment.DESKTOP_DEVTOOLS) {
  environment.DESKTOP_DEVTOOLS = "true";
}
if (mode === "local" && !environment.DESKTOP_UPDATE_PREVIEW) {
  environment.DESKTOP_UPDATE_PREVIEW = "true";
}

const build = spawnSync(
  pnpm,
  isWindows ? ["/d", "/s", "/c", "pnpm.cmd run build"] : ["run", "build"],
  {
    cwd: desktopDirectory,
    env: environment,
    stdio: "inherit",
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const application = spawn(electron, ["."], {
  cwd: desktopDirectory,
  env: environment,
  stdio: "inherit",
});
application.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
