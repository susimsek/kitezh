import {
  sessionStorageKey,
  type MobileSessionNamespace,
} from "./session-keys.ts";
import type { NativeSession } from "../../../shared/src/api.ts";

export type MobileSession = NativeSession;

type SecureSessionStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function createSessionStorage(secureStore: SecureSessionStore) {
  return {
    async readSession(
      namespace: MobileSessionNamespace = "account",
    ): Promise<MobileSession | null> {
      const stored = await secureStore.getItemAsync(
        sessionStorageKey(namespace),
      );
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
    },
    async writeSession(
      session: MobileSession,
      namespace: MobileSessionNamespace = "account",
    ) {
      await secureStore.setItemAsync(
        sessionStorageKey(namespace),
        JSON.stringify(session),
      );
    },
    async clearSession(namespace: MobileSessionNamespace = "account") {
      await secureStore.deleteItemAsync(sessionStorageKey(namespace));
    },
  };
}
