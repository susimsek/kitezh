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
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type CaptchaSettings = { enabled: boolean };
export type { SocialProviderAvailability } from "../../../shared/src/contracts.ts";

const publicClient = createMobileApiClient(DEFAULT_NATIVE_API_TIMEOUT_MS);

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
    const response = await publicClient.request<{ enabled?: unknown }>({
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
    const value = readMobileResponseData(response.data) as {
      enabled?: unknown;
    };
    if (typeof value?.enabled !== "boolean") {
      throw new PublicApiError(
        502,
        "Registration CAPTCHA settings response was invalid",
      );
    }
    return { enabled: value.enabled };
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
  request: { token: string; newPassword: string; otpCode?: string },
  options: RequestOptions = {},
) {
  return post<void>("/api/auth/reset-password", request, options);
}

export function verifyEmail(token: string, options: RequestOptions = {}) {
  return post<void>("/api/auth/verify-email", { token }, options);
}
