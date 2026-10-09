import type { JwtPayload } from "./console-auth-types";

function base64Url(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function randomValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function codeChallenge(codeVerifier: string) {
  const bytes = new TextEncoder().encode(codeVerifier);
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

export function decodeJwt(token: string | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) return null;
    const padded = encodedPayload
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function ensureOpenIdScope(scope: string) {
  const values = scope.split(/\s+/).filter(Boolean);
  if (!values.includes("openid")) values.unshift("openid");
  return values.join(" ");
}
