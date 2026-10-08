import { authorizationServerIssuer } from "@/config";
import type { SocialProviderAvailability } from "@kitezh/shared/contracts";

export class PublicApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = { locale?: string };

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
  try {
    response = await fetch(apiUrl(path), {
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.locale ? { "Accept-Language": options.locale } : {}),
      },
      method: "POST",
    });
  } catch (cause) {
    throw new PublicApiError(0, "Network request failed", cause);
  }
  if (!response.ok) {
    throw new PublicApiError(
      response.status,
      "Public account request failed",
      await readError(response),
    );
  }
  if (response.status === 204 || response.status === 201) return undefined as T;
  return (await response.json()) as T;
}

export async function getCaptchaSettings(): Promise<CaptchaSettings> {
  try {
    const response = await fetch(apiUrl("/api/auth/registration-captcha"), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new PublicApiError(
        response.status,
        "Registration CAPTCHA settings request failed",
        await readError(response),
      );
    }
    const value = (await response.json()) as { enabled?: unknown };
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
