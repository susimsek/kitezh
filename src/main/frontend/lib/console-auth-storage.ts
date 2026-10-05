import type {
  AuthorizationTransaction,
  ConsoleAuthConfig,
  ConsoleKind,
  StoredConsoleTokens,
} from "./console-auth-types";
import { isDesktopRuntime } from "./desktop-api";
import { electronSessionAdapter } from "./electron-session-adapter";

const TOKEN_STORAGE_PREFIX = "AUTH_CONSOLE_TOKEN";
const CONSOLE_KINDS: ConsoleKind[] = ["admin", "account"];

export const CONSOLE_TRANSACTION_KEYS: Record<ConsoleKind, string> = {
  admin: "ADMIN_OIDC_TRANSACTION",
  account: "ACCOUNT_OIDC_TRANSACTION",
};

const TRANSACTION_STORAGE_PREFIXES = Object.values(CONSOLE_TRANSACTION_KEYS).map(
  (key) => `${key}:`,
);

function callbackKey(config: ConsoleAuthConfig, state: string) {
  return `${config.transactionKey}:${state}`;
}

function cookieRead(key: string) {
  const name = `${encodeURIComponent(key)}=`;
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(name))
    ?.slice(name.length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function cookieWrite(key: string, value: string, expires: number) {
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; expires=${new Date(expires).toUTCString()}; path=/; SameSite=Lax`;
}

function cookieRemove(key: string) {
  document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function storeTransaction(config: ConsoleAuthConfig, transaction: AuthorizationTransaction) {
  const key = callbackKey(config, transaction.state);
  const value = JSON.stringify(transaction);
  try {
    localStorage.setItem(key, value);
  } catch {
    cookieWrite(key, value, transaction.expires);
  }
}

export function readAndRemoveTransaction(config: ConsoleAuthConfig, state: string) {
  const key = callbackKey(config, state);
  let value: string | null = null;
  try {
    value = localStorage.getItem(key);
    localStorage.removeItem(key);
  } catch {
    value = cookieRead(key);
    cookieRemove(key);
  }
  if (!value) {
    value = cookieRead(key);
    cookieRemove(key);
  }
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as AuthorizationTransaction;
    if (!isTransaction(parsed) || parsed.expires < Date.now() || parsed.state !== state) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredTransactions() {
  try {
    Object.keys(localStorage)
      .filter(isTransactionStorageKey)
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Continue with cookie fallback cleanup when local storage is unavailable.
  }

  document.cookie.split("; ").forEach((entry) => {
    const encodedKey = entry.slice(0, Math.max(entry.indexOf("="), 0));
    if (!encodedKey) return;
    try {
      const key = decodeURIComponent(encodedKey);
      if (isTransactionStorageKey(key)) cookieRemove(key);
    } catch {
      // Ignore malformed cookie names.
    }
  });
}

export function readStoredTokens(consoleKind: ConsoleKind) {
  try {
    const value = localStorage.getItem(tokenStorageKey(consoleKind));
    if (!value) return null;
    const tokens = JSON.parse(value) as unknown;
    if (isStoredConsoleTokens(tokens)) return tokens;
  } catch {
    // Treat unavailable or malformed browser storage as an unauthenticated session.
  }
  return null;
}

export async function readPersistedTokens(consoleKind: ConsoleKind) {
  if (isDesktopRuntime() && window.desktopApi) {
    return electronSessionAdapter.read(consoleKind);
  }
  return readStoredTokens(consoleKind);
}

export function storeTokens(consoleKind: ConsoleKind, tokens: StoredConsoleTokens) {
  try {
    localStorage.setItem(tokenStorageKey(consoleKind), JSON.stringify(tokens));
  } catch {
    // The running console keeps working when storage is unavailable.
  }
}

export async function persistTokens(consoleKind: ConsoleKind, tokens: StoredConsoleTokens) {
  if (isDesktopRuntime() && window.desktopApi) {
    await electronSessionAdapter.write(consoleKind, tokens);
    return;
  }
  storeTokens(consoleKind, tokens);
}

export function removeStoredTokens(consoleKind: ConsoleKind) {
  try {
    localStorage.removeItem(tokenStorageKey(consoleKind));
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export async function removePersistedTokens(consoleKind: ConsoleKind) {
  if (isDesktopRuntime() && window.desktopApi) {
    await electronSessionAdapter.clear(consoleKind);
    return;
  }
  removeStoredTokens(consoleKind);
}

export function removeAllStoredTokens() {
  CONSOLE_KINDS.forEach(removeStoredTokens);
}

export async function removeAllPersistedTokens() {
  if (isDesktopRuntime() && window.desktopApi) {
    await electronSessionAdapter.clearAll();
    return;
  }
  removeAllStoredTokens();
}

function isTransactionStorageKey(key: string) {
  return TRANSACTION_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function tokenStorageKey(consoleKind: ConsoleKind) {
  return `${TOKEN_STORAGE_PREFIX}:${consoleKind}`;
}

function isStoredConsoleTokens(value: unknown): value is StoredConsoleTokens {
  if (!value || typeof value !== "object") return false;
  const tokens = value as Partial<StoredConsoleTokens>;
  return (
    tokens.version === 1 &&
    typeof tokens.accessToken === "string" &&
    tokens.accessToken.length > 0 &&
    typeof tokens.expiresAt === "number" &&
    Number.isFinite(tokens.expiresAt) &&
    (tokens.idToken === null || typeof tokens.idToken === "string") &&
    (tokens.refreshToken === null || typeof tokens.refreshToken === "string")
  );
}

function isTransaction(value: unknown): value is AuthorizationTransaction {
  if (!value || typeof value !== "object") return false;
  const transaction = value as Partial<AuthorizationTransaction>;
  return (
    typeof transaction.codeVerifier === "string" &&
    transaction.codeVerifier.length > 0 &&
    typeof transaction.expires === "number" &&
    Number.isFinite(transaction.expires) &&
    typeof transaction.nonce === "string" &&
    transaction.nonce.length > 0 &&
    typeof transaction.redirectUri === "string" &&
    transaction.redirectUri.length > 0 &&
    typeof transaction.returnTo === "string" &&
    transaction.returnTo.startsWith("/") &&
    typeof transaction.state === "string" &&
    transaction.state.length > 0
  );
}
