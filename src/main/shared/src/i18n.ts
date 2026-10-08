export type Locale = "system" | "en" | "tr";
export type SupportedLocale = Exclude<Locale, "system">;

export const messages = {
  en: {
    appTagline: "Secure identity and access for your organization.",
    continue: "Continue",
    mobilePreview: "Mobile app foundation",
    language: "Language",
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  tr: {
    appTagline: "Kurumunuz için güvenli kimlik ve erişim.",
    continue: "Devam et",
    mobilePreview: "Mobil uygulama temeli",
    language: "Dil",
    theme: "Tema",
    system: "Sistem",
    light: "Açık",
    dark: "Koyu",
  },
} as const;

export type Dictionary = (typeof messages)[SupportedLocale];

export function resolveLocale(locale: Locale): SupportedLocale {
  return locale === "tr" ? "tr" : "en";
}
