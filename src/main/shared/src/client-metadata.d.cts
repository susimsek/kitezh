export type ClientMetadata = {
  appVersion: string;
  clientPlatform: "web" | "desktop" | "ios" | "android";
  os?: string;
};

export function createClientMetadataHeaders(
  metadata: ClientMetadata,
): Record<string, string>;
