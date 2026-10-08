const SEPARATOR = "\u0000";

export function encodeConsentRouteKey(clientId: string, username: string) {
  const bytes = new TextEncoder().encode(`${clientId}${SEPARATOR}${username}`);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeConsentRouteKey(key: string) {
  if (!key || key.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(key)) return null;
  const bytes = new Uint8Array(key.match(/.{2}/g)!.map((value) => Number.parseInt(value, 16)));
  const decoded = new TextDecoder().decode(bytes);
  const separator = decoded.indexOf(SEPARATOR);
  if (separator < 1 || separator === decoded.length - 1) return null;
  return {
    clientId: decoded.slice(0, separator),
    username: decoded.slice(separator + 1),
  };
}
