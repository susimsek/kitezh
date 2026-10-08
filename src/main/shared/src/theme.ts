export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const colors = {
  light: {
    background: "#f7f9fc",
    surface: "#ffffff",
    surfaceMuted: "#eef2f7",
    text: "#172033",
    textMuted: "#5f6b7a",
    border: "#d9e0ea",
    primary: "#1677ff",
    primaryPressed: "#0f5fd2",
    onPrimary: "#ffffff",
    danger: "#c93636",
  },
  dark: {
    background: "#111418",
    surface: "#1b2027",
    surfaceMuted: "#252c35",
    text: "#f4f7fb",
    textMuted: "#aab4c2",
    border: "#38424f",
    primary: "#4d94ff",
    primaryPressed: "#7badff",
    onPrimary: "#08152a",
    danger: "#ff8585",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export function resolveTheme(
  mode: ThemeMode,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return mode === "system" ? systemTheme : mode;
}
