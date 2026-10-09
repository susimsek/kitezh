export type DesktopAuthCallback = {
  state: string;
  code: string | null;
  error: string | null;
};

export type DesktopSocialLinkCallback = {
  state: string;
  code: string | null;
  error: string | null;
};

export type PendingAuthorization = {
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  createdAt: number;
};

export type DesktopTokens = {
  accessToken: string;
  expiresAt: number;
  idToken: string | null;
  refreshToken: string | null;
  version: 1;
};

export function isPendingAuthorizationValid(
  pending: PendingAuthorization,
  state: string,
  now = Date.now(),
  ttlMs = 5 * 60 * 1000,
) {
  return (
    pending.state === state &&
    now - pending.createdAt >= 0 &&
    now - pending.createdAt < ttlMs
  );
}

export async function exchangeAuthorizationCode(
  fetcher: typeof fetch,
  apiBaseUrl: string,
  pending: PendingAuthorization,
  code: string,
): Promise<DesktopTokens> {
  const response = await fetcher(`${apiBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: pending.clientId,
      code,
      code_verifier: pending.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: pending.redirectUri,
    }),
  });
  if (!response.ok)
    throw new Error("Desktop authorization code exchange failed");
  const token = (await response.json()) as Partial<{
    access_token: string;
    expires_in: number;
    id_token: string;
    refresh_token: string;
  }>;
  if (
    typeof token.access_token !== "string" ||
    typeof token.expires_in !== "number" ||
    !Number.isFinite(token.expires_in) ||
    token.expires_in <= 0
  ) {
    throw new Error("Invalid desktop token response");
  }
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    idToken: token.id_token ?? null,
    refreshToken: token.refresh_token ?? null,
    version: 1,
  };
}

export function parseAuthCallback(value: string, protocol = "kitezh") {
  try {
    const url = new URL(value);
    if (
      url.protocol !== `${protocol}:` ||
      url.hostname !== "oauth" ||
      url.pathname !== "/callback"
    ) {
      return null;
    }
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const state = url.searchParams.get("state") ?? fragment.get("state");
    if (!state) return null;
    return {
      state,
      code: url.searchParams.get("code") ?? fragment.get("code"),
      error: url.searchParams.get("error") ?? fragment.get("error"),
    } satisfies DesktopAuthCallback;
  } catch {
    return null;
  }
}

export function parseLogoutCallback(value: string, protocol = "kitezh") {
  try {
    const url = new URL(value);
    return (
      url.protocol === `${protocol}:` &&
      url.hostname === "logout" &&
      url.pathname === "/callback" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function parseSocialLinkCallback(
  value: string,
  protocol = "kitezh",
): DesktopSocialLinkCallback | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== `${protocol}:` ||
      url.hostname !== "social-link" ||
      url.pathname !== "/callback" ||
      url.hash
    ) {
      return null;
    }
    const state = url.searchParams.get("state");
    if (!state) return null;
    return {
      state,
      code: url.searchParams.get("code"),
      error: url.searchParams.get("error"),
    };
  } catch {
    return null;
  }
}

export function sanitizedAuthCallback(state: string, protocol = "kitezh") {
  const callback = new URL(`${protocol}://oauth/callback`);
  callback.searchParams.set("state", state);
  return callback.toString();
}
