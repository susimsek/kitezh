import { test } from "@playwright/test";

import { expect, visitConsole } from "./fixtures";

test.describe("administration event console", () => {
  test("shows admin and user event history with filters", async ({ page }) => {
    await visitConsole(page, "admin");

    await page
      .locator(".admin-sidebar")
      .getByRole("link", { name: /^Events$/i })
      .click();
    await expect(page).toHaveURL(/\/admin\/events$/);
    await expect(page.getByRole("heading", { name: /^Events$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Admin events$/i })).toBeVisible();

    await page.getByRole("link", { name: /^User events$/i }).click();
    await expect(page).toHaveURL(/\/admin\/events\/user$/);
    await expect(page.getByRole("heading", { name: /^User events$/i })).toBeVisible();
    await page.getByRole("button", { name: /^Filter user events$/i }).click();

    await expect(page.locator('input[aria-label="Username"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Client ID"]')).toBeVisible();
    await expect(page.locator('input[aria-label="IP address"]')).toBeVisible();
  });

  test("shows event settings and listener management", async ({ page }) => {
    await visitConsole(page, "admin");

    await page.getByRole("link", { name: /^Settings$/i }).click();
    await page
      .locator(".admin-detail-tabs")
      .getByRole("link", { name: /^Events$/i })
      .click();
    await expect(page).toHaveURL(/\/admin\/settings\/events$/);
    await expect(page.getByRole("heading", { name: /^Event settings$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^User event settings$/i })).toBeVisible();
    await expect(page.getByText("Successful login", { exact: true })).toBeVisible();
    await expect(page.getByText("Failed login", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Event listeners$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Add listener$/i })).toBeVisible();
  });
});
