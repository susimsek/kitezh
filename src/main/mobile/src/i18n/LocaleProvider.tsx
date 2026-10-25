import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  messages,
  resolveLocale,
  type Dictionary,
  type Locale,
} from "@kitezh/shared/i18n";
import { setMobileApiLocale } from "./api-locale";
import { createPreferenceStorage } from "../preferences/preference-storage";

const LOCALE_KEY = "kitezh.mobile.locale";
const initialSystemLocale = getLocales()[0]?.languageCode ?? "en";
setMobileApiLocale(resolveLocale("system", initialSystemLocale));

function isLocale(value: string | null): value is Locale {
  return value === "system" || value === "en" || value === "tr";
}

type LocaleContextValue = {
  locale: Locale;
  resolvedLocale: keyof typeof messages;
  dictionary: Dictionary;
  ready: boolean;
  saving: boolean;
  storageError: boolean;
  setLocale: (locale: Locale) => Promise<boolean>;
  reset: () => Promise<boolean>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [systemLocale, setSystemLocale] = useState(initialSystemLocale);
  const localeRef = useRef<Locale>("system");
  const revision = useRef(0);
  const savingRef = useRef(false);
  const preferenceStorage = useMemo(
    () => createPreferenceStorage(SecureStore, LOCALE_KEY, isLocale),
    [],
  );
  const resolvedLocale = resolveLocale(locale, systemLocale);

  useEffect(() => {
    let active = true;
    const readRevision = revision.current;
    void preferenceStorage
      .read()
      .then((stored) => {
        if (active && revision.current === readRevision && stored) {
          localeRef.current = stored;
          setMobileApiLocale(resolveLocale(stored, systemLocale));
          setLocaleState(stored);
        }
      })
      .catch(() => {
        if (active && revision.current === readRevision) {
          setStorageError(true);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [preferenceStorage, systemLocale]);

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

  const setLocale = useCallback(
    async (nextLocale: Locale) => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      setStorageError(false);
      const currentRevision = ++revision.current;
      const previousLocale = localeRef.current;
      localeRef.current = nextLocale;
      setMobileApiLocale(resolveLocale(nextLocale, systemLocale));
      setLocaleState(nextLocale);
      try {
        await preferenceStorage.save(nextLocale);
        return true;
      } catch {
        if (revision.current === currentRevision) {
          localeRef.current = previousLocale;
          setMobileApiLocale(resolveLocale(previousLocale, systemLocale));
          setLocaleState(previousLocale);
          setStorageError(true);
        }
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [preferenceStorage, systemLocale],
  );

  const reset = useCallback(async () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setStorageError(false);
    const currentRevision = ++revision.current;
    const previousLocale = localeRef.current;
    localeRef.current = "system";
    setMobileApiLocale(resolveLocale("system", systemLocale));
    setLocaleState("system");
    try {
      await preferenceStorage.reset();
      return true;
    } catch {
      if (revision.current === currentRevision) {
        localeRef.current = previousLocale;
        setMobileApiLocale(resolveLocale(previousLocale, systemLocale));
        setLocaleState(previousLocale);
        setStorageError(true);
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [preferenceStorage, systemLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      resolvedLocale,
      dictionary: messages[resolvedLocale],
      ready,
      saving,
      storageError,
      setLocale,
      reset,
    }),
    [locale, ready, resolvedLocale, reset, saving, setLocale, storageError],
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
