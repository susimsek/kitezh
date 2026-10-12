import * as SecureStore from "expo-secure-store";

import { createSessionStorage } from "./session-storage";

export { sessionStorageKey } from "./session-keys";
export type { MobileSessionNamespace } from "./session-keys";
export type { MobileSession } from "./session-storage";

const nativeSessionStorage = createSessionStorage(SecureStore);

export const readSession = nativeSessionStorage.readSession;
export const writeSession = nativeSessionStorage.writeSession;
export const clearSession = nativeSessionStorage.clearSession;
