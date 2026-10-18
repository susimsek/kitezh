import type {
  ReleaseMetadata,
  SocialProviderAvailability,
} from "../../../shared/src/contracts.ts";
import type { MfaSetup } from "./account-api.ts";
import type {
  NativeCreationOptions,
  NativePasskeyCredential,
  NativeRequestOptions,
} from "@/auth/native-passkey";
import {
  classifyApiError,
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
} from "./http-client.ts";

export class PublicApiError extends Error {
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
    this.name = "PublicApiError";
    this.status = status;
    this.data = data;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
    this.retryAfterMs = parseRetryAfterMs(retryAfter);
  }
}

type RequestOptions = {
  locale?: string;
  mobilePlatform?: "ANDROID" | "IOS";
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CaptchaSettings = {
  enabled: boolean;
  nativeRequired: boolean;
  nativeEnabled: boolean;
  provider: "" | "recaptcha" | "enterprise";
  siteKey: string;
  action: string;
  recaptchaV3: boolean;
  useRecaptchaNet: boolean;
  androidSiteKey: string;
  iosSiteKey: string;
};
export type { SocialProviderAvailability } from "../../../shared/src/contracts.ts";

export type MobileLoginAction = {
  key: string;
  displayName: string;
  description: string;
  version: number;
};

export type MobileLoginResponse =
  | {
      status: "authorized";
      code: string;
      state: string;
      redirectUri: string;
    }
  | { status: "mfa_required"; transactionId: string }
  | {
      status: "required_actions";
      transactionId: string;
      actions: MobileLoginAction[];
    }
  | {
      status: "passkey_required";
      transactionId: string;
      publicKey: NativeRequestOptions;
    };

export type LoginCaptchaSettings = {
  enabled: boolean;
  nativeRequired: boolean;
  nativeEnabled: boolean;
  provider: "" | "recaptcha" | "enterprise";
  siteKey: string;
  action: string;
  recaptchaV3: boolean;
  useRecaptchaNet: boolean;
  androidSiteKey: string;
  iosSiteKey: string;
};

const publicClient = createMobileApiClient(DEFAULT_NATIVE_API_TIMEOUT_MS);

export async function getLatestReleaseMetadata(): Promise<ReleaseMetadata> {
  try {
    const response = await publicClient.request<ReleaseMetadata>({
      headers: { Accept: "application/json" },
      method: "GET",
      url: "/api/public/app-release",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Release metadata request failed",
        readMobileResponseData(response.data),
      );
    }
    return readMobileResponseData(response.data) as ReleaseMetadata;
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Release metadata request failed",
      getMobileTransportCause(cause),
    );
  }
}

export async function getSocialProviders(
  options: RequestOptions = {},
): Promise<SocialProviderAvailability[]> {
  try {
    const response = await publicClient.request<unknown>({
      headers: {
        Accept: "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "GET",
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      url: "/api/auth/social-providers",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Social provider discovery failed",
        readMobileResponseData(response.data),
        readRetryAfterHeader(response.headers),
      );
    }
    const body = readMobileResponseData(response.data);
    if (!Array.isArray(body)) {
      throw new PublicApiError(502, "Social provider discovery was invalid");
    }
    return body.filter(isSocialProviderAvailability);
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Social provider discovery unavailable",
      getMobileTransportCause(cause),
    );
  }
}

export async function getLoginCaptchaSettings(
  options: RequestOptions = {},
): Promise<LoginCaptchaSettings> {
  try {
    const response = await publicClient.request<unknown>({
      headers: {
        Accept: "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "GET",
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      url: "/api/auth/login-captcha",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Login CAPTCHA settings request failed",
        readMobileResponseData(response.data),
      );
    }
    const value = readMobileResponseData(
      response.data,
    ) as Partial<LoginCaptchaSettings>;
    if (
      typeof value?.enabled !== "boolean" ||
      typeof value.nativeRequired !== "boolean" ||
      typeof value.nativeEnabled !== "boolean" ||
      (value.enabled &&
        value.provider !== "recaptcha" &&
        value.provider !== "enterprise") ||
      (!value.enabled &&
        value.provider !== "" &&
        value.provider !== "recaptcha" &&
        value.provider !== "enterprise") ||
      typeof value.siteKey !== "string" ||
      typeof value.action !== "string" ||
      typeof value.recaptchaV3 !== "boolean" ||
      typeof value.useRecaptchaNet !== "boolean"
    ) {
      throw new PublicApiError(
        502,
        "Login CAPTCHA settings response was invalid",
      );
    }
    return {
      ...(value as LoginCaptchaSettings),
      nativeRequired: value.nativeRequired === true,
      nativeEnabled: value.nativeEnabled === true,
      androidSiteKey:
        typeof value.androidSiteKey === "string" ? value.androidSiteKey : "",
      iosSiteKey: typeof value.iosSiteKey === "string" ? value.iosSiteKey : "",
    };
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Login CAPTCHA settings unavailable",
      getMobileTransportCause(cause),
    );
  }
}

