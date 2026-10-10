const SENSITIVE_KEYS =
  "access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization(?:[_-]?code)?|cookie|code(?:[_-]?verifier)?|password|username|email|subject|user[_-]?id";

export function redactDiagnosticText(value: string) {
  return value
    .replace(
      new RegExp(`((?:${SENSITIVE_KEYS})\\s*[=:]\\s*)[^\\s&,;]+`, "gi"),
      "$1[redacted]",
    )
    .replace(
      new RegExp(
        `(["']?(?:${SENSITIVE_KEYS})["']?\\s*:\\s*["'])([^"']*)(["'])`,
        "gi",
      ),
      "$1[redacted]$3",
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s]+/g, "[user-path]")
    .slice(0, 500);
}
