export const iconNames = [
  "add",
  "bell",
  "arrowLeft",
  "arrowRight",
  "check",
  "delete",
  "disable",
  "edit",
  "enable",
  "logout",
  "remove",
  "reset",
  "save",
  "gear",
  "globe",
  "home",
  "layers",
  "moon",
  "shield",
  "send",
  "sun",
  "trash",
  "upload",
  "user",
] as const;

export type AppIconName = (typeof iconNames)[number];

export const socialProviderIconNames = {
  generic: "globe",
  github: "globe",
  google: "globe",
  linkedin: "globe",
  microsoft: "globe",
} as const satisfies Record<string, AppIconName>;

export function socialProviderIcon(iconKey: string): AppIconName {
  return (
    socialProviderIconNames[iconKey as keyof typeof socialProviderIconNames] ??
    "globe"
  );
}

export const iconMetadata: Record<
  AppIconName,
  { labelKey: string; unicode: string; svg?: string }
> = {
  add: {
    labelKey: "actionAdd",
    unicode: "+",
    svg: '<path d="M12 5v14M5 12h14"/>',
  },
  bell: { labelKey: "notificationsTitle", unicode: "♧" },
  arrowLeft: { labelKey: "back", unicode: "←" },
  arrowRight: { labelKey: "continue", unicode: "→" },
  check: { labelKey: "save", unicode: "✓", svg: '<path d="m5 12 4 4L19 6"/>' },
  delete: {
    labelKey: "actionDelete",
    unicode: "×",
    svg: '<path d="M4 7h16M10 3h4m4 4-1 13H7L6 7m4 4v6m4-6v6"/>',
  },
  disable: { labelKey: "adminDisableUser", unicode: "⊘" },
  edit: {
    labelKey: "actionEdit",
    unicode: "✎",
    svg: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',
  },
  enable: { labelKey: "adminEnableUser", unicode: "✓" },
  logout: { labelKey: "signOut", unicode: "↪" },
  remove: { labelKey: "actionDelete", unicode: "−" },
  reset: { labelKey: "resetDefaults", unicode: "↺" },
  save: { labelKey: "save", unicode: "▣" },
  gear: { labelKey: "settings", unicode: "⚙" },
  globe: { labelKey: "language", unicode: "◎" },
  home: { labelKey: "accountTitle", unicode: "⌂" },
  layers: { labelKey: "applications", unicode: "▱" },
  moon: { labelKey: "dark", unicode: "◐" },
  shield: { labelKey: "security", unicode: "◇" },
  send: { labelKey: "adminSendActionEmail", unicode: "✉" },
  sun: { labelKey: "light", unicode: "☼" },
  trash: { labelKey: "actionDelete", unicode: "🗑" },
  upload: { labelKey: "adminUserAvatarUpload", unicode: "⇧" },
  user: { labelKey: "adminUsers", unicode: "👤" },
};

export const desktopIconMetadata = {
  ...iconMetadata,
  layers: {
    ...iconMetadata.layers,
    svg: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  },
  globe: {
    ...iconMetadata.globe,
    svg: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
  },
  view: {
    labelKey: "adminClientScopeDetails",
    unicode: "◉",
    svg: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  },
  cancel: {
    labelKey: "cancel",
    unicode: "×",
    svg: '<path d="m6 6 12 12M18 6 6 18"/>',
  },
  search: {
    labelKey: "adminSearchGroups",
    unicode: "⌕",
    svg: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  },
  more: {
    labelKey: "settings",
    unicode: "⋮",
    svg: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  },
  firstPage: {
    labelKey: "adminGroupFirst",
    unicode: "≪",
    svg: '<path d="m11 19-9-7 9-7M22 19l-9-7 9-7"/>',
  },
  previousPage: {
    labelKey: "adminPrevious",
    unicode: "‹",
    svg: '<path d="m15 18-6-6 6-6"/>',
  },
  nextPage: {
    labelKey: "adminNext",
    unicode: "›",
    svg: '<path d="m9 18 6-6-6-6"/>',
  },
  lastPage: {
    labelKey: "adminGroupLast",
    unicode: "≫",
    svg: '<path d="m13 5 9 7-9 7M2 5l9 7-9 7"/>',
  },
  clients: {
    labelKey: "adminClients",
    unicode: "▤",
    svg: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="M5 16v-1a3 3 0 0 1 6 0v1m3-7h4m-4 4h4"/>',
  },
  gaugeHigh: {
    labelKey: "adminNavDashboard",
    unicode: "◴",
    svg: '<path d="M20.5 15a9 9 0 1 0-17 0M12 12l5-5M5 19h14"/>',
  },
  addressCard: {
    labelKey: "adminNavClients",
    unicode: "▤",
    svg: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5.5 16a3.5 3.5 0 0 1 7 0m3-6h3m-3 4h3"/>',
  },
  layerGroup: {
    ...iconMetadata.layers,
    labelKey: "adminNavClientScopes",
    svg: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  },
  users: {
    labelKey: "adminNavUsers",
    unicode: "♙",
    svg: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-9a3 3 0 1 0-1-5.8M18 14a5 5 0 0 1 3 4.6V20"/>',
  },
  userShield: {
    labelKey: "adminNavRoles",
    unicode: "♙",
    svg: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m4-11 3 1v3c0 2-1.5 3.8-3 4.5-1.5-.7-3-2.5-3-4.5v-3l3-1Z"/>',
  },
  laptop: {
    labelKey: "adminNavSessions",
    unicode: "▱",
    svg: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20l-2-4H4l-2 4Z"/>',
  },
  clock: {
    labelKey: "adminNavOfflineSessions",
    unicode: "◷",
    svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  },
  shieldHalved: {
    labelKey: "adminNavConsents",
    unicode: "◇",
    svg: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="M12 22V2"/>',
  },
  key: {
    labelKey: "adminNavKeys",
    unicode: "⚿",
    svg: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3m-6-1 3 3"/>',
  },
  clockRotateLeft: {
    labelKey: "adminNavEvents",
    unicode: "↶",
    svg: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  },
  circleInfo: {
    labelKey: "adminServerInfo",
    unicode: "ⓘ",
    svg: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 11v5m0-8h.01" fill="none" stroke="var(--surface)" stroke-width="2.5"/>',
  },
  sliders: {
    labelKey: "adminNavSettings",
    unicode: "☷",
    svg: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  },
} satisfies Record<
  | AppIconName
  | "cancel"
  | "search"
  | "more"
  | "clients"
  | "view"
  | "firstPage"
  | "previousPage"
  | "nextPage"
  | "lastPage"
  | "gaugeHigh"
  | "addressCard"
  | "layerGroup"
  | "users"
  | "userShield"
  | "laptop"
  | "clock"
  | "shieldHalved"
  | "key"
  | "clockRotateLeft"
  | "circleInfo"
  | "sliders",
  { labelKey: string; unicode: string; svg?: string }
>;