export function startMobileLogin(
  request: {
    platform: "ANDROID" | "IOS";
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    nonce: string;
    username: string;
    password: string;
    captchaToken: string | null;
  },
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>("/api/auth/mobile/login", request, {
    ...options,
  }).then(parseMobileLoginResponse);
}

export function startMobileGoogleLogin(
  request: {
    platform: "ANDROID" | "IOS";
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    nonce: string;
    idToken: string;
  },
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    "/api/auth/mobile/login/google",
    request,
    options,
  ).then(parseMobileLoginResponse);
}

export function startMobilePasskeyLogin(
  request: {
    platform: "ANDROID" | "IOS";
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    nonce: string;
    username: string;
  },
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    "/api/auth/mobile/login/passkey/begin",
    request,
    options,
  ).then(parseMobileLoginResponse);
}

export function verifyMobilePasskeyLogin(
  transactionId: string,
  credential: NativePasskeyCredential,
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/passkey/verify`,
    { credential },
    options,
  ).then(parseMobileLoginResponse);
}

export async function getMobileLoginPasskeyRegistrationOptions(
  transactionId: string,
  actionKey: string,
  options: RequestOptions = {},
): Promise<NativeCreationOptions> {
  const result = await post<{ publicKey: NativeCreationOptions }>(
    `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/actions/${encodeURIComponent(actionKey)}/passkey/options`,
    {},
    options,
  );
  if (!isRecord(result) || !isRecord(result.publicKey)) {
    throw new PublicApiError(
      502,
      "Mobile passkey registration options were invalid",
    );
  }
  return result.publicKey as NativeCreationOptions;
}

export function registerMobileLoginPasskey(
  transactionId: string,
  actionKey: string,
  credential: NativePasskeyCredential,
  label: string,
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/actions/${encodeURIComponent(actionKey)}/passkey/register`,
    { credential, label },
    options,
  ).then(parseMobileLoginResponse);
}

