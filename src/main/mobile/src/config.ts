export const DEFAULT_AUTHORIZATION_SERVER_ISSUER =
  "https://kitezh.onrender.com";

export function resolveAuthorizationServerIssuer(
  environment?: string,
  isDevelopmentBuild = process.env.NODE_ENV === "development",
): string {
  const candidate = environment?.trim();
  if (!candidate) return DEFAULT_AUTHORIZATION_SERVER_ISSUER;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("authorization_server_issuer_invalid");
  }

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("authorization_server_issuer_invalid");
  }
  if (url.origin === DEFAULT_AUTHORIZATION_SERVER_ISSUER) return url.origin;
  if (!isDevelopmentBuild) {
    throw new Error("authorization_server_issuer_override_not_allowed");
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "9090"
  ) {
    throw new Error("authorization_server_issuer_invalid");
  }
  return url.origin;
}

export const authorizationServerIssuer = resolveAuthorizationServerIssuer(
  process.env.EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER,
);

export const mobileClientId =
  process.env.EXPO_PUBLIC_MOBILE_CLIENT_ID ?? "mobile-account-console";
export const mobileAdminClientId =
  process.env.EXPO_PUBLIC_MOBILE_ADMIN_CLIENT_ID ?? "mobile-admin-console";

export const mobileRedirectUri = "kitezh://oauth/callback";
export const mobilePostLogoutRedirectUri = "kitezh://logout/callback";
export const mobileAdminRedirectUri = "kitezh://admin/oauth/callback";
export const mobileAdminPostLogoutRedirectUri =
  "kitezh://admin/logout/callback";

export type MobileConsole = "account" | "admin";

export type MobileConsoleConfig = {
  clientId: string;
  namespace: MobileConsole;
  postLogoutRedirectUri: string;
  redirectUri: string;
  scopes: string[];
};

export function getMobileConsoleConfig(
  consoleName: MobileConsole = "account",
): MobileConsoleConfig {
  if (consoleName === "admin") {
    return {
      clientId: mobileAdminClientId,
      namespace: "admin",
      postLogoutRedirectUri: mobileAdminPostLogoutRedirectUri,
      redirectUri: mobileAdminRedirectUri,
      scopes: ["openid", "profile", "email", "admin-api"],
    };
  }
  return {
    clientId: mobileClientId,
    namespace: "account",
    postLogoutRedirectUri: mobilePostLogoutRedirectUri,
    redirectUri: mobileRedirectUri,
    scopes: ["openid", "profile", "email", "account-api"],
  };
}
