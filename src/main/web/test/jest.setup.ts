import "@testing-library/jest-dom";

import { TextEncoder, TextDecoder } from "node:util";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/common.json";
import tr from "@/locales/tr/common.json";
import type { ComponentProps } from "react";

// Presentational component tests do not mount the application router.
jest.mock("@/routing/Link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => jest.requireActual("react").createElement("a", props),
}));

Object.assign(globalThis, { TextEncoder, TextDecoder });

void i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  resources: { en: { common: en }, tr: { common: tr } },
  initAsync: false,
  interpolation: { escapeValue: false },
});

beforeEach(() => {
  void i18next.changeLanguage("en");
});
