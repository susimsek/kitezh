import {
  sessionStorageKey,
  type MobileSessionNamespace,
} from "./session-keys.ts";
import type { NativeSession } from "../../../shared/src/api.ts";

export type MobileSession = NativeSession;
const SESSION_SCHEMA_VERSION = 1;

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
      let parsed:
        | Partial<MobileSession>
        | { schemaVersion?: number; session?: Partial<MobileSession> };
      try {
        parsed = JSON.parse(stored) as
          | Partial<MobileSession>
          | { schemaVersion?: number; session?: Partial<MobileSession> };
      } catch {
        await secureStore.deleteItemAsync(sessionStorageKey(namespace));
        return null;
      }
      const envelope = parsed as {
        schemaVersion?: number;
        session?: Partial<MobileSession>;
      };
      if (
        envelope.schemaVersion !== undefined &&
        (envelope.schemaVersion !== SESSION_SCHEMA_VERSION || !envelope.session)
      ) {
        await secureStore.deleteItemAsync(sessionStorageKey(namespace));
        return null;
      }
      const session = (
        envelope.schemaVersion === SESSION_SCHEMA_VERSION
          ? envelope.session
          : parsed
      ) as Partial<MobileSession>;
      if (
        typeof session.accessToken !== "string" ||
        session.accessToken.length === 0 ||
        typeof session.expiresAt !== "number" ||
        !Number.isFinite(session.expiresAt) ||
        (session.refreshToken !== undefined &&
          session.refreshToken !== null &&
          typeof session.refreshToken !== "string") ||
        (session.idToken !== undefined &&
          session.idToken !== null &&
          typeof session.idToken !== "string")
      ) {
        await secureStore.deleteItemAsync(sessionStorageKey(namespace));
        return null;
      }
      const normalized = {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        idToken: session.idToken ?? null,
        expiresAt: session.expiresAt,
      };
      if (envelope.schemaVersion === undefined) {
        await secureStore.setItemAsync(
          sessionStorageKey(namespace),
          JSON.stringify({
            schemaVersion: SESSION_SCHEMA_VERSION,
            session: normalized,
          }),
        );
      }
      return normalized;
    },
    async writeSession(
      session: MobileSession,
      namespace: MobileSessionNamespace = "account",
    ) {
      await secureStore.setItemAsync(
        sessionStorageKey(namespace),
        JSON.stringify({ schemaVersion: SESSION_SCHEMA_VERSION, session }),
      );
    },
    async clearSession(namespace: MobileSessionNamespace = "account") {
      await secureStore.deleteItemAsync(sessionStorageKey(namespace));
    },
  };
}
