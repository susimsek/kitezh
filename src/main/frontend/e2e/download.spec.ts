import { test } from "@playwright/test";

import { expect } from "./fixtures";

test.describe("download page", () => {
  test("renders platform packages and GitHub release links", async ({ page }) => {
    await page.goto("/download");

    await expect(
      page.getByRole("heading", { name: /Download the application|Uygulamayı indirin/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Windows" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Linux" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "macOS" })).toBeVisible();

    const assetLinks = page.locator('a[href*="releases/latest/download/"]');
    await expect(assetLinks).toHaveCount(12);
    for (const link of await assetLinks.all()) {
      await expect(link).toHaveAttribute("download", "");
    }
    await expect(
      page.locator('a[href="https://github.com/susimsek/kitezh/releases/latest"]'),
    ).toHaveAttribute("href", "https://github.com/susimsek/kitezh/releases/latest");
  });
});
