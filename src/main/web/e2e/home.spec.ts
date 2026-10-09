import { test } from "@playwright/test";

import { expect } from "./fixtures";

test.describe("public landing page", () => {
  test("opens without redirecting to login and exposes the download flow", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", {
        name: /Secure identity|Modern uygulamalar için güvenli kimlik/i,
      }),
    ).toBeVisible();
    await expect(page.locator('input[name="username"]')).toHaveCount(0);
    await expect(page.locator('a[href="/download"]').first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Download the application|Uygulamayı indir/i }),
    ).toBeVisible();

    await page.goto("/login");
    await expect(page.locator('a[href="/download"]')).toHaveCount(0);
  });
});
