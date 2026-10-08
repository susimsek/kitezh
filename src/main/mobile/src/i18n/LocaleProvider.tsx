import * as SecureStore from "expo-secure-store";
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
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("system");
  const resolvedLocale = resolveLocale(locale);

  useEffect(() => {
    void SecureStore.getItemAsync(LOCALE_KEY).then((stored) => {
      if (stored === "system" || stored === "en" || stored === "tr") {
        setLocaleState(stored);
      }
    });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      resolvedLocale,
      dictionary: messages[resolvedLocale],
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        void SecureStore.setItemAsync(LOCALE_KEY, nextLocale);
      },
    }),
    [locale, resolvedLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
