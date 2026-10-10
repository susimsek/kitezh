import { test } from "@playwright/test";

import { expect } from "./fixtures";

test.describe("download page", () => {
  test("renders platform packages and GitHub release links", async ({ page }) => {
    await page.route("**/api/public/desktop-release", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          tag: "v0.1.0",
          version: "0.1.0",
          releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.0",
          assets: Object.fromEntries(
            [
              "win-x64-setup.exe",
              "win-x64-portable.exe",
              "win-x64-appx.appx",
              "linux-x86_64.AppImage",
              "linux-amd64.deb",
              "linux-x86_64.rpm",
              "linux-amd64.snap",
              "linux-arm64.AppImage",
              "linux-arm64.deb",
              "macos-universal.dmg",
              "macos-x64.dmg",
              "android.apk",
              "ios-unsigned.ipa",
            ].map((suffix) => [
              suffix,
              `https://github.com/susimsek/kitezh/releases/download/v0.1.0/kitezh-0.1.0-${suffix}`,
            ]),
          ),
        }),
      });
    });
    await page.goto("/download");

    await expect(
      page.getByRole("heading", { name: /Download the application|Uygulamayı indirin/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Windows" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Linux" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "macOS" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Android" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "iPhone and iPad" })).toBeVisible();

    const assetLinks = page.locator('a[href*="releases/download/v0.1.0/kitezh-"]');
    await expect(assetLinks).toHaveCount(13);
    for (const link of await assetLinks.all()) {
      await expect(link).toHaveAttribute("download", "");
      await expect(link).toHaveAttribute("href", /kitezh-0\.1\.0-/);
    }
    await expect(
      page.locator(`a[href="${"https://github.com/susimsek/kitezh/releases/latest"}"]`),
    ).toHaveAttribute("href", "https://github.com/susimsek/kitezh/releases/latest");
    const unsignedIpaLink = page.locator(
      'a[href="https://github.com/susimsek/kitezh/releases/download/v0.1.0/kitezh-0.1.0-ios-unsigned.ipa"]',
    );
    await expect(unsignedIpaLink).toBeVisible();
    await expect(unsignedIpaLink).toHaveAttribute("download", "");
    await expect(page.getByRole("link", { name: "Sideloadly" })).toHaveAttribute(
      "href",
      "https://sideloadly.io/",
    );
    await expect(page.getByText(/Free signing lasts 7 days|Ücretsiz imza 7 gün/i)).toBeVisible();
  });

  test("explains when mobile packages are absent from the latest release", async ({ page }) => {
    await page.route("**/api/public/desktop-release", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          tag: "v0.1.0",
          version: "0.1.0",
          releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.0",
          assets: {},
        }),
      });
    });
    await page.goto("/download");

    await expect(page.getByText(/Not included in the latest release yet/i)).toHaveCount(13);
    await expect(page.getByRole("button", { name: /Download APK|APK'yı indir/i })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Download unsigned IPA|İmzasız IPA'yı indir/i }),
    ).toBeDisabled();
    await expect(page.getByText(/Free signing lasts 7 days|Ücretsiz imza 7 gün/i)).toBeVisible();
  });

  test("shows signed iOS installation guidance when the release includes an ad hoc IPA", async ({
    page,
  }) => {
    await page.route("**/api/public/desktop-release", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          tag: "v0.1.0",
          version: "0.1.0",
          releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.0",
          assets: {
            iosIpa:
              "https://github.com/susimsek/kitezh/releases/download/v0.1.0/kitezh-0.1.0-ios.ipa",
          },
        }),
      });
    });
    await page.goto("/download");

    const signedIpaLink = page.locator(
      'a[href="https://github.com/susimsek/kitezh/releases/download/v0.1.0/kitezh-0.1.0-ios.ipa"]',
    );
    await expect(signedIpaLink).toBeVisible();
    await expect(signedIpaLink).toHaveAttribute("download", "");
    await expect(
      page.getByText(/installs only on devices included in its provisioning profile/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "AltStore setup" })).toHaveCount(0);
  });

  test("shows a page error when the release lookup fails", async ({ page }) => {
    await page.route("**/api/public/desktop-release", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/problem+json",
        body: JSON.stringify({ status: 500 }),
      });
    });
    await page.goto("/download");

    await expect(page.locator(".download-release-error")).toHaveText(
      /Available packages could not be loaded\.|Kullanılabilir paketler yüklenemedi\./i,
    );
    await expect(page.locator("a.download-asset-button")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /SHA-256 checksums/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /View release notes|Sürüm notlarını görüntüle/i }),
    ).toHaveCount(0);
  });
});
