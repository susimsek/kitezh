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

    const assetLinks = page.locator('a[href*="releases/download/v0.1.0/kitezh-"]');
    await expect(assetLinks).toHaveCount(11);
    for (const link of await assetLinks.all()) {
      await expect(link).toHaveAttribute("download", "");
      await expect(link).toHaveAttribute("href", /kitezh-0\.1\.0-/);
    }
    await expect(
      page.locator(`a[href="${"https://github.com/susimsek/kitezh/releases/latest"}"]`),
    ).toHaveAttribute("href", "https://github.com/susimsek/kitezh/releases/latest");
  });
});
