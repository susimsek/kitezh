import { test } from "@playwright/test";

import { expect, setLocale } from "./fixtures";

test.describe("login and locale", () => {
  test("renders the form and keeps the selected locale on reload", async ({ page }) => {
    await setLocale(page, "tr");
    await page.goto("/login?continue=account#form");

    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await page.locator('input[name="username"]').fill("draft-user");

    await page.getByRole("button", { name: /language|dil/i }).click();
    await page.locator(".dropdown-menu .dropdown-item", { hasText: "English" }).click();

    await expect(page.locator('input[name="username"]')).toHaveValue("draft-user");
    await expect(page).toHaveURL(/\/login\?continue=account#form$/);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: /language|dil/i })).toBeVisible();
  });

  test("discovers configured social providers and prevents duplicate redirects", async ({
    page,
  }) => {
    await page.route("**/api/auth/social-providers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { provider: "acme-google", providerType: "google", iconKey: "google", configured: true },
          { provider: "github", providerType: "github", iconKey: "github", configured: false },
        ]),
      }),
    );
    await page.route("**/oauth2/authorization/acme-google", (route) => route.abort());
    await page.goto("/login");

    const google = page.getByRole("button", { name: /Google/i });
    const github = page.getByRole("button", { name: /GitHub/i });
    await expect(google).toHaveAttribute("href", "/oauth2/authorization/acme-google");
    await expect(google).toHaveAttribute("aria-disabled", "false");
    await expect(github).not.toHaveAttribute("href");
    await expect(github).toHaveAttribute("aria-disabled", "true");

    await google.evaluate((element) => {
      element.addEventListener("click", (event) => event.preventDefault(), { once: true });
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect(google).toHaveAttribute("aria-disabled", "true");
    await expect(google.locator(".spinner-border")).toBeVisible();
    await expect(github).toHaveAttribute("aria-disabled", "true");
  });

  test("serves the localized not-found page without losing the deep-link", async ({ page }) => {
    await setLocale(page, "tr");
    await page.goto("/admin/missing/page?type=server_error#missing");
    await expect(page.locator(".display-1")).toHaveText("404");
    await expect(page).toHaveURL(/\/admin\/missing\/page\?type=server_error#missing$/);
  });

  test("does not replace protected APIs or missing assets with SPA HTML", async ({ request }) => {
    const api = await request.get("/api/admin/users", { headers: { Accept: "application/json" } });
    expect(api.status()).toBe(401);
    const asset = await request.get("/admin/missing.js", { maxRedirects: 0 });
    expect(await asset.text()).not.toContain("/_next/static/");
    const discovery = await request.get("/.well-known/openid-configuration");
    expect((await discovery.json()).authorization_endpoint).toContain("/oauth2/authorize");
  });
});
