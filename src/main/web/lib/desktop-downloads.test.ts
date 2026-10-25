import {
  fetchLatestDesktopRelease,
  findReleaseAssetUrl,
  type DesktopRelease,
} from "./desktop-downloads";

describe("desktop release downloads", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  it("fetches the release metadata with the JSON accept header", async () => {
    const release: DesktopRelease = {
      assets: {},
      releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.4",
      tag: "v0.1.4",
      version: "0.1.4",
    };
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => release,
      ok: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
    });
    const controller = new AbortController();

    await expect(fetchLatestDesktopRelease(controller.signal)).resolves.toEqual(release);
    expect(fetchMock).toHaveBeenCalledWith("/api/public/app-release", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  });

  it("surfaces a failed release lookup with its HTTP status", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ok: false, status: 503 }),
    });

    await expect(fetchLatestDesktopRelease()).rejects.toThrow(
      "Desktop release lookup failed with status 503",
    );
  });

  it("finds the first matching asset and handles absent releases", () => {
    const release = {
      assets: {
        dmg: "https://example.test/Kitezh.dmg",
        zip: "https://example.test/Kitezh.zip",
      },
      releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.4",
      tag: "v0.1.4",
      version: "0.1.4",
    } as DesktopRelease;

    expect(findReleaseAssetUrl(release, /\.zip$/)).toBe("https://example.test/Kitezh.zip");
    expect(findReleaseAssetUrl(release, /\.exe$/)).toBeUndefined();
    expect(findReleaseAssetUrl(null, /./)).toBeUndefined();
  });
});
