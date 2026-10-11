export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const colors = {
  light: {
    background: "#f8f9fa",
    surface: "#ffffff",
    surfaceMuted: "#e9ecef",
    surfaceHover: "#dee2e6",
    text: "#212529",
    textMuted: "#6c757d",
    border: "#dee2e6",
    primary: "#0d6efd",
    primaryPressed: "#0a58ca",
    onPrimary: "#ffffff",
    danger: "#c93636",
    success: "#1a8f5b",
  },
  dark: {
    background: "#212529",
    surface: "#2b3035",
    surfaceMuted: "#343a40",
    surfaceHover: "#495057",
    text: "#f8f9fa",
    textMuted: "#adb5bd",
    border: "#495057",
    primary: "#6ea8fe",
    primaryPressed: "#9ec5fe",
    onPrimary: "#052c65",
    danger: "#ff8585",
    success: "#65d49b",
  },
} as const;

/** Shared role-based layout metrics; platform UIs map these to native units. */
export const typography = {
  pageTitle: 28,
  sectionTitle: 19,
  body: 16,
  supporting: 14,
  compact: 12,
} as const;

export const controlSizes = {
  desktopCompact: 40,
  desktopDefault: 44,
  mobile: 52,
  mobileIconTarget: 44,
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