export function submitMobileLoginMfa(
  transactionId: string,
  code: string,
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/mfa`,
    { code },
    options,
  ).then(parseMobileLoginResponse);
}

export function submitMobileLoginAction(
  transactionId: string,
  actionKey: string,
  values: Record<string, unknown>,
  options: RequestOptions = {},
) {
  return post<MobileLoginResponse>(
    `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/actions/${encodeURIComponent(actionKey)}`,
    { values },
    options,
  ).then(parseMobileLoginResponse);
}

export function getMobileLoginMfaSetup(
  transactionId: string,
  options: RequestOptions = {},
) {
  return getMobileLoginSetup<MfaSetup>(
    transactionId,
    "CONFIGURE_TOTP",
    options,
  );
}

export function getMobileLoginRecoveryCodes(
  transactionId: string,
  options: RequestOptions = {},
) {
  return getMobileLoginSetup<{ codes: string[]; remaining: number }>(
    transactionId,
    "RECOVERY_CODES",
    options,
  );
}

async function getMobileLoginSetup<T>(
  transactionId: string,
  actionKey: string,
  options: RequestOptions,
): Promise<T> {
  const path = `/api/auth/mobile/login/${encodeURIComponent(transactionId)}/actions/${encodeURIComponent(actionKey)}/setup`;
  try {
    const response = await publicClient.request<unknown>({
      headers: {
        Accept: "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "POST",
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      url: path,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Mobile login action setup request failed",
        readMobileResponseData(response.data),
        readRetryAfterHeader(response.headers),
      );
    }
    const value = readMobileResponseData(response.data);
    if (actionKey === "CONFIGURE_TOTP" && !isMobileMfaSetup(value)) {
      throw new PublicApiError(502, "Mobile login TOTP setup was invalid");
    }
    if (actionKey === "RECOVERY_CODES" && !isRecoveryCodeSetup(value)) {
      throw new PublicApiError(502, "Mobile login recovery codes were invalid");
    }
    return value as T;
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Mobile login action setup unavailable",
      getMobileTransportCause(cause),
    );
  }
}

function isMobileMfaSetup(value: unknown): value is MfaSetup {
  if (!value || typeof value !== "object") return false;
  const setup = value as Record<string, unknown>;
  return (
    typeof setup.secret === "string" &&
    typeof setup.qrCode === "string" &&
    typeof setup.algorithm === "string" &&
    typeof setup.digits === "number" &&
    Number.isFinite(setup.digits) &&
    typeof setup.periodSeconds === "number" &&
    Number.isFinite(setup.periodSeconds)
  );
}

function isRecoveryCodeSetup(
  value: unknown,
): value is { codes: string[]; remaining: number } {
  if (!value || typeof value !== "object") return false;
  const setup = value as Record<string, unknown>;
  return (
    Array.isArray(setup.codes) &&
    setup.codes.every((code) => typeof code === "string") &&
    typeof setup.remaining === "number" &&
    Number.isFinite(setup.remaining)
  );
}

function parseMobileLoginResponse(value: unknown): MobileLoginResponse {
  if (!value || typeof value !== "object") {
    throw new PublicApiError(502, "Mobile login response was invalid");
  }
  const response = value as Record<string, unknown>;
  if (
    response.status === "authorized" &&
    typeof response.code === "string" &&
    typeof response.state === "string" &&
    typeof response.redirectUri === "string"
  ) {
    return response as MobileLoginResponse;
  }
  if (
    response.status === "mfa_required" &&
    typeof response.transactionId === "string"
  ) {
    return response as MobileLoginResponse;
  }
  if (
    response.status === "required_actions" &&
    typeof response.transactionId === "string" &&
    Array.isArray(response.actions) &&
    response.actions.every(isMobileLoginAction)
  ) {
    return response as MobileLoginResponse;
  }
  if (
    response.status === "passkey_required" &&
    typeof response.transactionId === "string" &&
    isRecord(response.publicKey)
  ) {
    return response as MobileLoginResponse;
  }
  throw new PublicApiError(502, "Mobile login response was invalid");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMobileLoginAction(value: unknown): value is MobileLoginAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  return (
    typeof action.key === "string" &&
    typeof action.displayName === "string" &&
    typeof action.description === "string" &&
    typeof action.version === "number" &&
    Number.isFinite(action.version)
  );
}

function isSocialProviderAvailability(
  value: unknown,
): value is SocialProviderAvailability {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.provider === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(candidate.provider) &&
    typeof candidate.providerType === "string" &&
    typeof candidate.iconKey === "string" &&
    typeof candidate.configured === "boolean"
  );
}

async function post<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
) {
  try {
    const response = await publicClient.request<T>({
      data: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...(options.mobilePlatform
          ? { "X-Mobile-Platform": options.mobilePlatform }
          : {}),
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "POST",
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      url: path,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Public account request failed",
        readMobileResponseData(response.data),
        readRetryAfterHeader(response.headers),
      );
    }
    if (response.status === 204 || response.status === 201) {
      return undefined as T;
    }
    return readMobileResponseData(response.data) as T;
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Network request failed",
      getMobileTransportCause(cause),
    );
  }
}

export async function getCaptchaSettings(
  options: RequestOptions = {},
): Promise<CaptchaSettings> {
  try {
    const response = await publicClient.request<unknown>({
      method: "GET",
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      url: "/api/auth/registration-captcha",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Registration CAPTCHA settings request failed",
        readMobileResponseData(response.data),
        readRetryAfterHeader(response.headers),
      );
    }
    const value = readMobileResponseData(response.data) as
      | Partial<CaptchaSettings>
      | null;
    if (
      typeof value?.enabled !== "boolean" ||
      typeof value.nativeRequired !== "boolean" ||
      typeof value.nativeEnabled !== "boolean" ||
      typeof value.siteKey !== "string" ||
      typeof value.action !== "string"
    ) {
      throw new PublicApiError(
        502,
        "Registration CAPTCHA settings response was invalid",
      );
    }
    return {
      enabled: value.enabled,
      nativeRequired: value.nativeRequired === true,
      nativeEnabled: value.nativeEnabled === true,
      provider:
        value.provider === "enterprise" || value.provider === "recaptcha"
          ? value.provider
          : "",
      siteKey: value.siteKey,
      action: value.action,
      recaptchaV3: value.recaptchaV3 === true,
      useRecaptchaNet: value.useRecaptchaNet === true,
      androidSiteKey:
        typeof value.androidSiteKey === "string" ? value.androidSiteKey : "",
      iosSiteKey: typeof value.iosSiteKey === "string" ? value.iosSiteKey : "",
    };
  } catch (cause) {
    if (cause instanceof PublicApiError) throw cause;
    throw new PublicApiError(
      0,
      "Registration CAPTCHA settings unavailable",
      getMobileTransportCause(cause),
    );
  }
}

export function registerAccount(
  request: {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    captchaToken?: string | null;
    mobilePlatform?: "ANDROID" | "IOS";
    locale: string;
  },
  options: Omit<RequestOptions, "locale"> = {},
) {
  const { mobilePlatform, ...body } = request;
  return post<void>("/api/auth/register", body, {
    ...options,
    mobilePlatform,
    locale: request.locale,
  });
}

export function requestPasswordReset(
  identifier: string,
  locale: string,
  options: Omit<RequestOptions, "locale"> = {},
) {
  return post<void>(
    "/api/auth/forgot-password",
    { identifier, locale },
    { ...options, locale },
  );
}

export function resetPassword(
  request: { token: string; newPassword: string; otpCode?: string },
  options: RequestOptions = {},
) {
  return post<void>("/api/auth/reset-password", request, options);
}

export function verifyEmail(token: string, options: RequestOptions = {}) {
  return post<void>("/api/auth/verify-email", { token }, options);
}

export function confirmEmail(token: string, options: RequestOptions = {}) {
  return post<void>("/api/auth/confirm-email", { token }, options);
}
