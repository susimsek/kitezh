import type { MenuItemConstructorOptions } from "electron";

type ApplicationMenuActions = {
  about: () => void;
  settings: () => void;
  checkForUpdates: () => void;
  logout: () => void;
  quickAccess: () => void;
  toggleDeveloperTools: () => void;
};

type ApplicationMenuOptions = {
  appName: string;
  language: "en" | "tr";
  platform: string;
  devToolsEnabled: boolean;
  actions: ApplicationMenuActions;
};

export function createApplicationMenuTemplate({
  appName,
  language,
  platform,
  devToolsEnabled,
  actions,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  const isTurkish = language === "tr";
  const applicationMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      {
        label: isTurkish ? `${appName} hakkında` : `About ${appName}`,
        click: actions.about,
      },
      { type: "separator" },
      {
        label: isTurkish ? "Ayarlar…" : "Settings…",
        click: actions.settings,
      },
      {
        label: isTurkish ? "Güncellemeleri denetle…" : "Check for Updates…",
        click: actions.checkForUpdates,
      },
      { type: "separator" },
      {
        id: "desktop-logout",
        label: isTurkish ? "Oturumu kapat" : "Log Out",
        click: actions.logout,
      },
      { type: "separator" },
      { role: "services", submenu: [] },
      { type: "separator" },
      {
        role: "hide",
        label: isTurkish ? `${appName} uygulamasını gizle` : `Hide ${appName}`,
      },
      {
        role: "hideOthers",
        label: isTurkish ? "Diğerlerini gizle" : "Hide Others",
      },
      { role: "unhide", label: isTurkish ? "Tümünü göster" : "Show All" },
      { type: "separator" },
      {
        role: "quit",
        label: isTurkish ? `${appName}'ten çık` : `Quit ${appName}`,
      },
    ],
  };
  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: isTurkish ? "Hızlı erişim…" : "Quick Access…",
      click: actions.quickAccess,
    },
    { type: "separator" },
    { role: "reload", label: isTurkish ? "Yeniden yükle" : "Reload" },
    {
      role: "forceReload",
      label: isTurkish ? "Önbelleği kullanmadan yeniden yükle" : "Force Reload",
    },
    { type: "separator" },
    ...(devToolsEnabled
      ? [
          {
            label: isTurkish
              ? "Geliştirici araçlarını aç/kapat"
              : "Toggle Developer Tools",
            click: actions.toggleDeveloperTools,
          },
          { type: "separator" as const },
        ]
      : []),
    { role: "resetZoom", label: isTurkish ? "Gerçek boyut" : "Actual Size" },
    { role: "zoomIn", label: isTurkish ? "Yakınlaştır" : "Zoom In" },
    { role: "zoomOut", label: isTurkish ? "Uzaklaştır" : "Zoom Out" },
    { type: "separator" },
    {
      role: "togglefullscreen",
      label: isTurkish ? "Tam ekranı aç/kapat" : "Toggle Full Screen",
    },
  ];
  return [
    applicationMenu,
    {
      label: isTurkish ? "Düzenle" : "Edit",
      submenu: [
        { role: "undo", label: isTurkish ? "Geri al" : "Undo" },
        { role: "redo", label: isTurkish ? "Yinele" : "Redo" },
        { type: "separator" },
        { role: "cut", label: isTurkish ? "Kes" : "Cut" },
        { role: "copy", label: isTurkish ? "Kopyala" : "Copy" },
        { role: "paste", label: isTurkish ? "Yapıştır" : "Paste" },
        { role: "selectAll", label: isTurkish ? "Tümünü seç" : "Select All" },
      ],
    },
    { label: isTurkish ? "Görünüm" : "View", submenu: viewSubmenu },
    {
      role: "windowMenu",
      label: isTurkish ? "Pencere" : "Window",
      submenu: [
        {
          role: "minimize",
          label: isTurkish ? "Simge durumuna küçült" : "Minimize",
        },
        { role: "zoom", label: isTurkish ? "Pencereyi büyüt/küçült" : "Zoom" },
        { role: "close", label: isTurkish ? "Kapat" : "Close" },
        ...(platform === "darwin"
          ? [
              { type: "separator" as const },
              {
                role: "front" as const,
                label: isTurkish ? "Tümünü öne getir" : "Bring All to Front",
              },
            ]
          : []),
      ],
    },
    { role: "help", label: isTurkish ? "Yardım" : "Help" },
  ];
}
