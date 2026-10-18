import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const command =
  process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const args =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec expo config --json"]
    : ["exec", "expo", "config", "--json"];
const config = JSON.parse(
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

const android = config.android;
const adaptiveIcon = android?.adaptiveIcon;
const filters = android?.intentFilters ?? [];
const iosDomains = config.ios?.associatedDomains ?? [];
const splashPlugin = config.plugins?.find(
  ([pluginName]) => pluginName === "expo-splash-screen",
);
const requiredRoutes = new Set([
  "oauth/callback",
  "logout/callback",
  "admin/oauth/callback",
  "admin/logout/callback",
  "social-link/callback",
  "verify-email/",
  "confirm-email/",
  "reset-password/",
]);
const configuredRoutes = new Set(
  filters
    .filter((filter) =>
      (filter.data ?? []).every((data) => data.scheme === "kitezh"),
    )
    .flatMap((filter) => filter.data ?? [])
    .map(
      (data) => `${data.host}/${String(data.path ?? "").replace(/^\//, "")}`,
    ),
);
const requiredAppLinkRoutes = new Set([
  "/verify-email",
  "/confirm-email",
  "/reset-password",
  "/oauth/callback",
  "/logout/callback",
  "/admin/oauth/callback",
  "/admin/logout/callback",
]);
const configuredAppLinkRoutes = new Set(
  filters
    .filter((filter) => filter.autoVerify === true)
    .flatMap((filter) => filter.data ?? [])
    .filter(
      (data) => data.scheme === "https" && data.host === "kitezh.onrender.com",
    )
    .map((data) => data.path),
);
const appLinkFilters = filters.filter((filter) => filter.autoVerify === true);
const validAppLinkFilters = appLinkFilters.every((filter) => {
  const data = filter.data ?? [];
  const categories = new Set(filter.category ?? []);
  return (
    filter.action === "VIEW" &&
    categories.has("DEFAULT") &&
    categories.has("BROWSABLE") &&
    data.length === 1 &&
    data[0].scheme === "https" &&
    data[0].host === "kitezh.onrender.com" &&
    requiredAppLinkRoutes.has(data[0].path)
  );
});
const validCustomSchemeFilters = filters
  .filter((filter) =>
    (filter.data ?? []).some((data) => data.scheme === "kitezh"),
  )
  .every((filter) => {
    const data = filter.data ?? [];
    const categories = new Set(filter.category ?? []);
    return (
      filter.autoVerify !== true &&
      filter.action === "VIEW" &&
      categories.has("DEFAULT") &&
      categories.has("BROWSABLE") &&
      data.length === 1 &&
      data[0].scheme === "kitezh"
    );
  });
const brandAssets = [
  config.icon,
  adaptiveIcon?.foregroundImage,
  adaptiveIcon?.backgroundImage,
  adaptiveIcon?.monochromeImage,
  splashPlugin?.[1]?.image,
  splashPlugin?.[1]?.dark?.image,
];

if (
  JSON.stringify(config.platforms) !== JSON.stringify(["ios", "android"]) ||
  config.scheme !== "kitezh" ||
  config.name !== "Kitezh" ||
  config.ios?.bundleIdentifier !== "io.github.susimsek.kitezh.mobile" ||
  android?.package !== "io.github.susimsek.kitezh.mobile" ||
  !adaptiveIcon?.foregroundImage ||
  !adaptiveIcon?.backgroundImage ||
  !adaptiveIcon?.monochromeImage ||
  new Set(brandAssets).size !== brandAssets.length ||
  brandAssets.some((asset) => !asset || !existsSync(resolve(asset))) ||
  !iosDomains.includes("applinks:kitezh.onrender.com") ||
  !iosDomains.includes("webcredentials:kitezh.onrender.com") ||
  new Set(iosDomains).size !== iosDomains.length ||
  !validAppLinkFilters ||
  !validCustomSchemeFilters ||
  requiredRoutes.size !== configuredRoutes.size ||
  [...requiredRoutes].some((route) => !configuredRoutes.has(route)) ||
  requiredAppLinkRoutes.size !== configuredAppLinkRoutes.size ||
  [...requiredAppLinkRoutes].some(
    (route) => !configuredAppLinkRoutes.has(route),
  )
) {
  throw new Error(
    "Expo native scheme, package, or deep-link filters are incomplete",
  );
}

console.log(
  "Expo Kitezh branding, custom schemes, and verified Android/iOS app links are configured.",
);
