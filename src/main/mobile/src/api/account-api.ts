import type {
  AccountSocialLink,
  DesktopSocialLinkCompleteRequest,
  DesktopSocialLinkCompleteResponse,
  DesktopSocialLinkStartRequest,
  DesktopSocialLinkStartResponse,
} from "../../../shared/src/contracts.ts";
import {
  classifyApiError,
  createNativeRequestSignal,
  DEFAULT_NATIVE_API_TIMEOUT_MS,
  parseRetryAfterMs,
  parseProblemDetail,
  readRetryAfterHeader,
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

export type AccountAvatar = { avatarUrl: string | null };

export type AccountProfileAttributeType =
  "STRING" | "EMAIL" | "INTEGER" | "BOOLEAN";

export type AccountProfileAttributeDefinition = {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  type: AccountProfileAttributeType;
  required: boolean;
  multivalued: boolean;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  enabled: boolean;
  displayOrder: number;
  builtIn: boolean;
};

export type AccountProfileAttributes = {
  definitions: AccountProfileAttributeDefinition[];
  attributes: Record<string, string[]>;
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

export type AccountNotification = {
  id: string;
  messageKey: string;
  createdAt: string;
  read: boolean;
};

export type PersonalAccessToken = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  createdAt: string;
  expiresAt: string | null;
};

export type CreatedPersonalAccessToken = PersonalAccessToken & { token: string };

export type CreatePersonalAccessTokenRequest = {
  name: string;
  description: string | null;
  expiration: "7" | "30" | "60" | "90" | "custom" | "never";
  customExpirationDate?: string;
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

export type AccountPasskey = {
  credentialId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string[];
  backupEligible: boolean;
  backupState: boolean;
};

export type NativePasskeyCreationOptions = {
  challengeId: string;
  publicKey: import("@/auth/native-passkey").NativeCreationOptions;
};

export type SocialLink = AccountSocialLink;

export class AccountApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    retryAfter?: string,
  ) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
    this.data = data;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
    this.retryAfterMs = parseRetryAfterMs(retryAfter);
  }
}

type RequestOptions = {
  refreshAccessToken?: () => Promise<string | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type AccountPageRequestOptions = RequestOptions & {
  page?: number;
  size?: number;
};

function pageQuery(page: number | undefined, size: number | undefined) {
  const safePage = Math.max(0, Math.floor(page ?? 0));
  const safeSize = Math.min(100, Math.max(1, Math.floor(size ?? 20)));
  return `page=${safePage}&size=${safeSize}`;
}

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
        readRetryAfterHeader(response.headers),
      );
    }
    if (response.status === 204) return undefined as T;
    return readMobileResponseData(response.data) as T;
  } catch (error) {
    if (error instanceof AccountApiError) throw error;
    const cause = requestSignal.signal.aborted
      ? requestSignal.signal.reason
      : error;
    throw new AccountApiError(0, message, getMobileTransportCause(cause));
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

export function listAccountPasskeys(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountPage<AccountPasskey>>(
    accessToken,
    "/api/account/webauthn/credentials?page=0&size=100",
    { method: "GET" },
    options,
    "Passkey list request failed",
  );
}

export function beginAccountPasskeyEnrollment(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<NativePasskeyCreationOptions>(
    accessToken,
    "/api/account/webauthn/registration-options",
    { body: "{}", headers: { "Content-Type": "application/json" }, method: "POST" },
    options,
    "Passkey registration options could not be created",
  );
}

export function completeAccountPasskeyEnrollment(
  accessToken: string,
  challengeId: string,
  credential: import("@/auth/native-passkey-contract").NativePasskeyCredential,
  label: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/webauthn/registration/${encodeURIComponent(challengeId)}`,
    { body: JSON.stringify({ credential, label }), headers: { "Content-Type": "application/json" }, method: "POST" },
    options,
    "Passkey could not be registered",
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

export function getAccountProfileAttributes(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountProfileAttributes>(
    accessToken,
    "/api/account/profile/attributes",
    { method: "GET" },
    options,
    "Account profile attributes request failed",
  );
}

export function updateAccountProfileAttributes(
  accessToken: string,
  attributes: Record<string, string[]>,
  options: RequestOptions = {},
) {
  return requestAccount<AccountProfileAttributes>(
    accessToken,
    "/api/account/profile/attributes",
    {
      body: JSON.stringify({ attributes }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
    options,
    "Account profile attributes update failed",
  );
}

export function getAccountAvatar(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<AccountAvatar>(
    accessToken,
    "/api/account/profile/avatar",
    { method: "GET" },
    options,
    "Account avatar request failed",
  );
}

export function uploadAccountAvatar(
  accessToken: string,
  file: { uri: string; name: string; type: "image/jpeg" },
  options: RequestOptions = {},
) {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  return requestAccount<AccountAvatar>(
    accessToken,
    "/api/account/profile/avatar",
    { body: form, method: "PUT" },
    options,
    "Account avatar upload failed",
  );
}

export function deleteAccountAvatar(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    "/api/account/profile/avatar",
    { method: "DELETE" },
    options,
    "Account avatar deletion failed",
  );
}

export function sendAccountVerificationEmail(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    "/api/account/send-verify-email",
    { method: "POST" },
    options,
    "Account verification email request failed",
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
  options: AccountPageRequestOptions = {},
) {
  return requestAccount<AccountSessionPage>(
    accessToken,
    `/api/account/sessions?${pageQuery(options.page, options.size)}`,
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

export function listPersonalAccessTokens(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<PersonalAccessToken[]>(
    accessToken,
    "/api/account/personal-access-tokens",
    { method: "GET" },
    options,
    "Personal access tokens request failed",
  );
}

export function createPersonalAccessToken(
  accessToken: string,
  request: CreatePersonalAccessTokenRequest,
  options: RequestOptions = {},
) {
  return requestAccount<CreatedPersonalAccessToken>(
    accessToken,
    "/api/account/personal-access-tokens",
    {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    options,
    "Personal access token could not be created",
  );
}

export function revokePersonalAccessToken(
  accessToken: string,
  tokenId: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/personal-access-tokens/${encodeURIComponent(tokenId)}`,
    { method: "DELETE" },
    options,
    "Personal access token could not be revoked",
  );
}

