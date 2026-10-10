export function redactDiagnosticText(value: string) {
  return value
    .replace(
      /((?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization|cookie|code)=)[^\s&]+/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:"|'?)(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization|cookie|code)(?:"|'?)\s*:\s*["'])([^"']*)(["'])/gi,
      "$1[redacted]$3",
    )
    .replace(/https?:\/\/[^\s]+/gi, (urlValue) => {
      try {
        const url = new URL(urlValue);
        return `${url.origin}${url.pathname}`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s]+/g, "[user-path]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .slice(0, 500);
}
