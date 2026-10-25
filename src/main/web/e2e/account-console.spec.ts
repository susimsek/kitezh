import { test } from "@playwright/test";

import { expect, login, visitConsole } from "./fixtures";

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

  test("opens the security deep link and creates and revokes a personal access token", async ({
    page,
  }) => {
    let tokens: Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: string;
      expiresAt: string | null;
      scope: string;
    }> = [];
    await login(page, "account");
    await page.route("**/api/account/personal-access-tokens**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { name: string; description: string | null };
        const created = {
          id: "e2e-token",
          name: body.name,
          description: body.description,
          createdAt: "2026-10-17T12:00:00Z",
          expiresAt: null,
          scope: "mcp.read",
        };
        tokens = [created];
        await route.fulfill({
          json: { ...created, token: "e2e-one-time-token" },
        });
      } else if (request.method() === "DELETE") {
        tokens = [];
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({ json: tokens });
      }
    });

    await page.goto("/account/security");
    await expect(page.getByRole("heading", { name: /Personal access tokens/i })).toBeVisible();
    await page.getByLabel("Token name").fill("Codex E2E");
    await page.getByLabel("Expires after").selectOption("never");
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByText("e2e-one-time-token")).toBeVisible();
    await expect(page.getByText("Never expires").last()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account")))
      .toContain("accessToken");
    expect(
      await page.evaluate(() => window.localStorage.getItem("AUTH_CONSOLE_TOKEN:account")),
    ).not.toContain("e2e-one-time-token");

    await page.getByRole("button", { name: "Hide token" }).click();
    await page.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("No personal access tokens have been created.")).toBeVisible();
  });

  test("shows a persistent error when personal access tokens cannot be loaded", async ({
    page,
  }) => {
    await login(page, "account");
    await page.route("**/api/account/personal-access-tokens**", (route) =>
      route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
    );
    await page.goto("/account/security");
    await expect(page.getByText("Personal access tokens could not be loaded.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create token" })).toHaveCount(0);
  });
});
