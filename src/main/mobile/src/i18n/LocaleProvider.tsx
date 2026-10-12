import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  messages,
  resolveLocale,
  type Dictionary,
  type Locale,
} from "@kitezh/shared/i18n";
import { setMobileApiLocale } from "./api-locale";

const LOCALE_KEY = "kitezh.mobile.locale";
const initialSystemLocale = getLocales()[0]?.languageCode ?? "en";
setMobileApiLocale(resolveLocale("system", initialSystemLocale));
type LocaleContextValue = {
  locale: Locale;
  resolvedLocale: keyof typeof messages;
  dictionary: Dictionary;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  reset: () => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("system");
  const [ready, setReady] = useState(false);
  const [systemLocale, setSystemLocale] = useState(initialSystemLocale);
  const resolvedLocale = resolveLocale(locale, systemLocale);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LOCALE_KEY)
      .then((stored) => {
        if (
          active &&
          (stored === "system" || stored === "en" || stored === "tr")
        ) {
          setMobileApiLocale(resolveLocale(stored, systemLocale));
          setLocaleState(stored);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [systemLocale]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const nextSystemLocale = getLocales()[0]?.languageCode ?? "en";
        setSystemLocale(nextSystemLocale);
        if (locale === "system") {
          setMobileApiLocale(resolveLocale("system", nextSystemLocale));
        }
      }
    });
    return () => subscription.remove();
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      resolvedLocale,
      dictionary: messages[resolvedLocale],
      ready,
      setLocale: (nextLocale) => {
        setMobileApiLocale(resolveLocale(nextLocale, systemLocale));
        setLocaleState(nextLocale);
        void SecureStore.setItemAsync(LOCALE_KEY, nextLocale);
      },
      reset: async () => {
        setMobileApiLocale(resolveLocale("system", systemLocale));
        setLocaleState("system");
        await SecureStore.deleteItemAsync(LOCALE_KEY);
      },
    }),
    [locale, ready, resolvedLocale, systemLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
