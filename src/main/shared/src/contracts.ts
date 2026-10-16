/**
 * Platform-neutral contracts shared by the native clients.
 *
 * Keep these types free of DOM, Electron, React Native, and storage concerns.
 * Platform adapters own the implementation details behind each contract.
 */
export type ConsoleName = "admin" | "account";

export type DesktopLanguageMode = "system" | "en" | "tr";

export type NativeClientCapability =
  | "passkeys"
  | "mfa-totp"
  | "mfa-recovery-codes"
  | "social-login"
  | "social-linking"
  | "ciba-approval"
  | "native-updates";

export type NativeClientCapabilities = {
  clientVersion: string;
  platform: "android" | "ios" | "desktop" | "web";
  capabilities: NativeClientCapability[];
};

export type DesktopUpdateStatus =
  | { state: "unsupported" }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "recovered"; version: string }
  | { state: "error"; message: string };

export type ReleaseMetadata = {
  tag: string;
  version: string;
  releaseUrl: string;
  assets: Record<string, string>;
};

export type SocialProviderAvailability = {
  provider: string;
  providerType: string;
  iconKey: string;
  configured: boolean;
};

export type AccountSocialLink = {
  provider: string;
  displayName: string;
  iconKey: string;
  linked: boolean;
  configured: boolean;
  enabled: boolean;
};

export type DesktopSocialLinkStartRequest = {
  state: string;
  codeChallenge: string;
};

export type DesktopSocialLinkStartResponse = {
  authorizationUrl: string;
  state: string;
  expiresAt: string;
};

export type DesktopSocialLinkCompleteRequest = {
  code: string;
  codeVerifier: string;
};

export type DesktopSocialLinkCompleteResponse = {
  provider: string;
  linked: boolean;
};
