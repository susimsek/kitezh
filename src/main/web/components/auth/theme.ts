import { resolveTheme as resolveSharedTheme, type ThemeMode } from "@kitezh/shared/theme";

export type Theme = ThemeMode;

export const THEME_STORAGE_KEY = "AUTH_THEME";

export function isTheme(value: string | null): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  return resolveSharedTheme(theme, prefersDark ? "dark" : "light");
}
