import * as SecureStore from "expo-secure-store";

import { createSessionStorage } from "./session-storage";
import { createOAuthTransactionStorage } from "./oauth-transaction-storage";

export { sessionStorageKey } from "./session-keys";
export type { MobileSessionNamespace } from "./session-keys";
export type { MobileSession } from "./session-storage";

const nativeSessionStorage = createSessionStorage(SecureStore);
const nativeOAuthTransactionStorage =
  createOAuthTransactionStorage(SecureStore);

export const readSession = nativeSessionStorage.readSession;
export const writeSession = nativeSessionStorage.writeSession;
export const clearSession = nativeSessionStorage.clearSession;
export const saveOAuthTransaction = nativeOAuthTransactionStorage.save;
export const consumeOAuthTransaction = nativeOAuthTransactionStorage.consume;
export const clearOAuthTransaction = nativeOAuthTransactionStorage.clear;
