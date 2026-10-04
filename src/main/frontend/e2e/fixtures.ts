import { expect, type APIRequestContext, type Page } from "@playwright/test";

export { expect };

export type ConsoleKind = "admin" | "account";
export type Locale = "en" | "tr";

type StoredTokens = {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  refreshToken: string;
};

const credentials: Record<ConsoleKind, { username: string; password: string }> = {
  admin: {
    username: process.env.E2E_ADMIN_USERNAME ?? "admin",
    password: process.env.E2E_ADMIN_PASSWORD ?? "admin",
  },
  account: {
    username: process.env.E2E_USER_USERNAME ?? process.env.E2E_ADMIN_USERNAME ?? "admin",
    password: process.env.E2E_USER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "admin",
  },
};

export async function setLocale(page: Page, locale: Locale): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:9090";
  await page.context().addCookies([{ name: "locale", value: locale, url: baseUrl }]);
}

export async function login(page: Page, kind: ConsoleKind, locale: Locale = "en"): Promise<void> {
  await setLocale(page, locale);
  await page.goto(kind === "admin" ? "/admin/" : "/account/");

  const username = page.locator('input[name="username"]');
  const sidebar = page.locator(kind === "admin" ? ".admin-sidebar" : ".account-sidebar");
  await expect(username.or(sidebar)).toBeVisible({ timeout: 15_000 });
  if (await username.isVisible()) {
    await username.fill(credentials[kind].username);
    await page.locator('input[name="password"]').fill(credentials[kind].password);
    await page.getByRole("button", { name: /sign in|giriş/i }).click();
  }

  await expect(sidebar).toBeVisible({ timeout: 20_000 });
}

export async function visitConsole(
  page: Page,
  kind: ConsoleKind,
  path = "",
  locale: Locale = "en",
): Promise<void> {
  await login(page, kind, locale);
  await page.goto(`/${kind}${path}`);
  await expect(page.locator(kind === "admin" ? ".admin-sidebar" : ".account-sidebar")).toBeVisible({
    timeout: 20_000,
  });
}

export async function storedTokens(page: Page, kind: ConsoleKind): Promise<StoredTokens> {
  const tokens = await page.evaluate((consoleKind) => {
    const value = window.localStorage.getItem(`AUTH_CONSOLE_TOKEN:${consoleKind}`);
    return value ? (JSON.parse(value) as StoredTokens) : null;
  }, kind);
  if (!tokens) throw new Error(`Expected persisted ${kind} console tokens`);
  return tokens;
}

export async function apiRequest(
  request: APIRequestContext,
  page: Page,
  path: string,
  options: Parameters<APIRequestContext["fetch"]>[1] = {},
): Promise<Awaited<ReturnType<APIRequestContext["fetch"]>>> {
  const tokens = await storedTokens(page, "admin");
  const headers = new Headers(options.headers as HeadersInit | undefined);
  headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  return request.fetch(path, { ...options, headers: Object.fromEntries(headers.entries()) });
}

export function decodeJwt<T extends object = { sid?: string }>(token: string): T {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Expected a JWT access token");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64url").toString("utf8")) as T;
}
