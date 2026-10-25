import type { DiscoveryDocument } from "expo-auth-session";

export const DISCOVERY_TIMEOUT_MS = 10_000;

export type DiscoveryFailure = "timeout" | "unavailable" | "invalid";

export class NativeDiscoveryError extends Error {
  readonly kind: DiscoveryFailure;

  constructor(kind: DiscoveryFailure) {
    super(kind);
    this.name = "NativeDiscoveryError";
    this.kind = kind;
  }
}

type DiscoveryMetadata = {
  issuer?: unknown;
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  end_session_endpoint?: unknown;
  revocation_endpoint?: unknown;
  userinfo_endpoint?: unknown;
  registration_endpoint?: unknown;
  jwks_uri?: unknown;
  response_types_supported?: unknown;
  subject_types_supported?: unknown;
  id_token_signing_alg_values_supported?: unknown;
  scopes_supported?: unknown;
  token_endpoint_auth_methods_supported?: unknown;
  code_challenge_methods_supported?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function fetchNativeAuthorizationDiscovery(
  issuer: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<DiscoveryDocument> {
  const timeoutMs = options.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new NativeDiscoveryError("timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(
          `${issuer}/.well-known/openid-configuration`,
          {
            headers: { Accept: "application/json" },
            method: "GET",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new NativeDiscoveryError("unavailable");

        let metadata: DiscoveryMetadata;
        try {
          metadata = (await response.json()) as DiscoveryMetadata;
        } catch {
          throw new NativeDiscoveryError("invalid");
        }
        if (
          !isNonEmptyString(metadata.issuer) ||
          !isNonEmptyString(metadata.authorization_endpoint) ||
          !isNonEmptyString(metadata.token_endpoint)
        ) {
          throw new NativeDiscoveryError("invalid");
        }

        return {
          authorizationEndpoint: metadata.authorization_endpoint,
          discoveryDocument:
            metadata as DiscoveryDocument["discoveryDocument"],
          endSessionEndpoint: isNonEmptyString(metadata.end_session_endpoint)
            ? metadata.end_session_endpoint
            : undefined,
          revocationEndpoint: isNonEmptyString(metadata.revocation_endpoint)
            ? metadata.revocation_endpoint
            : undefined,
          tokenEndpoint: metadata.token_endpoint,
          userInfoEndpoint: isNonEmptyString(metadata.userinfo_endpoint)
            ? metadata.userinfo_endpoint
            : undefined,
        };
      })(),
      timeout,
    ]);
  } catch (cause) {
    if (cause instanceof NativeDiscoveryError) throw cause;
    throw new NativeDiscoveryError(timedOut ? "timeout" : "unavailable");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
