import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parsePendingAuthorizationStore,
  type PendingAuthorizationStore,
} from "./auth-flow";

export type SecureStorageCodec = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

function assertSecureStorage(storage: SecureStorageCodec) {
  if (!storage.isEncryptionAvailable()) {
    throw new Error("Secure desktop storage is unavailable");
  }
}

export async function writePendingAuthorizationStore(
  file: string,
  store: PendingAuthorizationStore,
  storage: SecureStorageCodec,
) {
  assertSecureStorage(storage);
  if (Object.keys(store).length === 0) {
    await rm(file, { force: true });
    return;
  }

  await mkdir(path.dirname(file), { recursive: true });
  const encoded = storage
    .encryptString(JSON.stringify(store))
    .toString("base64");
  const temporaryFile = `${file}.tmp`;
  try {
    await writeFile(temporaryFile, encoded, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

export async function readPendingAuthorizationStore(
  file: string,
  storage: SecureStorageCodec,
  now = Date.now(),
): Promise<PendingAuthorizationStore> {
  assertSecureStorage(storage);
  if (!existsSync(file)) return {};
  const encoded = await readFile(file, "utf8");
  const plaintext = storage.decryptString(Buffer.from(encoded, "base64"));
  return parsePendingAuthorizationStore(JSON.parse(plaintext), now);
}
