export type MobileSessionNamespace = "account" | "admin";

export function sessionStorageKey(
  namespace: MobileSessionNamespace = "account",
) {
  return `kitezh.mobile.${namespace}.session`;
}
