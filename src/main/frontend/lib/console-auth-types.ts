import type { Locale } from "@/i18n/config";

export type ConsoleKind = "admin" | "account";

export type ConsoleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
};

export type JwtPayload = {
  exp?: number;
  iat?: number;
  nonce?: string;
  picture?: string;
  sid?: string;
  sub?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};

export type AuthorizationTransaction = {
  codeVerifier: string;
  expires: number;
  nonce: string;
  redirectUri: string;
  returnTo: string;
  state: string;
};

export type ConsoleAuthConfig = {
  clientId: string;
  desktopClientId?: string;
  scope: string;
  transactionKey: string;
  redirectPath: (locale: Locale) => string;
  postLogoutRedirectPath: (locale: Locale) => string;
  postLoginReturnToKey?: string;
};

export type StoredConsoleTokens = {
  accessToken: string;
  expiresAt: number;
  idToken: string | null;
  refreshToken: string | null;
  version: 1;
};
