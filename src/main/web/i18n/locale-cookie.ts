import config from "@/i18n.config";
import { defaultLocale, isLocale, type Locale } from "./config";

export const DESKTOP_LANGUAGE_MODE_KEY = "KITEZH_DESKTOP_LANGUAGE_MODE";

export function detectLocale(cookie: string, browserLanguages: readonly string[]): Locale {
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${config.cookieName}=`))
    ?.split("=")[1];
  if (value && isLocale(value)) return value;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

export function persistLocale(locale: Locale) {
  document.cookie = `${config.cookieName}=${locale}; Path=/; Max-Age=${config.cookieMaxAge}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}
