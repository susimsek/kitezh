import { URL } from "node:url";

export const DESKTOP_PROTOCOL = "kitezh";
export const RENDERER_PROTOCOL = "app";
export const RENDERER_HOST = "renderer";
export const DEFAULT_API_BASE_URL =
  "https://kitezh.onrender.com";
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
    return (
      (url.protocol === "https:" && ALLOWED_EXTERNAL_HOSTS.has(url.hostname)) ||
      (url.protocol === "http:" && isLocalHost(url.hostname))
    );
  } catch {
    return false;
  }
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}
