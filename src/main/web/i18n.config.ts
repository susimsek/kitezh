import { defineConfig } from "next-i18next";
import en from "@kitezh/shared/web-messages/en";
import tr from "@kitezh/shared/web-messages/tr";

export default defineConfig({
  supportedLngs: ["en", "tr"],
  fallbackLng: "en",
  defaultNS: "common",
  localeInPath: false,
  cookieName: "locale",
  cookieMaxAge: 31536000,
  resources: { en: { common: en }, tr: { common: tr } },
});
