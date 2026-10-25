import type { Dictionary } from "@kitezh/shared/i18n";
import type { ApiErrorKind } from "../../../shared/src/api.ts";

type PublicErrorFallback =
  | "registrationError"
  | "forgotError"
  | "resetError"
  | "verifyEmailError";
type PublicErrorMessageKey =
  | PublicErrorFallback
  | "apiOffline"
  | "apiTimeout"
  | "apiUnauthorized"
  | "apiForbidden"
  | "apiValidation"
  | "apiCancelled"
  | "apiConflict"
  | "apiRateLimited"
  | "apiUnavailable"
  | "apiServer"
  | "apiHttp";

type ApiErrorMessages = Pick<Dictionary, PublicErrorMessageKey>;

export function apiErrorMessage(
  kind: ApiErrorKind | undefined,
  dictionary: ApiErrorMessages,
  fallback: string,
): string {
  switch (kind) {
    case "offline":
      return dictionary.apiOffline;
    case "timeout":
      return dictionary.apiTimeout;
    case "unauthorized":
      return dictionary.apiUnauthorized;
    case "forbidden":
      return dictionary.apiForbidden;
    case "validation":
      return dictionary.apiValidation;
    case "cancelled":
      return dictionary.apiCancelled;
    case "conflict":
      return dictionary.apiConflict;
    case "rate-limited":
      return dictionary.apiRateLimited;
    case "unavailable":
      return dictionary.apiUnavailable;
    case "server":
      return dictionary.apiServer;
    case "http":
      return dictionary.apiHttp;
    default:
      return fallback;
  }
}

export function publicErrorMessage(
  kind: ApiErrorKind | undefined,
  dictionary: ApiErrorMessages,
  fallback: PublicErrorFallback,
): string {
  return apiErrorMessage(kind, dictionary, dictionary[fallback]);
}
