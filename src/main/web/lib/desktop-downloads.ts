import type { ReleaseMetadata } from "@kitezh/shared/contracts";

export const DESKTOP_RELEASES_URL = "https://github.com/susimsek/kitezh/releases/latest";

const APP_RELEASE_API_URL = "/api/public/app-release";

export type DesktopRelease = ReleaseMetadata;

export async function fetchLatestDesktopRelease(signal?: AbortSignal): Promise<DesktopRelease> {
  const response = await fetch(APP_RELEASE_API_URL, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Desktop release lookup failed with status ${response.status}`);
  }
  return (await response.json()) as DesktopRelease;
}

export function findReleaseAssetUrl(
  release: DesktopRelease | null,
  matcher: RegExp,
): string | undefined {
  return Object.values(release?.assets ?? {}).find((url) => matcher.test(url));
}
