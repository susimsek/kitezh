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
  | "cancelled"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "rate-limited"
  | "conflict"
  | "unavailable"
  | "update"
  | "server"
  | "http";

export const DEFAULT_NATIVE_API_TIMEOUT_MS = 15_000;

export function parseRetryAfterMs(
  value: unknown,
  now = Date.now(),
): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function readRetryAfterHeader(headers: unknown): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const candidate = headers as {
    get?: (name: string) => unknown;
    [name: string]: unknown;
  };
  const getterValue = candidate.get?.("retry-after");
  if (typeof getterValue === "string") return getterValue;
  const key = Object.keys(candidate).find(
    (name) => name.toLowerCase() === "retry-after",
  );
  const value = key ? candidate[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

export type NativeRequestSignal = {
  signal: AbortSignal;
  dispose: () => void;
};

export function createNativeRequestSignal(
  timeoutMs = DEFAULT_NATIVE_API_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): NativeRequestSignal {
  const controller = new AbortController();
  const timeoutError = Object.assign(
    new Error("Native API request timed out"),
    { name: "TimeoutError" },
  );
  const timeout = setTimeout(() => {
    controller.abort(timeoutError);
  }, timeoutMs);
  const abortFromParent = () => controller.abort();

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

export function classifyApiError(
  status: number,
  cause?: unknown,
): ApiErrorKind {
  if (status === 0) {
    if (cause instanceof Error && cause.name === "AbortError") {
      return "cancelled";
    }
    return cause instanceof Error && cause.name === "TimeoutError"
      ? "timeout"
      : "offline";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 422) return "validation";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limited";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
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

export function problemFieldErrors(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const candidate = value as { problem?: unknown };
  const problem = parseProblemDetail(candidate.problem);
  return Object.fromEntries(
    (problem?.violations ?? []).map(({ field, message }) => [field, message]),
  );
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
  locale?: "en" | "tr";
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
};

export type NativeApiResponse = {
  status: number;
  kind: ApiErrorKind | null;
  body: unknown;
};
