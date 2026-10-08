import { defineConfig } from "next-i18next";
import en from "./locales/en/common.json";
import tr from "./locales/tr/common.json";

export default defineConfig({
  supportedLngs: ["en", "tr"],
  fallbackLng: "en",
  defaultNS: "common",
  localeInPath: false,
  cookieName: "locale",
  cookieMaxAge: 31536000,
  resources: { en: { common: en }, tr: { common: tr } },
});
