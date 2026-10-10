import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const config = JSON.parse(
  execFileSync("pnpm", ["exec", "expo", "config", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

const android = config.android;
const filters = android?.intentFilters ?? [];
const splashPlugin = config.plugins?.find(
  ([pluginName]) => pluginName === "expo-splash-screen",
);
const requiredRoutes = new Set([
  "oauth/callback",
  "logout/callback",
  "admin/oauth/callback",
  "admin/logout/callback",
  "verify-email/",
  "reset-password/",
]);
const configuredRoutes = new Set(
  filters
    .flatMap((filter) => filter.data ?? [])
    .map((data) => `${data.host}/${String(data.path ?? "").replace(/^\//, "")}`),
);

if (
  config.scheme !== "kitezh" ||
  config.name !== "Kitezh" ||
  android?.package !== "io.github.susimsek.kitezh.mobile" ||
  !config.icon ||
  !existsSync(resolve(config.icon)) ||
  !existsSync(resolve("assets/icon.png")) ||
  !existsSync(resolve("assets/android-icon-foreground.png")) ||
  !splashPlugin?.[1]?.image ||
  !existsSync(resolve(splashPlugin[1].image)) ||
  !splashPlugin[1]?.dark?.image ||
  !existsSync(resolve(splashPlugin[1].dark.image)) ||
  requiredRoutes.size !== configuredRoutes.size ||
  [...requiredRoutes].some((route) => !configuredRoutes.has(route))
) {
  throw new Error("Expo native scheme, package, or deep-link filters are incomplete");
}

console.log("Expo native scheme and deep-link filters are configured.");
