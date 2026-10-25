type PreferenceStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

const PREFERENCE_STORAGE_TIMEOUT_MS = 5_000;

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("preference_storage_timeout")),
      timeoutMs,
    );
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function createPreferenceStorage<T extends string>(
  store: PreferenceStore,
  key: string,
  isAllowed: (value: string | null) => value is T,
  timeoutMs = PREFERENCE_STORAGE_TIMEOUT_MS,
) {
  let pendingWrite: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>) => {
    const nextWrite = pendingWrite.then(operation, operation);
    pendingWrite = nextWrite.catch(() => undefined);
    return withTimeout(nextWrite, timeoutMs);
  };

  return {
    read: async (): Promise<T | null> => {
      const value = await withTimeout(store.getItemAsync(key), timeoutMs);
      return isAllowed(value) ? value : null;
    },
    save: (value: T) => enqueue(() => store.setItemAsync(key, value)),
    reset: () => enqueue(() => store.deleteItemAsync(key)),
  };
}
