"use client";

import { I18nProvider } from "next-i18next/client";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import config from "@/i18n.config";
import en from "@/locales/en/common.json";
import { defaultLocale, isLocale } from "./config";
import type { Dictionary } from "./get-dictionary";
import { DESKTOP_LANGUAGE_MODE_KEY, detectLocale, persistLocale } from "./locale-cookie";
import { isDesktopRuntime } from "@/lib/desktop-api";
import { setLocale } from "@/store/locale-slice";
import { useAppDispatch } from "@/store/hooks";
import { messageBundles } from "./bundles";

export function ClientI18nProvider({ children }: { children: ReactNode }) {
  const [initialLocale] = useState(() => {
    const desktopSystemLanguage =
      isDesktopRuntime() && localStorage.getItem(DESKTOP_LANGUAGE_MODE_KEY) === "system";
    return detectLocale(desktopSystemLanguage ? "" : document.cookie, navigator.languages);
  });
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setLocale(initialLocale));
  }, [dispatch, initialLocale]);
  return (
    <I18nProvider
      language={initialLocale}
      resources={config.resources}
      supportedLngs={config.supportedLngs}
      fallbackLng={config.fallbackLng}
      defaultNS={config.defaultNS}
    >
      <LocaleEffects />
      <LocaleOverrideEffects />
      {children}
    </I18nProvider>
  );
}

function LocaleOverrideEffects() {
  const { i18n } = useTranslation("common");

  useEffect(() => {
    if (typeof fetch !== "function") return;
    let cancelled = false;
    void Promise.all(
      (["en", "tr"] as const).flatMap((locale) =>
        messageBundles
          .filter((bundle) => bundle !== "backend" && bundle !== "email")
          .map(async (bundle) => {
            try {
              const response = await fetch(
                `/api/auth/localization/messages?locale=${locale}&bundle=${bundle}`,
                { credentials: "same-origin" },
              );
              if (!response.ok) return;
              const messages = (await response.json()) as Record<string, string>;
              if (!cancelled) {
                Object.entries(messages).forEach(([key, value]) => {
                  i18n.addResource(locale, "common", key, value);
                });
              }
            } catch {
              // Bundled dictionaries remain the fallback when the override endpoint is unavailable.
            }
          }),
      ),
    );
    return () => {
      cancelled = true;
    };
  }, [i18n]);

  return null;
}

function LocaleEffects() {
  const locale = useLocale();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setLocale(locale));
    document.documentElement.lang = locale;
    persistLocale(locale);
    if (isDesktopRuntime() && window.desktopApi) {
      void window.desktopApi.language.set(locale);
    }
  }, [dispatch, locale]);
  return null;
}

export function useLocale() {
  const { i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return isLocale(language ?? "") ? (language as "en" | "tr") : defaultLocale;
}

/** Typed translation objects for the existing presentational component props. */
export function useDictionary(): Dictionary {
  const { i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage ?? defaultLocale;
  return (i18n.getResourceBundle?.(language, "common") ?? en) as Dictionary;
}
