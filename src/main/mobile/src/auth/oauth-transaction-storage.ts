import type { MobileSessionNamespace } from "./session-keys.ts";

const TRANSACTION_SCHEMA_VERSION = 1;
export const OAUTH_TRANSACTION_MAX_AGE_MS = 5 * 60_000;

export type PendingOAuthTransaction = {
  clientId: string;
  codeVerifier: string;
  createdAt: number;
  redirectUri: string;
  state: string;
};

type TransactionStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

function transactionKey(namespace: MobileSessionNamespace) {
  return `kitezh.mobile.${namespace}.oauth-transaction`;
}

export function createOAuthTransactionStorage(store: TransactionStore) {
  const consuming = new Set<string>();

  return {
    async save(
      namespace: MobileSessionNamespace,
      transaction: PendingOAuthTransaction,
    ) {
      await store.setItemAsync(
        transactionKey(namespace),
        JSON.stringify({
          schemaVersion: TRANSACTION_SCHEMA_VERSION,
          transaction,
        }),
      );
    },

    async consume(
      namespace: MobileSessionNamespace,
      expected: Pick<PendingOAuthTransaction, "clientId" | "redirectUri">,
      now = Date.now(),
    ): Promise<PendingOAuthTransaction | null> {
      const key = transactionKey(namespace);
      if (consuming.has(key)) return null;
      consuming.add(key);
      try {
        const stored = await store.getItemAsync(key);
        if (!stored) return null;

        // Delete before validating or exchanging: a callback can be consumed once.
        await store.deleteItemAsync(key);
        let parsed: unknown;
        try {
          parsed = JSON.parse(stored);
        } catch {
          return null;
        }
        if (!parsed || typeof parsed !== "object") return null;
        const envelope = parsed as {
          schemaVersion?: unknown;
          transaction?: Partial<PendingOAuthTransaction>;
        };
        const transaction = envelope.transaction;
        if (
          envelope.schemaVersion !== TRANSACTION_SCHEMA_VERSION ||
          transaction?.clientId !== expected.clientId ||
          transaction.redirectUri !== expected.redirectUri ||
          typeof transaction.state !== "string" ||
          transaction.state.length < 8 ||
          transaction.state.length > 512 ||
          typeof transaction.codeVerifier !== "string" ||
          !/^[A-Za-z0-9._~-]{43,128}$/.test(transaction.codeVerifier) ||
          typeof transaction.createdAt !== "number" ||
          !Number.isFinite(transaction.createdAt) ||
          now < transaction.createdAt ||
          now - transaction.createdAt > OAUTH_TRANSACTION_MAX_AGE_MS
        ) {
          return null;
        }
        return transaction as PendingOAuthTransaction;
      } finally {
        consuming.delete(key);
      }
    },

    clear(namespace: MobileSessionNamespace) {
      return store.deleteItemAsync(transactionKey(namespace));
    },
  };
}
