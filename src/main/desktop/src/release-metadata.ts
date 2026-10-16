import type { ReleaseMetadata } from "@kitezh/shared/contracts";

const RELEASE_URL_PREFIX =
  "https://github.com/susimsek/kitezh/releases/download/";

function parseVersion(value: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function isReleaseMetadata(value: unknown): value is ReleaseMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<ReleaseMetadata>;
  if (
    typeof metadata.version !== "string" ||
    metadata.tag !== `v${metadata.version}` ||
    typeof metadata.releaseUrl !== "string" ||
    !metadata.releaseUrl.startsWith(
      "https://github.com/susimsek/kitezh/releases/tag/",
    ) ||
    !metadata.assets ||
    typeof metadata.assets !== "object"
  ) {
    return false;
  }
  return Object.values(metadata.assets).every(
    (url) => typeof url === "string" && url.startsWith(RELEASE_URL_PREFIX),
  );
}

function desktopAssetKey(platform: NodeJS.Platform, arch: string) {
  if (platform === "win32") return "windowsInstaller";
  if (platform === "darwin") {
    if (arch === "arm64") return "macosAppleSilicon";
    if (arch === "x64") return "macosIntel";
    return null;
  }
  if (platform === "linux") {
    if (arch === "arm64") return "linuxArm64AppImage";
    if (arch === "x64") return "linuxX64AppImage";
  }
  return null;
}

/** Returns null when metadata cannot safely answer and the native updater should be used. */
export function hasNewerDesktopRelease(
  value: unknown,
  currentVersion: string,
  platform: NodeJS.Platform,
  arch: string,
): boolean | null {
  if (!isReleaseMetadata(value)) return null;
  const key = desktopAssetKey(platform, arch);
  if (!key || !value.assets[key]) return null;

  const latest = parseVersion(value.version);
  const current = parseVersion(currentVersion);
  if (!latest || !current) return null;

  for (let index = 0; index < latest.length; index += 1) {
    if (latest[index] !== current[index]) {
      return latest[index] > current[index];
    }
  }
  return false;
}
