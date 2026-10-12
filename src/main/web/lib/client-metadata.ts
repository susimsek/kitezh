import { createClientMetadataHeaders } from "@kitezh/shared/client-metadata";

export function getClientMetadataHeaders() {
  const desktopApi = typeof window === "undefined" ? undefined : window.desktopApi;
  return createClientMetadataHeaders({
    appVersion: desktopApi?.appVersion ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "development",
    clientPlatform: desktopApi ? "desktop" : "web",
    os: desktopApi?.os,
  });
}
