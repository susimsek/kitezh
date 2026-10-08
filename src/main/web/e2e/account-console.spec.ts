import { test } from "@playwright/test";

import { expect, visitConsole } from "./fixtures";

test.describe("account console", () => {
  test("opens personal information and security sections", async ({ page }) => {
    await visitConsole(page, "account", "/personal-info");
    await expect(page.locator(".account-sidebar")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Personal info|Kişisel bilgiler/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Security|Güvenlik/i }).click();
    await expect(page).toHaveURL(/\/account\/security$/);
    await expect(page.getByRole("heading", { name: /Security|Güvenlik/i })).toBeVisible();
  });

  test("keeps the account shell responsive on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visitConsole(page, "account", "/personal-info");
    const toggle = page.getByRole("button", { name: /navigation|navigasyon/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(".account-sidebar.is-open")).toBeVisible();
    await page.getByRole("link", { name: /Applications|Uygulamalar/i }).click();
    await expect(page).toHaveURL(/\/account\/applications$/);
  });
});
