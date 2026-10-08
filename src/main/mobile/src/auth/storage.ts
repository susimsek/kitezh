import * as SecureStore from "expo-secure-store";

export type MobileSession = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
};

const SESSION_KEY = "kitezh.mobile.account.session";

export async function readSession(): Promise<MobileSession | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
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

export async function writeSession(session: MobileSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
