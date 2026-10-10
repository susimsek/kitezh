import { test } from "@playwright/test";

import { apiRequest, expect, storedTokens, visitConsole } from "./fixtures";

test.describe("administration console", () => {
  test("signs in, renders the navigation, and rehydrates after reload", async ({ page }) => {
    await visitConsole(page, "admin");
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await expect(page.getByRole("link", { name: /Users|Kullanıcılar/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Clients|İstemciler/i })).toBeVisible();

    const before = await storedTokens(page, "admin");
    await page.reload();
    await expect(page.locator(".admin-sidebar")).toBeVisible();
    const after = await storedTokens(page, "admin");
    expect(after.accessToken).toBe(before.accessToken);
  });

  test("loads a resource list and a detail route through the authenticated API", async ({
    page,
    request,
  }) => {
    await visitConsole(page, "admin", "/users");
    await expect(page.getByRole("heading", { name: /Users|Kullanıcılar/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();

    const response = await apiRequest(request, page, "/api/admin/users?size=10");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { content: Array<{ id: number }> };
    expect(body.content.length).toBeGreaterThan(0);

    const id = encodeURIComponent(String(body.content[0].id));
    await page.goto(`/admin/users/${id}`);
    await expect(page.locator('input[name="username"]')).toHaveValue(/.+/);
    await page.reload();
    await expect(page.locator('input[name="username"]')).toHaveValue(/.+/);
  });

  test("renders the organization administration surface", async ({ page, request }) => {
    await visitConsole(page, "admin", "/organizations");
    await expect(page).toHaveURL(/\/admin\/organizations$/);
    await expect(
      page.getByRole("heading", { name: /Organizations|Organizasyonlar/i }),
    ).toBeVisible();
    await expect(page.locator("table")).toBeVisible();

    const response = await apiRequest(request, page, "/api/admin/organizations?size=10");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { content: unknown[] };
    expect(body.content).toBeDefined();
  });

  test("opens session administration and exposes the global revoke action", async ({ page }) => {
    await visitConsole(page, "admin", "/sessions");
    await expect(page.getByRole("heading", { name: /Sessions|Oturumlar/i })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Sign out all active sessions|Tüm aktif oturumları kapat/i,
      }),
    ).toBeVisible();
  });

  test("revokes active sessions and logs out the current browser session", async ({ page }) => {
    await visitConsole(page, "admin", "/sessions");
    const revokeAll = page.getByRole("button", {
      name: /Sign out all active sessions|Tüm aktif oturumları kapat/i,
    });
    await revokeAll.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Sign out all active sessions|Tüm aktif oturumları kapat/i })
      .click();

    await expect(page).toHaveURL(/\/login\?logout$/);
    await expect(
      page.getByText(
        /Successfully signed out|You have signed out successfully|Başarıyla çıkış yaptınız/i,
      ),
    ).toBeVisible();
    await page.goto("/admin/sessions");
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test("keeps mobile navigation usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visitConsole(page, "admin");
    const toggle = page.getByRole("button", { name: /navigation|navigasyon/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(".admin-sidebar.is-open")).toBeVisible();
    await page.getByRole("link", { name: /Users|Kullanıcılar/i }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });
});
