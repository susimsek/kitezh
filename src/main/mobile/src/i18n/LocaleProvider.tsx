import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  messages,
  resolveLocale,
  type Dictionary,
  type Locale,
} from "@kitezh/shared/i18n";

const LOCALE_KEY = "kitezh.mobile.locale";
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
  const systemLocale = getLocales()[0]?.languageCode ?? "en";
  const resolvedLocale = resolveLocale(locale, systemLocale);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LOCALE_KEY)
      .then((stored) => {
        if (
          active &&
          (stored === "system" || stored === "en" || stored === "tr")
        ) {
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
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      resolvedLocale,
      dictionary: messages[resolvedLocale],
      ready,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        void SecureStore.setItemAsync(LOCALE_KEY, nextLocale);
      },
      reset: async () => {
        setLocaleState("system");
        await SecureStore.deleteItemAsync(LOCALE_KEY);
      },
    }),
    [locale, ready, resolvedLocale],
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
