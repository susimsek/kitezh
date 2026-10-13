import * as FileSystem from "expo-file-system/legacy";

import type { MobileReleaseAsset } from "./release-check.ts";

const APK_MIME_TYPE = "application/vnd.android.package-archive";
const INSTALLER_PERMISSION_FLAG = 1;

export type InstallUpdateResult = "installer-opened" | "permission-required";

export async function downloadAndOpenAndroidUpdate(
  asset: MobileReleaseAsset,
  onProgress: (percent: number) => void,
): Promise<InstallUpdateResult> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error("App cache directory is unavailable");

  const destination = `${cacheDirectory}${asset.name}`;
  const existing = await FileSystem.getInfoAsync(destination);
  let apkUri = destination;
  if (!existing.exists || !("size" in existing) || existing.size <= 0) {
    if (existing.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }
    const partial = `${destination}.download`;
    await FileSystem.deleteAsync(partial, { idempotent: true });
    const download = FileSystem.createDownloadResumable(
      asset.url,
      partial,
      {},
      ({ totalBytesExpectedToWrite, totalBytesWritten }) => {
        if (totalBytesExpectedToWrite > 0) {
          onProgress(
            Math.min(
              100,
              Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100),
            ),
          );
        }
      },
    );
    const result = await download.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(partial, { idempotent: true });
      throw new Error("Android update download failed");
    }
    await FileSystem.moveAsync({ from: result.uri, to: destination });
    apkUri = destination;
  }

  const contentUri = await FileSystem.getContentUriAsync(apkUri);
  const { ActivityAction, startActivityAsync } =
    await import("expo-intent-launcher");
  try {
    await startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: INSTALLER_PERMISSION_FLAG,
      type: APK_MIME_TYPE,
    });
    return "installer-opened";
  } catch {
    await startActivityAsync(ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
      data: "package:io.github.susimsek.kitezh.mobile",
    });
    return "permission-required";
  }
}