export function listAccountApplications(
  accessToken: string,
  options: AccountPageRequestOptions = {},
) {
  return requestAccount<AccountPage<AccountApplication>>(
    accessToken,
    `/api/account/applications?${pageQuery(options.page, options.size)}`,
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
  options: AccountPageRequestOptions = {},
) {
  return requestAccount<AccountPage<AccountOfflineSession>>(
    accessToken,
    `/api/account/offline-sessions?${pageQuery(options.page, options.size)}`,
    { method: "GET" },
    options,
    "Offline sessions request failed",
  );
}

export function listAccountNotifications(
  accessToken: string,
  options: AccountPageRequestOptions = {},
) {
  return requestAccount<AccountPage<AccountNotification>>(
    accessToken,
    `/api/account/notifications?${pageQuery(options.page, options.size)}&sort=createdAt,desc`,
    { method: "GET" },
    options,
    "Account notifications request failed",
  );
}

export function getAccountUnreadNotificationCount(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAccount<number>(
    accessToken,
    "/api/account/notifications/unread-count",
    { method: "GET" },
    options,
    "Account notification count request failed",
  );
}

export function markAccountNotificationRead(
  accessToken: string,
  notificationId: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/account/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PUT" },
    options,
    "Account notification update failed",
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

export function listCibaRequests(
  accessToken: string,
  options: AccountPageRequestOptions = {},
) {
  return requestAccount<AccountPage<CibaPendingRequest>>(
    accessToken,
    `/api/ciba/requests?${pageQuery(options.page, options.size)}&sort=createdAt,desc`,
    { method: "GET" },
    options,
    "CIBA requests could not be loaded",
  );
}

export function decideCibaRequest(
  accessToken: string,
  request: Pick<CibaPendingRequest, "authReqId" | "userCode">,
  decision: "approve" | "deny",
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/ciba/requests/${encodeURIComponent(request.authReqId)}/${decision}?user_code=${encodeURIComponent(request.userCode)}`,
    { method: "POST" },
    options,
    "CIBA request decision failed",
  );
}

export function approveCibaRequestWithMfa(
  accessToken: string,
  request: Pick<CibaPendingRequest, "authReqId" | "userCode">,
  code: string,
  options: RequestOptions = {},
) {
  return requestAccount<void>(
    accessToken,
    `/api/ciba/requests/${encodeURIComponent(request.authReqId)}/approve/native?user_code=${encodeURIComponent(request.userCode)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    },
    options,
    "CIBA request decision failed",
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

export function startNativeSocialLink(
  accessToken: string,
  provider: string,
  request: DesktopSocialLinkStartRequest,
  options: RequestOptions = {},
) {
  return requestAccount<DesktopSocialLinkStartResponse>(
    accessToken,
    `/api/account/social-links/${encodeURIComponent(provider)}/mobile/start`,
    {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    options,
    "Native social-link start request failed",
  );
}

export function completeNativeSocialLink(
  accessToken: string,
  request: DesktopSocialLinkCompleteRequest,
  options: RequestOptions = {},
) {
  return requestAccount<DesktopSocialLinkCompleteResponse>(
    accessToken,
    "/api/account/social-links/mobile/complete",
    {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    options,
    "Native social-link completion request failed",
  );
}
