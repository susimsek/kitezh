export const DESKTOP_RELEASES_URL = "https://github.com/susimsek/kitezh/releases/latest";

const DESKTOP_RELEASE_API_URL = "/api/public/desktop-release";

export type DesktopRelease = {
  tag: string;
  version: string;
  releaseUrl: string;
  assets: Record<string, string>;
};

export async function fetchLatestDesktopRelease(signal?: AbortSignal): Promise<DesktopRelease> {
  const response = await fetch(DESKTOP_RELEASE_API_URL, {
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
