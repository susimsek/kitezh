"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import type { Locale } from "@/i18n/config";
import { CONSOLE_TRANSACTION_KEYS, type JwtPayload, useConsoleAuth } from "@/lib/console-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setConsoleUsername } from "@/store/auth-slice";

type AccountAuthRuntime = {
  clearLocalSession: () => void;
  refreshAccessToken: (minValidity?: number) => Promise<string | null>;
  logout: (locale: Locale) => Promise<void>;
  beginAuthorization: (locale: Locale, returnTo: string) => Promise<void>;
  completeAuthorization: (code: string, state: string) => Promise<string>;
};

type AccountAuthValue = AccountAuthRuntime & {
  accessToken: string | null;
  idToken: string | null;
  expiresAt: number | null;
  isLoggingOut: boolean;
  authenticated: boolean;
  initialized: boolean;
  subject: string | null;
  tokenParsed: JwtPayload | null;
  idTokenParsed: JwtPayload | null;
  refreshTokenParsed: JwtPayload | null;
  username: string | null;
  setUsername: (username: string | null) => void;
};

const ACCOUNT_AUTH_CONFIG = {
  clientId: "account-console",
  desktopClientId: "desktop-account-console",
  scope: "profile email account-api",
  transactionKey: CONSOLE_TRANSACTION_KEYS.account,
  redirectPath: () => `/account/callback`,
  postLogoutRedirectPath: () => `/account/`,
};

const AccountAuthRuntimeContext = createContext<AccountAuthRuntime | null>(null);

export function AccountAuthProvider({ children }: { children: React.ReactNode }) {
  const {
    clearLocalSession,
    refreshAccessToken,
    logout,
    beginAuthorization,
    completeAuthorization,
  } = useConsoleAuth(ACCOUNT_AUTH_CONFIG, "account");

  const runtime = useMemo(
    () => ({
      clearLocalSession,
      refreshAccessToken,
      logout,
      beginAuthorization,
      completeAuthorization,
    }),
    [beginAuthorization, clearLocalSession, completeAuthorization, logout, refreshAccessToken],
  );

  return (
    <AccountAuthRuntimeContext.Provider value={runtime}>
      {children}
    </AccountAuthRuntimeContext.Provider>
  );
}

export function useAccountAuth(): AccountAuthValue {
  const runtime = useContext(AccountAuthRuntimeContext);
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth.account);
  if (!runtime) throw new Error("AccountAuthProvider is required");

  const setUsername = useCallback(
    (value: string | null) => dispatch(setConsoleUsername({ console: "account", username: value })),
    [dispatch],
  );

  return {
    ...auth,
    ...runtime,
    setUsername,
  };
}
