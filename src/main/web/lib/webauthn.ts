type WebAuthnRequest = (url: string, init?: RequestInit) => Promise<ResponseLike>;

type ResponseLike = {
  status: number;
  data: unknown;
  url?: string;
  redirectUrl?: string | null;
};

type CreationOptions = {
  challenge: string;
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: Array<{ id: string; type: "public-key"; transports?: string[] }>;
  [key: string]: unknown;
};

type RequestOptions = {
  challenge: string;
  rpId?: string;
  timeout?: number;
  allowCredentials?: Array<{ id: string; type: "public-key"; transports?: string[] }>;
  [key: string]: unknown;
};

export async function registerPasskey(request: WebAuthnRequest, label: string) {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("WebAuthn is not supported by this browser.");
  }
  const optionsResponse = await request("/webauthn/register/options", { method: "POST" });
  if (optionsResponse.status >= 300) throw new Error("Passkey options could not be loaded.");
  const options = optionsResponse.data as CreationOptions;
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: decode(options.challenge),
      user: { ...options.user, id: decode(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((value) => ({
        ...value,
        id: decode(value.id),
      })),
    } as PublicKeyCredentialCreationOptions,
  });
  if (!credential || credential.type !== "public-key") {
    throw new Error("No passkey was created.");
  }
  const publicKey = credential as globalThis.PublicKeyCredential;
  const response = publicKey.response as AuthenticatorAttestationResponse;
  const registrationResponse = await request("/webauthn/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: {
        credential: {
          id: publicKey.id,
          rawId: encode(publicKey.rawId),
          response: {
            attestationObject: encode(response.attestationObject),
            clientDataJSON: encode(response.clientDataJSON),
            transports: response.getTransports?.(),
          },
          type: publicKey.type,
          clientExtensionResults: publicKey.getClientExtensionResults(),
          authenticatorAttachment: publicKey.authenticatorAttachment,
        },
        label,
      },
    }),
  });
  if (registrationResponse.status >= 300) {
    throw new Error("Passkey could not be registered.");
  }
}

export async function authenticatePasskey(
  request: WebAuthnRequest,
  requestOptions: { mediation?: CredentialMediationRequirement; signal?: AbortSignal } = {},
) {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("WebAuthn is not supported by this browser.");
  }
  const optionsResponse = await request("/webauthn/authenticate/options", { method: "POST" });
  if (optionsResponse.status >= 300) throw new Error("Passkey options could not be loaded.");
  const options = optionsResponse.data as RequestOptions;
  const credential = await navigator.credentials.get({
    mediation: requestOptions.mediation,
    signal: requestOptions.signal,
    publicKey: {
      ...options,
      challenge: decode(options.challenge),
      allowCredentials: options.allowCredentials?.map((value) => ({
        ...value,
        id: decode(value.id),
      })),
    } as PublicKeyCredentialRequestOptions,
  });
  if (!credential || credential.type !== "public-key") {
    throw new Error("No passkey was selected.");
  }
  const publicKey = credential as globalThis.PublicKeyCredential;
  const response = publicKey.response as AuthenticatorAssertionResponse;
  return request("/login/webauthn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: publicKey.id,
      rawId: encode(publicKey.rawId),
      response: {
        authenticatorData: encode(response.authenticatorData),
        clientDataJSON: encode(response.clientDataJSON),
        signature: encode(response.signature),
        userHandle: response.userHandle ? encode(response.userHandle) : null,
      },
      clientExtensionResults: publicKey.getClientExtensionResults(),
      authenticatorAttachment: publicKey.authenticatorAttachment,
    }),
  });
}

export async function supportsConditionalMediation() {
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  const credentialApi = window.PublicKeyCredential as typeof window.PublicKeyCredential & {
    isConditionalMediationAvailable?: () => Promise<boolean>;
  };
  if (typeof credentialApi.isConditionalMediationAvailable !== "function") return false;
  return credentialApi.isConditionalMediationAvailable();
}

function decode(value: string) {
  const binary = window.atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function encode(value: ArrayBuffer) {
  return window
    .btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
