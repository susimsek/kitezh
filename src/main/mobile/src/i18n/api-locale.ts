export type ApiLocale = "en" | "tr";

let currentApiLocale: ApiLocale = "en";

export function setMobileApiLocale(locale: ApiLocale) {
  currentApiLocale = locale;
}

export function getMobileApiLocale() {
  return currentApiLocale;
}
