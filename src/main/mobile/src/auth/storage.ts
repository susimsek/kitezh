import * as SecureStore from "expo-secure-store";

import {
  sessionStorageKey,
  type MobileSessionNamespace,
} from "./session-keys";
import type { NativeSession } from "../../../shared/src/api.ts";

export { sessionStorageKey } from "./session-keys";
export type { MobileSessionNamespace } from "./session-keys";

export type MobileSession = NativeSession;

export async function readSession(
  namespace: MobileSessionNamespace = "account",
): Promise<MobileSession | null> {
  const stored = await SecureStore.getItemAsync(sessionStorageKey(namespace));
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as Partial<MobileSession>;
    if (
      typeof session.accessToken !== "string" ||
      typeof session.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt) ||
      (session.refreshToken !== undefined &&
        session.refreshToken !== null &&
        typeof session.refreshToken !== "string") ||
      (session.idToken !== undefined &&
        session.idToken !== null &&
        typeof session.idToken !== "string")
    ) {
      return null;
    }
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? null,
      idToken: session.idToken ?? null,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function writeSession(
  session: MobileSession,
  namespace: MobileSessionNamespace = "account",
) {
  await SecureStore.setItemAsync(
    sessionStorageKey(namespace),
    JSON.stringify(session),
  );
}

export async function clearSession(
  namespace: MobileSessionNamespace = "account",
) {
  await SecureStore.deleteItemAsync(sessionStorageKey(namespace));
}
