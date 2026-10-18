import * as SecureStore from "expo-secure-store";

import { createSessionStorage } from "./session-storage";
import type { MobileSession } from "./session-storage";
import { createOAuthTransactionStorage } from "./oauth-transaction-storage";
import { runSessionStorageMutation } from "./session-operations";
import type { MobileSessionNamespace } from "./session-keys";

export { sessionStorageKey } from "./session-keys";
export type { MobileSessionNamespace } from "./session-keys";
export type { MobileSession } from "./session-storage";

const nativeSessionStorage = createSessionStorage(SecureStore);
const nativeOAuthTransactionStorage =
  createOAuthTransactionStorage(SecureStore);

export const readSession = nativeSessionStorage.readSession;
export const writeSession = (
  session: MobileSession,
  namespace: MobileSessionNamespace = "account",
) =>
  runSessionStorageMutation(namespace, () =>
    nativeSessionStorage.writeSession(session, namespace),
  );
export const writeSessionIfCurrent = (
  session: MobileSession,
  namespace: MobileSessionNamespace,
  generation: number,
) =>
  runSessionStorageMutation(
    namespace,
    async () => {
      await nativeSessionStorage.writeSession(session, namespace);
      return true;
    },
    generation,
  );
export const clearSession = (
  namespace: MobileSessionNamespace = "account",
) =>
  runSessionStorageMutation(namespace, () =>
    nativeSessionStorage.clearSession(namespace),
  );
export const clearSessionIfCurrent = (
  namespace: MobileSessionNamespace,
  generation: number,
) =>
  runSessionStorageMutation(
    namespace,
    async () => {
      await nativeSessionStorage.clearSession(namespace);
      return true;
    },
    generation,
  );
export const saveOAuthTransaction = nativeOAuthTransactionStorage.save;
export const consumeOAuthTransaction = nativeOAuthTransactionStorage.consume;
export const clearOAuthTransaction = nativeOAuthTransactionStorage.clear;
