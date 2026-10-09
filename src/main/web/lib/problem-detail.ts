import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export type ApiProblem = {
  detail?: string;
  errorCode?: string;
  field?: string;
  violations?: Array<{ field: string; message?: string | null }>;
};

export type ApiViolation = { field: string; message?: string | null };

type ProblemMessage =
  string | ((violation: ApiViolation, problem: ApiProblem) => string | undefined);

export type AppliedProblemErrors = {
  handled: ApiViolation[];
  unhandled: ApiViolation[];
  firstField?: string;
};

export function problemViolations(data: unknown): ApiViolation[] {
  if (typeof data !== "object" || data === null) return [];
  const problem = data as ApiProblem;
  if (Array.isArray(problem.violations)) {
    return problem.violations.filter(
      (violation): violation is ApiViolation =>
        typeof violation === "object" &&
        violation !== null &&
        typeof violation.field === "string" &&
        violation.field.length > 0,
    );
  }
  return typeof problem.field === "string"
    ? [
        {
          field: problem.field,
          message: typeof problem.detail === "string" ? problem.detail : undefined,
        },
      ]
    : [];
}

export function applyProblemToForm<T extends FieldValues>(
  data: unknown,
  setError: UseFormSetError<T>,
  options: {
    fields?: readonly string[];
    fallbackMessage?: ProblemMessage;
  } = {},
): AppliedProblemErrors {
  const problem = (typeof data === "object" && data !== null ? data : {}) as ApiProblem;
  const allowedFields = options.fields ? new Set(options.fields) : undefined;
  const handled: ApiViolation[] = [];
  const unhandled: ApiViolation[] = [];

  for (const violation of problemViolations(data)) {
    if (allowedFields && !allowedFields.has(violation.field)) {
      unhandled.push(violation);
      continue;
    }
    const message =
      violation.message ??
      (typeof options.fallbackMessage === "function"
        ? options.fallbackMessage(violation, problem)
        : options.fallbackMessage);
    setError(violation.field as Path<T>, { type: "server", message });
    handled.push(violation);
  }

  return { handled, unhandled, firstField: handled[0]?.field };
}

export function problemErrorCode(data: unknown) {
  if (typeof data !== "object" || data === null || !("errorCode" in data)) return undefined;
  const { errorCode } = data as ApiProblem;
  return typeof errorCode === "string" ? errorCode : undefined;
}
