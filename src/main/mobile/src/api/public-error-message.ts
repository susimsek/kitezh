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
  | "apiValidation";

export function publicErrorMessage(
  kind: ApiErrorKind | undefined,
  dictionary: Pick<Dictionary, PublicErrorMessageKey>,
  fallback: PublicErrorFallback,
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
    default:
      return dictionary[fallback];
  }
}
