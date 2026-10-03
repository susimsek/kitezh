"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import type { Locale } from "@/i18n/config";
import { CONSOLE_TRANSACTION_KEYS, type JwtPayload, useConsoleAuth } from "@/lib/console-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setAdminAccess, setConsoleUsername, type AdminAccess } from "@/store/auth-slice";

type AdminAuthRuntime = {
  refreshAccessToken: (minValidity?: number) => Promise<string | null>;
  logout: (locale: Locale) => Promise<void>;
  beginAuthorization: (locale: Locale, returnTo: string) => Promise<void>;
  completeAuthorization: (code: string, state: string) => Promise<string>;
};

type AdminAuthValue = AdminAuthRuntime & {
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
  access: AdminAccess | null;
  username: string | null;
  setAccess: (access: AdminAccess | null) => void;
  setUsername: (username: string | null) => void;
};

export type { AdminAccess } from "@/store/auth-slice";

const ADMIN_AUTH_CONFIG = {
  clientId: "admin-console",
  desktopClientId: "desktop-admin-console",
  scope: "profile email admin-api",
  transactionKey: CONSOLE_TRANSACTION_KEYS.admin,
  postLoginReturnToKey: "AUTH_ADMIN_RETURN_TO",
  redirectPath: () => `/admin/callback`,
  postLogoutRedirectPath: () => `/admin/`,
};

const AdminAuthRuntimeContext = createContext<AdminAuthRuntime | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const { refreshAccessToken, logout, beginAuthorization, completeAuthorization } = useConsoleAuth(
    ADMIN_AUTH_CONFIG,
    "admin",
  );

  const runtime = useMemo(
    () => ({
      refreshAccessToken,
      logout,
      beginAuthorization,
      completeAuthorization,
    }),
    [beginAuthorization, completeAuthorization, logout, refreshAccessToken],
  );

  return (
    <AdminAuthRuntimeContext.Provider value={runtime}>{children}</AdminAuthRuntimeContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthValue {
  const runtime = useContext(AdminAuthRuntimeContext);
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth.admin);
  if (!runtime) throw new Error("AdminAuthProvider is required");

  const setAccess = useCallback(
    (value: AdminAccess | null) => dispatch(setAdminAccess(value)),
    [dispatch],
  );
  const setUsername = useCallback(
    (value: string | null) => dispatch(setConsoleUsername({ console: "admin", username: value })),
    [dispatch],
  );

  return {
    ...auth,
    ...runtime,
    setAccess,
    setUsername,
  };
}
