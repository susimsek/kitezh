export const iconNames = [
  "arrowRight",
  "gear",
  "globe",
  "home",
  "moon",
  "shield",
  "sun",
] as const;

export type AppIconName = (typeof iconNames)[number];
