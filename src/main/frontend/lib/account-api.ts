import type { AxiosRequestConfig } from "axios";

import { createAuthenticatedApiClient, type TokenHandlers } from "./authenticated-api-client";

const accountClient = createAuthenticatedApiClient();

export type AccountApiError = {
  status: number;
  data: unknown;
};

export type AccountProfile = {
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerified: boolean;
  preferredLocale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountAvatar = {
  avatarUrl: string | null;
};

export type AccountApplication = {
  clientId: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type AccountSession = {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  current: boolean;
  clients: Array<{ clientId: string; clientName: string }>;
};

export type AccountOfflineSession = {
  id: string;
  clientId: string;
  clientName: string;
  issuedAt: string;
  expiresAt: string | null;
};

export type CibaPendingRequest = {
  authReqId: string;
  userCode: string;
  bindingMessage: string | null;
  authorizedScopes: string;
  deliveryMode: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  mfaRequired: boolean;
  stepUpRequired: boolean;
};

export type AccountWebAuthnCredential = {
  credentialId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  transports: string[];
  backupEligible: boolean;
  backupState: boolean;
  credentialType?: string;
  signatureCount?: number;
  uvInitialized?: boolean;
  attestationPresent?: boolean;
};

export function registerAccountTokenHandlers(handlers: TokenHandlers | undefined) {
  accountClient.registerTokenHandlers(handlers);
}

export function accountRequest<T>(accessToken: string, config: AxiosRequestConfig) {
  return accountClient.request<T>(accessToken, config);
}

export async function requestAccount<T>(accessToken: string, config: AxiosRequestConfig) {
  try {
    const response = await accountRequest<T>(accessToken, config);
    if (response.status >= 300) {
      throw { status: response.status, data: response.data } satisfies AccountApiError;
    }
    return response.data;
  } catch (error) {
    if (isAccountApiError(error)) throw error;
    throw {
      status: 0,
      data: { message: error instanceof Error ? error.message : "Account request failed" },
    } satisfies AccountApiError;
  }
}

function isAccountApiError(error: unknown): error is AccountApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    "data" in error
  );
}
