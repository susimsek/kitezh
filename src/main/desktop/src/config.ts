import { URL } from "node:url";

export const DESKTOP_PROTOCOL = "kitezh";
export const RENDERER_PROTOCOL = "app";
export const RENDERER_HOST = "renderer";
export const DEFAULT_API_BASE_URL = "https://kitezh.onrender.com";
export const LOCAL_API_BASE_URL = "http://localhost:9090";
const DEPLOYED_API_HOST = "kitezh.onrender.com";
const ALLOWED_EXTERNAL_HOSTS = new Set([
  DEPLOYED_API_HOST,
  "accounts.google.com",
  "github.com",
  "www.github.com",
  "www.linkedin.com",
  "login.microsoftonline.com",
]);

export function findDesktopDeepLink(args: readonly string[] = process.argv) {
  return (
    args.find((value) => value.startsWith(`${DESKTOP_PROTOCOL}://`)) ?? null
  );
}

export function getApiBaseUrl(
  environment = process.env.DESKTOP_API_BASE_URL,
): string {
  const candidate = environment?.trim() || DEFAULT_API_BASE_URL;
  const url = new URL(candidate);
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("DESKTOP_API_BASE_URL must contain only an origin");
  }
  if (
    (url.protocol === "https:" && url.hostname !== DEPLOYED_API_HOST) ||
    (url.protocol === "http:" && !isLocalHost(url.hostname)) ||
    (url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    throw new Error(
      "DESKTOP_API_BASE_URL must use the deployed Render host or localhost development",
    );
  }
  return url.origin;
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (!isAllowedExternalOrigin(url)) return false;
    if (!isAllowedExternalPath(url)) return false;
    if (!hasAllowedRedirects(url)) return false;
    return true;
  } catch {
    return false;
  }
}

function isAllowedExternalOrigin(url: URL) {
  if (url.protocol === "https:" && url.port === "") {
    return ALLOWED_EXTERNAL_HOSTS.has(url.hostname);
  }
  return (
    url.protocol === "http:" && isLocalHost(url.hostname) && url.port === "9090"
  );
}

function isAllowedExternalPath(url: URL) {
  if (url.hostname === DEPLOYED_API_HOST || isLocalHost(url.hostname)) {
    return (
      url.pathname === "/oauth2/authorize" ||
      url.pathname === "/connect/logout" ||
      /^\/account\/social-links\/(google|github|linkedin|microsoft)\/desktop\/authorize$/.test(
        url.pathname,
      )
    );
  }
  if (url.hostname === "accounts.google.com") {
    return url.pathname === "/o/oauth2/v2/auth";
  }
  if (url.hostname === "github.com" || url.hostname === "www.github.com") {
    return url.pathname === "/login/oauth/authorize";
  }
  if (url.hostname === "www.linkedin.com") {
    return url.pathname === "/oauth/v2/authorization";
  }
  if (url.hostname === "login.microsoftonline.com") {
    return /^\/[a-zA-Z0-9.-]+\/oauth2\/v2\.0\/authorize$/.test(url.pathname);
  }
  return false;
}

function hasAllowedRedirects(url: URL) {
  const redirectUris = [
    ...url.searchParams.getAll("redirect_uri"),
    ...url.searchParams.getAll("post_logout_redirect_uri"),
  ];
  if (url.searchParams.getAll("redirect_uri").length > 1) return false;
  if (url.searchParams.getAll("post_logout_redirect_uri").length > 1)
    return false;
  return redirectUris.every((redirectUri) =>
    [
      "kitezh://oauth/callback",
      "kitezh://social-link/callback",
      "kitezh://logout/callback",
      "https://kitezh.onrender.com/login/oauth2/code/google",
      "https://kitezh.onrender.com/login/oauth2/code/github",
      "https://kitezh.onrender.com/login/oauth2/code/linkedin",
      "https://kitezh.onrender.com/login/oauth2/code/microsoft",
      "http://localhost:9090/login/oauth2/code/google",
      "http://localhost:9090/login/oauth2/code/github",
      "http://localhost:9090/login/oauth2/code/linkedin",
      "http://localhost:9090/login/oauth2/code/microsoft",
    ].includes(redirectUri),
  );
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}
