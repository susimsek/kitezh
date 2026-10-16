import type { NativeSession } from "../../../shared/src/api.ts";
import type { MobileSessionNamespace } from "./session-keys.ts";

const SESSION_RECORD_VERSION = 1;

export function parseSessionRecord(
  stored: string,
  namespace: MobileSessionNamespace,
): NativeSession | null {
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const versioned = record.version !== undefined;
  if (
    (versioned &&
      (record.version !== SESSION_RECORD_VERSION ||
        record.namespace !== namespace)) ||
    typeof record.accessToken !== "string" ||
    record.accessToken.length === 0 ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt) ||
    (record.refreshToken !== undefined &&
      record.refreshToken !== null &&
      typeof record.refreshToken !== "string") ||
    (record.idToken !== undefined &&
      record.idToken !== null &&
      typeof record.idToken !== "string")
  ) {
    return null;
  }
  return {
    accessToken: record.accessToken,
    refreshToken:
      typeof record.refreshToken === "string" ? record.refreshToken : null,
    idToken: typeof record.idToken === "string" ? record.idToken : null,
    expiresAt: record.expiresAt,
  };
}

export function serializeSessionRecord(
  session: NativeSession,
  namespace: MobileSessionNamespace,
): string {
  return JSON.stringify({
    ...session,
    namespace,
    version: SESSION_RECORD_VERSION,
  });
}
