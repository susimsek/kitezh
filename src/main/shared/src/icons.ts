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
