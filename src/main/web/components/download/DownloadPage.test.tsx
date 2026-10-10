import { render, screen } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { fetchLatestDesktopRelease } from "@/lib/desktop-downloads";

import { DownloadPage } from "./DownloadPage";

const mockFetchLatestDesktopRelease = fetchLatestDesktopRelease as jest.MockedFunction<
  typeof fetchLatestDesktopRelease
>;

jest.mock("@/lib/desktop-downloads", () => ({
  DESKTOP_RELEASES_URL: "https://github.com/susimsek/kitezh/releases",
  fetchLatestDesktopRelease: jest.fn(),
  findDesktopAssetUrl: jest.fn(),
}));

describe("DownloadPage diagnostics privacy", () => {
  it("does not log release failure details", async () => {
    const sensitiveDetails = "authorization=Bearer secret user=ada@example.com";
    const warning = jest.spyOn(console, "warn").mockImplementation();
    mockFetchLatestDesktopRelease.mockRejectedValue(new Error(sensitiveDetails));

    render(<DownloadPage dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.download.loadError)).toBeVisible();
    expect(warning).toHaveBeenCalledWith("Unable to resolve the latest desktop release");
    expect(warning.mock.calls.flat().join(" ")).not.toContain(sensitiveDetails);
    warning.mockRestore();
  });
});
