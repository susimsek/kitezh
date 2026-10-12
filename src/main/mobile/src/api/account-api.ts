import type { AccountSocialLink } from "../../../shared/src/contracts.ts";
import {
  classifyApiError,
  createNativeRequestSignal,
  DEFAULT_NATIVE_API_TIMEOUT_MS,
  parseProblemDetail,
  type ApiErrorKind,
  type ProblemDetail,
} from "../../../shared/src/api.ts";
import {
  createMobileApiClient,
  getMobileTransportCause,
  readMobileResponseData,
  toHeaderRecord,
} from "./http-client.ts";

export type { AccountSocialLink };

export type AccountProfile = {
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  pendingEmail: string | null;
  emailVerified: boolean;
  preferredLocale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountSession = {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  current: boolean;
  clients: { clientId: string; clientName: string }[];
};

export type AccountSessionPage = {
  content: AccountSession[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type AccountApplication = {
  clientId: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type AccountOfflineSession = {
  id: string;
  clientId: string;
  clientName: string;
  issuedAt: string;
  expiresAt: string | null;
};

export type AccountPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type MfaStatus = {
  enabled: boolean;
  available: boolean;
  required: boolean;
  issuer: string;
  algorithm: string;
  digits: number;
  periodSeconds: number;
};

export type MfaSetup = {
  secret: string;
  qrCode: string;
  algorithm: string;
  digits: number;
  periodSeconds: number;
};

export type RecoveryCodesStatus = {
  remaining: number;
  warningThreshold: number;
};

export type SocialLink = AccountSocialLink;

export class AccountApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
    this.data = data;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
  }
}

type RequestOptions = {
  refreshAccessToken?: () => Promise<string | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const accountClient = createMobileApiClient(DEFAULT_NATIVE_API_TIMEOUT_MS);

async function requestAccount<T>(
  accessToken: string,
  path: string,
  init: RequestInit,
  options: RequestOptions,
  message: string,
): Promise<T> {
  const requestSignal = createNativeRequestSignal(
    options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
    options.signal,
  );
  try {
    const response = await accountClient.request<T>(
      {
        data: init.body,
        headers: toHeaderRecord(init.headers),
        method: init.method,
        signal: requestSignal.signal,
        timeout: options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
        url: path,
      },
      { accessToken, refreshAccessToken: options.refreshAccessToken },
    );
    if (response.status < 200 || response.status >= 300) {
      throw new AccountApiError(
        response.status,
        message,
        readMobileResponseData(response.data),
      );
    }
    if (response.status === 204) return undefined as T;
    return readMobileResponseData(response.data) as T;
  } catch (cause) {
    if (cause instanceof AccountApiError) throw cause;
    throw new AccountApiError(
      0,
      message,
      getMobileTransportCause(cause, requestSignal.timedOut()),
    );
  } finally {
    requestSignal.dispose();
  }
}

export function getAccountProfile(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountProfile>(
    accessToken,
    "/api/account/profile",
    { method: "GET" },
    options,
    "Account profile request failed",
  );
}

export function updateAccountProfile(
  accessToken: string,
  profile: Pick<AccountProfile, "firstName" | "lastName" | "email"> & {
    currentPassword?: string | null;
  },
  options: RequestOptions = {},
) {
  return requestAccount<AccountProfile>(
    accessToken,
    "/api/account/profile",
    {
      body: JSON.stringify(profile),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
    options,
    "Account profile update failed",
  );
}

export function changeAccountPassword(
  accessToken: string,
  password: { currentPassword: string; newPassword: string },
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    "/api/account/password",
    {
      body: JSON.stringify(password),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
    options,
    "Account password request failed",
  );
}

export function listAccountSessions(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountSessionPage>(
    accessToken,
    "/api/account/sessions?page=0&size=20",
    { method: "GET" },
    options,
    "Account sessions request failed",
  );
}

export function signOutOtherAccountSessions(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    "/api/account/sessions/others",
    { method: "DELETE" },
    options,
    "Account sessions request failed",
  );
}

export function signOutAccountSession(
  accessToken: string,
  sessionId: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
    options,
    "Account session request failed",
  );
}

export function listAccountApplications(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountPage<AccountApplication>>(
    accessToken,
    "/api/account/applications?page=0&size=20",
    { method: "GET" },
    options,
    "Account applications request failed",
  );
}

export function revokeAccountApplication(
  accessToken: string,
  clientId: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/applications/${encodeURIComponent(clientId)}`,
    { method: "DELETE" },
    options,
    "Account application request failed",
  );
}

export function listOfflineSessions(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountPage<AccountOfflineSession>>(
    accessToken,
    "/api/account/offline-sessions?page=0&size=20",
    { method: "GET" },
    options,
    "Offline sessions request failed",
  );
}

export function revokeOfflineSession(
  accessToken: string,
  sessionId: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/offline-sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
    options,
    "Offline session request failed",
  );
}

export function deleteAccount(
  accessToken: string,
  currentPassword: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    "/api/account",
    {
      body: JSON.stringify({ currentPassword }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    },
    options,
    "Account deletion request failed",
  );
}

export function getMfaStatus(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<MfaStatus>(
    accessToken,
    "/api/account/mfa",
    { method: "GET" },
    options,
    "MFA status request failed",
  );
}

export function startMfaSetup(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<MfaSetup>(
    accessToken,
    "/api/account/mfa/setup",
    { method: "POST" },
    options,
    "MFA setup request failed",
  );
}

export function mutateMfa(
  accessToken: string,
  action: "enable" | "disable",
  code: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/mfa/${action}`,
    {
      body: JSON.stringify({ code }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    options,
    "MFA request failed",
  );
}

export function getRecoveryCodesStatus(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<RecoveryCodesStatus>(
    accessToken,
    "/api/account/mfa/recovery-codes",
    { method: "GET" },
    options,
    "Recovery code status request failed",
  );
}

export function generateRecoveryCodes(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<{ codes: string[]; remaining: number }>(
    accessToken,
    "/api/account/mfa/recovery-codes",
    { method: "POST" },
    options,
    "Recovery code request failed",
  );
}

export function listSocialLinks(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<SocialLink[]>(
    accessToken,
    "/api/account/social-links",
    { method: "GET" },
    options,
    "Social links request failed",
  );
}

export function unlinkSocialProvider(
  accessToken: string,
  provider: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/social-links/${encodeURIComponent(provider)}`,
    { method: "DELETE" },
    options,
    "Social link request failed",
  );
}
