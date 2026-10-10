const SENSITIVE_KEYS =
  "access[_-]?token|refresh[_-]?token|id[_-]?token(?:[_-]?hint)?|client[_-]?(?:secret|id)|api[_-]?key|authorization(?:[_-]?(?:code|header))?|cookie|set[_-]?cookie|code(?:[_-]?verifier)?|password|username|email|subject|provider[_-]?subject|user[_-]?id|principal|session(?:[_-]?id)?|csrf|xsrf|nonce|state|transaction|ticket|assertion|samlresponse|first[_-]?name|last[_-]?name|given[_-]?name|family[_-]?name|phone|mobile|address|birth[_-]?date|date[_-]?of[_-]?birth";

export function redactDiagnosticText(value: string) {
  return value
    .replace(
      /\bAuthorization\s*[:=]\s*Bearer\s+[^\s,;]+/gi,
      "Authorization: Bearer [redacted]",
    )
    .replace(
      new RegExp(
        `(["']?(?:${SENSITIVE_KEYS})["']?\\s*[=:]\\s*)(["'])(.*?)\\2`,
        "gi",
      ),
      "$1[redacted]",
    )
    .replace(
      new RegExp(
        `(["']?(?:${SENSITIVE_KEYS})["']?\\s*[=:]\\s*)[^\\s&,;]+`,
        "gi",
      ),
      "$1[redacted]",
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(
      /(?:\/users\/|\/home\/|[A-Z]:\\(?:users|documents and settings)\\)[^\s"'<>]+/gi,
      "[user-path]",
    )
    .slice(0, 500);
}
