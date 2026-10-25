import { Passkey } from "react-native-passkey";

import {
  assertionCredentialJson,
  registrationCredentialJson,
  type NativePasskeyCredential,
} from "@/auth/native-passkey-contract";

export type { NativePasskeyCredential } from "@/auth/native-passkey-contract";

export type NativeCreationOptions = Parameters<typeof Passkey.create>[0];
export type NativeRequestOptions = Parameters<typeof Passkey.get>[0];

export function isNativePasskeySupported(): boolean {
  return Passkey.isSupported();
}

export async function createNativePasskey(
  options: NativeCreationOptions,
): Promise<NativePasskeyCredential> {
  ensureSupported();
  return registrationCredentialJson(await Passkey.create(options));
}

export async function getNativePasskey(
  options: NativeRequestOptions,
): Promise<NativePasskeyCredential> {
  ensureSupported();
  return assertionCredentialJson(await Passkey.get(options));
}

function ensureSupported(): void {
  if (!Passkey.isSupported()) {
    throw new Error("native-passkey-not-supported");
  }
}
