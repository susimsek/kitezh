const SENSITIVE_KEYS =
  "access[_-]?token|refresh[_-]?token|id[_-]?token(?:[_-]?hint)?|client[_-]?(?:secret|id)|api[_-]?key|authorization(?:[_-]?(?:code|header))?|cookie|set[_-]?cookie|code(?:[_-]?verifier)?|password|username|email|subject|provider[_-]?subject|user[_-]?id|principal|session(?:[_-]?id)?|csrf|xsrf|nonce|state|transaction|ticket|assertion|samlresponse|first[_-]?name|last[_-]?name|given[_-]?name|family[_-]?name|phone|mobile|address|birth[_-]?date|date[_-]?of[_-]?birth";

export function appendBoundedDiagnosticLine(
  current: string,
  line: string,
  maxBytes: number,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return "";
  const entries = `${current}${line}`.split("\n").filter(Boolean);
  const retained: string[] = [];
  let byteCount = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const entryBytes = Buffer.byteLength(entry, "utf8");
    const separatorBytes = retained.length ? 1 : 0;
    if (entryBytes > maxBytes) continue;
    if (byteCount + entryBytes + separatorBytes > maxBytes) {
      break;
    }
    retained.push(entry);
    byteCount += entryBytes + separatorBytes;
  }
  return retained.length ? `${retained.reverse().join("\n")}\n` : "";
}

export function redactDiagnosticText(value: string) {
  return value
    .replace(
      /\bAuthorization\s*[:=]\s*Bearer\s+[^\s,;]+/gi,
      "Authorization: Bearer [redacted]",
    )
    .replace(
      new RegExp(
        String.raw`(["']?(?:${SENSITIVE_KEYS})["']?\s*[=:]\s*)(["'])(.*?)\2`,
        "gi",
      ),
      "$1[redacted]",
    )
    .replace(
      new RegExp(
        String.raw`(["']?(?:${SENSITIVE_KEYS})["']?\s*[=:]\s*)[^\s&,;]+`,
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
