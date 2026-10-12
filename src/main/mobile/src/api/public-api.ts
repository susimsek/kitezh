import type { SocialProviderAvailability } from "../../../shared/src/contracts.ts";
import {
  classifyApiError,
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

export class PublicApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.data = data;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
  }
}

type RequestOptions = { locale?: string };

export type CaptchaSettings = { enabled: boolean };
export type { SocialProviderAvailability };

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
      url: path,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Public account request failed",
        readMobileResponseData(response.data),
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
      getMobileTransportCause(cause, false),
    );
  }
}

export async function getCaptchaSettings(): Promise<CaptchaSettings> {
  try {
    const response = await publicClient.request<{ enabled?: unknown }>({
      method: "GET",
      url: "/api/auth/registration-captcha",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PublicApiError(
        response.status,
        "Registration CAPTCHA settings request failed",
        readMobileResponseData(response.data),
      );
    }
    const value = readMobileResponseData(response.data) as {
      enabled?: unknown;
    };
    return { enabled: value.enabled === true };
  } catch {
    throw new PublicApiError(0, "Registration CAPTCHA settings unavailable");
  }
}

export function registerAccount(request: {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  captchaToken?: string | null;
  locale: string;
}) {
  return post<void>("/api/auth/register", request, { locale: request.locale });
}

export function requestPasswordReset(identifier: string, locale: string) {
  return post<void>(
    "/api/auth/forgot-password",
    { identifier, locale },
    { locale },
  );
}

export function resetPassword(request: {
  token: string;
  newPassword: string;
  otpCode?: string;
}) {
  return post<void>("/api/auth/reset-password", request);
}

export function verifyEmail(token: string) {
  return post<void>("/api/auth/verify-email", { token });
}
