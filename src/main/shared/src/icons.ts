export const iconNames = [
  "arrowLeft",
  "arrowRight",
  "check",
  "logout",
  "reset",
  "gear",
  "globe",
  "home",
  "layers",
  "moon",
  "shield",
  "sun",
] as const;

export type AppIconName = (typeof iconNames)[number];

export const iconMetadata: Record<
  AppIconName,
  { labelKey: string; unicode: string }
> = {
  arrowLeft: { labelKey: "back", unicode: "←" },
  arrowRight: { labelKey: "continue", unicode: "→" },
  check: { labelKey: "save", unicode: "✓" },
  logout: { labelKey: "signOut", unicode: "↪" },
  reset: { labelKey: "resetDefaults", unicode: "↺" },
  gear: { labelKey: "settings", unicode: "⚙" },
  globe: { labelKey: "language", unicode: "◎" },
  home: { labelKey: "accountTitle", unicode: "⌂" },
  layers: { labelKey: "applications", unicode: "▱" },
  moon: { labelKey: "dark", unicode: "◐" },
  shield: { labelKey: "security", unicode: "◇" },
  sun: { labelKey: "light", unicode: "☼" },
};
