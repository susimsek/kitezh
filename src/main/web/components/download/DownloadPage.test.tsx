import { render, screen } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { fetchLatestDesktopRelease } from "@/lib/desktop-downloads";

import { DownloadPage } from "./DownloadPage";

jest.mock("@/lib/desktop-downloads", () => ({
  DESKTOP_RELEASES_URL: "https://github.com/susimsek/kitezh/releases/latest",
  fetchLatestDesktopRelease: jest.fn(),
  findReleaseAssetUrl: (release: { assets: Record<string, string> } | null, matcher: RegExp) =>
    Object.values(release?.assets ?? {}).find((url) => matcher.test(url)),
}));
jest.mock("@/components/shared/Icon", () => ({ Icon: () => <span aria-hidden="true" /> }));
jest.mock("@/components/shared/ActionIcon", () => ({
  ActionIcon: () => <span aria-hidden="true" />,
}));

const mockFetchRelease = fetchLatestDesktopRelease as jest.MockedFunction<
  typeof fetchLatestDesktopRelease
>;

describe("DownloadPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading and unavailable release states", async () => {
    mockFetchRelease.mockResolvedValueOnce({
      tag: "v1.0.0",
      version: "1.0.0",
      releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.0.0",
      assets: {},
    });

    render(<DownloadPage dictionary={dictionary} />);

    expect(screen.getByRole("status")).toHaveTextContent(dictionary.download.loading);
    expect(await screen.findByRole("heading", { name: dictionary.download.title })).toBeVisible();
    expect(await screen.findAllByText(dictionary.download.unavailable)).toHaveLength(11);
    expect(screen.queryByRole("heading", { name: dictionary.download.android.title })).toBeNull();
    expect(screen.queryByRole("heading", { name: dictionary.download.ios.title })).toBeNull();
    expect(
      screen.getByRole("button", { name: dictionary.download.downloadChecksums }),
    ).toHaveAttribute(
      "href",
      "https://github.com/susimsek/kitezh/releases/latest/download/SHA256SUMS",
    );
  });

  it("renders available platform assets and signed iOS guidance", async () => {
    mockFetchRelease.mockResolvedValueOnce({
      tag: "v1.0.0",
      version: "1.0.0",
      releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.0.0",
      assets: {
        windows: "https://example.test/kitezh-win-x64-setup.exe",
        android: "https://example.test/kitezh-android.apk",
        ios: "https://example.test/kitezh-ios.ipa",
      },
    });

    render(<DownloadPage dictionary={dictionary} />);

    expect(
      await screen.findByRole("button", { name: dictionary.download.windows.assets.installer }),
    ).toHaveAttribute("href", "https://example.test/kitezh-win-x64-setup.exe");
    expect(screen.getByRole("button", { name: dictionary.download.android.asset })).toHaveAttribute(
      "href",
      "https://example.test/kitezh-android.apk",
    );
    expect(screen.getByText(dictionary.download.ios.signedDescription)).toBeVisible();
    expect(
      screen.getByRole("button", { name: dictionary.download.ios.signedAsset }),
    ).toHaveAttribute("href", "https://example.test/kitezh-ios.ipa");
    expect(screen.queryByRole("link", { name: dictionary.download.ios.altStore })).toBeNull();
    expect(screen.getByRole("button", { name: dictionary.download.releaseNotes })).toHaveAttribute(
      "href",
      "https://github.com/susimsek/kitezh/releases/latest",
    );
  });

  it("reports release lookup failures", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockFetchRelease.mockRejectedValueOnce(new Error("offline"));

    render(<DownloadPage dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.download.loadError)).toBeVisible();
    expect(screen.queryByRole("link", { name: dictionary.download.downloadChecksums })).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "Unable to resolve the latest desktop release",
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
