export const authorizationServerIssuer =
  process.env.EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER ??
  "https://kitezh.onrender.com";

export const mobileClientId =
  process.env.EXPO_PUBLIC_MOBILE_CLIENT_ID ?? "mobile-account-console";

export const mobileRedirectUri = "kitezh://oauth/callback";
export const mobilePostLogoutRedirectUri = "kitezh://logout/callback";
