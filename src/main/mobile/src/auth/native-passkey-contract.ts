import type {
  PasskeyCreateResult,
  PasskeyGetResult,
} from "react-native-passkey";

export type NativePasskeyCredential = {
  id: string;
  rawId: string;
  type: "public-key";
  authenticatorAttachment: string | null;
  clientExtensionResults: Record<string, unknown>;
  response: Record<string, unknown>;
};

export function registrationCredentialJson(
  result: PasskeyCreateResult,
): NativePasskeyCredential {
  return {
    id: result.id,
    rawId: result.rawId,
    type: "public-key",
    authenticatorAttachment: result.authenticatorAttachment ?? null,
    clientExtensionResults: result.clientExtensionResults ?? {},
    response: {
      attestationObject: result.response.attestationObject,
      clientDataJSON: result.response.clientDataJSON,
      transports: result.response.transports ?? [],
    },
  };
}

export function assertionCredentialJson(
  result: PasskeyGetResult,
): NativePasskeyCredential {
  return {
    id: result.id,
    rawId: result.rawId ?? result.id,
    type: "public-key",
    authenticatorAttachment: result.authenticatorAttachment ?? null,
    clientExtensionResults: result.clientExtensionResults ?? {},
    response: {
      authenticatorData: result.response.authenticatorData,
      clientDataJSON: result.response.clientDataJSON,
      signature: result.response.signature,
      userHandle: result.response.userHandle ?? null,
    },
  };
}
