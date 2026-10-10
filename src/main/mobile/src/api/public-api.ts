import { authorizationServerIssuer } from "../config.ts";
import type { SocialProviderAvailability } from "../../../shared/src/contracts.ts";
import {
  classifyApiError,
  createNativeRequestSignal,
  DEFAULT_NATIVE_API_TIMEOUT_MS,
  parseProblemDetail,
  parseRetryAfterSeconds,
  type ApiErrorKind,
  type ProblemDetail,
} from "../../../shared/src/api.ts";

export class PublicApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.data = data;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
    this.retryAfterSeconds = retryAfterSeconds ?? this.problem?.retryAfterSeconds;
  }
}

type RequestOptions = {
  locale?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CaptchaSettings = { enabled: boolean };
export type { SocialProviderAvailability };

function apiUrl(path: string) {
  return `${authorizationServerIssuer.replace(/\/$/, "")}${path}`;
}

async function readError(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function post<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
) {
  let response: Response;
  const requestSignal = createNativeRequestSignal(
    options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
    options.signal,
  );
  try {
    response = await fetch(apiUrl(path), {
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "POST",
      signal: requestSignal.signal,
    });
  } catch (cause) {
    const failure = requestSignal.timedOut()
      ? Object.assign(new Error("Native API request timed out"), {
          name: "TimeoutError",
        })
      : cause;
    throw new PublicApiError(0, "Public account request failed", failure);
  } finally {
    requestSignal.dispose();
  }
  if (!response.ok) {
    throw new PublicApiError(
      response.status,
      "Public account request failed",
      await readError(response),
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  }
  if (response.status === 204 || response.status === 201) return undefined as T;
  return (await response.json()) as T;
}

export async function getCaptchaSettings(
  options: RequestOptions = {},
): Promise<CaptchaSettings> {
  const value = await get<unknown>("/api/auth/registration-captcha", options);
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { enabled?: unknown }).enabled !== "boolean"
  ) {
    throw new PublicApiError(502, "Registration CAPTCHA response was invalid");
  }
  return { enabled: (value as { enabled: boolean }).enabled };
}

async function get<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestSignal = createNativeRequestSignal(
    options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
    options.signal,
  );
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      headers: {
        Accept: "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      signal: requestSignal.signal,
    });
  } catch (cause) {
    const failure = requestSignal.timedOut()
      ? Object.assign(new Error("Native API request timed out"), {
          name: "TimeoutError",
        })
      : cause;
    throw new PublicApiError(0, "Public account request failed", failure);
  } finally {
    requestSignal.dispose();
  }
  if (!response.ok) {
    throw new PublicApiError(
      response.status,
      "Public account request failed",
      await readError(response),
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  }
  return (await response.json()) as T;
}

export async function getSocialProviders(
  options: RequestOptions = {},
): Promise<SocialProviderAvailability[]> {
  const providers = await get<unknown>("/api/auth/social-providers", options);
  if (!Array.isArray(providers)) {
    throw new PublicApiError(502, "Social provider response was invalid");
  }
  const allowedIcons = new Set([
    "generic",
    "google",
    "github",
    "linkedin",
    "microsoft",
    "building",
    "key",
    "shield",
  ]);
  return providers.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const provider = value as Record<string, unknown>;
    if (
      typeof provider.provider !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(provider.provider) ||
      typeof provider.providerType !== "string" ||
      typeof provider.iconKey !== "string" ||
      !allowedIcons.has(provider.iconKey) ||
      typeof provider.configured !== "boolean"
    ) {
      return [];
    }
    return [
      {
        provider: provider.provider,
        providerType: provider.providerType,
        iconKey: provider.iconKey,
        configured: provider.configured,
      },
    ];
  });
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
    locale: string;
  },
  options: Omit<RequestOptions, "locale"> = {},
) {
  return post<void>("/api/auth/register", request, {
    ...options,
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
  request: {
    token: string;
    newPassword: string;
    otpCode?: string;
  },
  options: RequestOptions = {},
) {
  return post<void>("/api/auth/reset-password", request, options);
}

export function verifyEmail(token: string, options: RequestOptions = {}) {
  return post<void>("/api/auth/verify-email", { token }, options);
}
