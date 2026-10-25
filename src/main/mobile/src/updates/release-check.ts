import type { ReleaseMetadata } from "../../../shared/src/contracts.ts";

export const RELEASES_PAGE_URL =
  "https://github.com/susimsek/kitezh/releases/latest";

export type MobileUpdatePlatform = "android" | "ios";

export type MobileReleaseAsset = {
  name: string;
  url: string;
};

export type MobileRelease = {
  version: string;
  pageUrl: string;
  asset: MobileReleaseAsset | null;
};

function parseVersion(value: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  return match.slice(1).map(Number);
}

export function compareVersions(left: string, right: string) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return null;
  for (let index = 0; index < leftVersion.length; index += 1) {
    const difference = leftVersion[index] - rightVersion[index];
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function safeReleasePageUrl(value: unknown) {
  if (typeof value !== "string") return RELEASES_PAGE_URL;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/susimsek/kitezh/releases/")
    ) {
      return url.toString();
    }
  } catch {
    // The public releases page is a safe fallback for malformed API data.
  }
  return RELEASES_PAGE_URL;
}

function safeAssetUrl(value: unknown, tag: string, assetName: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname ===
        `/susimsek/kitezh/releases/download/${tag}/${assetName}`
    ) {
      return url.toString();
    }
  } catch {
    // Ignore asset links that are not valid HTTPS GitHub release downloads.
  }
  return null;
}

export function parseLatestRelease(
  payload: ReleaseMetadata,
  currentVersion: string,
  platform: MobileUpdatePlatform,
): MobileRelease | null {
  if (!payload || typeof payload !== "object") return null;
  const version = payload.version;
  if (
    typeof version !== "string" ||
    payload.tag !== `v${version}` ||
    !payload.assets ||
    typeof payload.assets !== "object"
  ) {
    return null;
  }
  if (compareVersions(version, currentVersion) !== 1) return null;

  const candidates =
    platform === "android"
      ? [["androidApk", `kitezh-${version}-android.apk`]]
      : [
          ["iosIpa", `kitezh-${version}-ios.ipa`],
          ["iosUnsignedIpa", `kitezh-${version}-ios-unsigned.ipa`],
        ];
  let asset: MobileReleaseAsset | null = null;
  for (const [key, name] of candidates) {
    const url = safeAssetUrl(payload.assets[key], payload.tag, name);
    if (url) {
      asset = { name, url };
      break;
    }
  }

  return {
    version,
    pageUrl: safeReleasePageUrl(payload.releaseUrl),
    asset,
  };
}
