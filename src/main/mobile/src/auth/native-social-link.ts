export const NATIVE_SOCIAL_LINK_REDIRECT_URI = "kitezh://social-link/callback";

export type NativeSocialLinkCallback = {
  state: string;
  code: string | null;
  error: string | null;
};

export function isTrustedSocialLinkAuthorizationUrl(
  value: unknown,
  issuer: string,
) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const trustedIssuer = new URL(issuer);
    return (
      url.origin === trustedIssuer.origin &&
      url.protocol === trustedIssuer.protocol &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export function parseNativeSocialLinkCallback(
  value: unknown,
  expectedState: string,
): NativeSocialLinkCallback | null {
  if (typeof value !== "string" || !expectedState) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "kitezh:" ||
      url.hostname !== "social-link" ||
      url.pathname !== "/callback" ||
      url.hash !== "" ||
      url.searchParams.getAll("state").length !== 1
    ) {
      return null;
    }
    const state = url.searchParams.get("state");
    if (state !== expectedState) return null;

    const codes = url.searchParams.getAll("code");
    const errors = url.searchParams.getAll("error");
    if (codes.length > 1 || errors.length > 1 || (codes.length === 0) === (errors.length === 0)) {
      return null;
    }
    const code = codes[0] ?? null;
    if (code !== null && !/^[A-Za-z0-9_-]{32,128}$/.test(code)) return null;
    return { state, code, error: errors[0] ?? null };
  } catch {
    return null;
  }
}
