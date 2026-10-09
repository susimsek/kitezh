export const authorizationServerIssuer =
  process.env.EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER ??
  "https://kitezh.onrender.com";

export const mobileClientId =
  process.env.EXPO_PUBLIC_MOBILE_CLIENT_ID ?? "mobile-account-console";
export const mobileAdminClientId =
  process.env.EXPO_PUBLIC_MOBILE_ADMIN_CLIENT_ID ?? "mobile-admin-console";

export const mobileRedirectUri = "kitezh://oauth/callback";
export const mobilePostLogoutRedirectUri = "kitezh://logout/callback";
export const mobileAdminRedirectUri = "kitezh://admin/oauth/callback";
export const mobileAdminPostLogoutRedirectUri = "kitezh://admin/logout/callback";

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
