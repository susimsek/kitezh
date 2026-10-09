import { execFileSync } from "node:child_process";

const config = JSON.parse(
  execFileSync("pnpm", ["exec", "expo", "config", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

const android = config.android;
const filters = android?.intentFilters ?? [];
const requiredHosts = new Set(["oauth", "logout", "verify-email", "reset-password"]);
const configuredHosts = new Set(
  filters.flatMap((filter) => filter.data ?? []).map((data) => data.host),
);

if (
  config.scheme !== "kitezh" ||
  android?.package !== "io.github.susimsek.kitezh.mobile" ||
  requiredHosts.size !== configuredHosts.size ||
  [...requiredHosts].some((host) => !configuredHosts.has(host))
) {
  throw new Error("Expo native scheme, package, or deep-link filters are incomplete");
}

console.log("Expo native scheme and deep-link filters are configured.");
