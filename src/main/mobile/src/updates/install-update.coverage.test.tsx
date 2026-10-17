import * as FileSystem from "expo-file-system/legacy";
import { ActivityAction, startActivityAsync } from "expo-intent-launcher";

import { downloadAndOpenAndroidUpdate } from "./install-update";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  moveAsync: jest.fn(),
  getContentUriAsync: jest.fn(),
}));
jest.mock("expo-intent-launcher", () => ({
  ActivityAction: { MANAGE_UNKNOWN_APP_SOURCES: "manage-sources" },
  startActivityAsync: jest.fn(),
}));

const asset = {
  name: "kitezh-1.3.0-android.apk",
  url: "https://github.com/susimsek/kitezh/releases/download/v1.3.0/kitezh.apk",
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(FileSystem, "cacheDirectory", {
    configurable: true,
    value: "/cache/",
  });
  jest.mocked(FileSystem.getContentUriAsync).mockResolvedValue("content://apk");
  jest.mocked(startActivityAsync).mockResolvedValue(undefined);
});

it("opens a non-empty cached APK without downloading it again", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    size: 12,
    isDirectory: false,
    uri: "/cache/kitezh.apk",
    modificationTime: 0,
  });

  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).resolves.toBe(
    "installer-opened",
  );
  expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  expect(startActivityAsync).toHaveBeenCalledWith(
    "android.intent.action.VIEW",
    expect.objectContaining({
      data: "content://apk",
      type: "application/vnd.android.package-archive",
    }),
  );
});

it("fails clearly when the platform does not provide a cache directory", async () => {
  Object.defineProperty(FileSystem, "cacheDirectory", {
    configurable: true,
    value: null,
  });

  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).rejects.toThrow(
    "App cache directory is unavailable",
  );
  expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
});

it("downloads the APK, reports bounded progress, and moves it into the cache", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: false,
    isDirectory: false,
    uri: "/cache/kitezh.apk",
    modificationTime: 0,
  });
  let onDownloadProgress:
    | ((progress: {
        totalBytesExpectedToWrite: number;
        totalBytesWritten: number;
      }) => void)
    | undefined;
  jest.mocked(FileSystem.createDownloadResumable).mockImplementation(((
    _url,
    _path,
    _options,
    progress,
  ) => {
    onDownloadProgress = progress;
    return {
      downloadAsync: async () => ({ status: 200, uri: "/cache/temp.apk" }),
    } as never;
  }) as typeof FileSystem.createDownloadResumable);
  const progress = jest.fn();

  await expect(downloadAndOpenAndroidUpdate(asset, progress)).resolves.toBe(
    "installer-opened",
  );
  onDownloadProgress?.({ totalBytesExpectedToWrite: 0, totalBytesWritten: 0 });
  onDownloadProgress?.({ totalBytesExpectedToWrite: 4, totalBytesWritten: 1 });
  onDownloadProgress?.({ totalBytesExpectedToWrite: 4, totalBytesWritten: 8 });
  expect(progress.mock.calls.map(([percent]) => percent)).toEqual([25, 100]);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    "/cache/kitezh-1.3.0-android.apk.download",
    {
      idempotent: true,
    },
  );
  expect(FileSystem.moveAsync).toHaveBeenCalledWith({
    from: "/cache/temp.apk",
    to: "/cache/kitezh-1.3.0-android.apk",
  });
});

it("cleans an unsuccessful download and rejects when the cache directory is missing", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: false,
    isDirectory: false,
    uri: "/cache/kitezh.apk",
    modificationTime: 0,
  });
  jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
    downloadAsync: async () => ({ status: 503, uri: "/cache/partial.apk" }),
  } as never);
  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).rejects.toThrow(
    "Android update download failed",
  );
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    "/cache/kitezh-1.3.0-android.apk.download",
    { idempotent: true },
  );
});

it("opens Android settings when the package installer requires permission", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    size: 12,
    isDirectory: false,
    uri: "/cache/kitezh.apk",
    modificationTime: 0,
  });
  jest
    .mocked(startActivityAsync)
    .mockRejectedValueOnce(new Error("permission"));

  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).resolves.toBe(
    "permission-required",
  );
  expect(startActivityAsync).toHaveBeenLastCalledWith(
    ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: "package:io.github.susimsek.kitezh.mobile" },
  );
});

it("deletes an empty cached artifact before downloading a fresh APK", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    size: 0,
    isDirectory: false,
    uri: "/cache/kitezh-1.3.0-android.apk",
    modificationTime: 0,
  });
  jest.mocked(FileSystem.createDownloadResumable).mockImplementation((
    (_url, _path, _options, _progress) => ({
      downloadAsync: async () => ({ status: 200, uri: "/cache/fresh.apk" }),
    }) as never
  ) as typeof FileSystem.createDownloadResumable);

  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).resolves.toBe(
    "installer-opened",
  );
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    "/cache/kitezh-1.3.0-android.apk",
    { idempotent: true },
  );
  expect(FileSystem.moveAsync).toHaveBeenCalledWith({
    from: "/cache/fresh.apk",
    to: "/cache/kitezh-1.3.0-android.apk",
  });
});

it("re-downloads a cached artifact whose size cannot be verified", async () => {
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: false,
    uri: "/cache/kitezh-1.3.0-android.apk",
    modificationTime: 0,
  });
  jest.mocked(FileSystem.createDownloadResumable).mockImplementation((
    (_url, _path, _options, _progress) => ({
      downloadAsync: async () => ({ status: 200, uri: "/cache/verified.apk" }),
    }) as never
  ) as typeof FileSystem.createDownloadResumable);

  await expect(downloadAndOpenAndroidUpdate(asset, jest.fn())).resolves.toBe(
    "installer-opened",
  );
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    "/cache/kitezh-1.3.0-android.apk",
    { idempotent: true },
  );
  expect(FileSystem.moveAsync).toHaveBeenCalledWith({
    from: "/cache/verified.apk",
    to: "/cache/kitezh-1.3.0-android.apk",
  });
});
