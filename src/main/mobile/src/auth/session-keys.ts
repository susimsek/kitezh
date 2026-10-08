import type { NativeSessionNamespace } from "../../../shared/src/api.ts";

export type MobileSessionNamespace = NativeSessionNamespace;

export function sessionStorageKey(
  namespace: MobileSessionNamespace = "account",
) {
  return `kitezh.mobile.${namespace}.session`;
}
