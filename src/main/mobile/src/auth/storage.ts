import * as SecureStore from "expo-secure-store";

import {
  sessionStorageKey,
  type MobileSessionNamespace,
} from "./session-keys.ts";
import type { NativeSession } from "../../../shared/src/api.ts";
import { parseSessionRecord, serializeSessionRecord } from "./session-record.ts";

export { sessionStorageKey } from "./session-keys.ts";
export type { MobileSessionNamespace } from "./session-keys.ts";

export type MobileSession = NativeSession;

export async function readSession(
  namespace: MobileSessionNamespace = "account",
): Promise<MobileSession | null> {
  const stored = await SecureStore.getItemAsync(sessionStorageKey(namespace));
  if (!stored) return null;
  try {
    const session = parseSessionRecord(stored, namespace);
    if (session) return session;
  } catch {
    // Invalid SecureStore data is removed below; no credential material is logged.
  }
  await SecureStore.deleteItemAsync(sessionStorageKey(namespace));
  return null;
}

export async function writeSession(
  session: MobileSession,
  namespace: MobileSessionNamespace = "account",
) {
  await SecureStore.setItemAsync(
    sessionStorageKey(namespace),
    serializeSessionRecord(session, namespace),
  );
}

export async function clearSession(
  namespace: MobileSessionNamespace = "account",
) {
  await SecureStore.deleteItemAsync(sessionStorageKey(namespace));
}
