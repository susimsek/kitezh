/**
 * Platform-neutral HTTP error and session contracts.
 *
 * Native adapters translate transport failures into these values. UI layers
 * should branch on `kind` and `status`, never on a platform-specific Error
 * implementation or a response body shape.
 */
export type ProblemViolation = {
  field: string;
  message: string;
};

export type ProblemDetail = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  violations?: ProblemViolation[];
};

export type ApiErrorKind =
  | "offline"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "rate-limited"
  | "server"
  | "http";

export function classifyApiError(status: number, cause?: unknown): ApiErrorKind {
  if (status === 0) {
    return cause instanceof Error && cause.name === "AbortError"
      ? "timeout"
      : "offline";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server";
  return "http";
}

export function parseProblemDetail(value: unknown): ProblemDetail | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const violations = Array.isArray(record.violations)
    ? record.violations.flatMap((violation) => {
        if (!violation || typeof violation !== "object") return [];
        const item = violation as Record<string, unknown>;
        return typeof item.field === "string" &&
          typeof item.message === "string"
          ? [{ field: item.field, message: item.message }]
          : [];
      })
    : undefined;
  return {
    type: typeof record.type === "string" ? record.type : undefined,
    title: typeof record.title === "string" ? record.title : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
    detail: typeof record.detail === "string" ? record.detail : undefined,
    violations,
  };
}

export type NativeSession = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
};

export type NativeSessionNamespace = "account" | "admin";

export type NativeApiRequest = {
  console: NativeSessionNamespace;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
};

export type NativeApiResponse = {
  status: number;
  kind: ApiErrorKind | null;
  body: unknown;
};
