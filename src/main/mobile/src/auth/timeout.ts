export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorCode: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}
