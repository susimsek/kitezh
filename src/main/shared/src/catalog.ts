import webEn from "./web-locales/en/common.json";
import webTr from "./web-locales/tr/common.json";
import { messages as nativeMessages } from "./i18n.js";

export const messages = {
  en: { native: nativeMessages.en, web: webEn },
  tr: { native: nativeMessages.tr, web: webTr },
};

export type Catalog = typeof messages;
