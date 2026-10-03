"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/client";
import { persistLocale } from "@/i18n/locale-cookie";
import { Dropdown } from "react-bootstrap";
import { Icon } from "@/components/shared/Icon";

import { locales, type Locale } from "@/i18n/config";

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  accessToken?: string | null;
};

const languageNames: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
};

type LocalizationSettings = {
  internationalizationEnabled: boolean;
  defaultLocale: Locale;
  supportedLocales: Locale[];
};

export function LanguageSwitcher({ label, accessToken }: LanguageSwitcherProps) {
  const { i18n } = useTranslation("common");
  const activeLocale = useLocale();
  const [supportedLocales, setSupportedLocales] = useState<Locale[]>([...locales]);

  useEffect(() => {
    if (typeof fetch !== "function") return;
    void fetch("/api/auth/localization", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((settings: LocalizationSettings) => {
        const enabled = settings.internationalizationEnabled
          ? settings.supportedLocales.filter((value): value is Locale => locales.includes(value))
          : [settings.defaultLocale];
        setSupportedLocales(enabled.length > 0 ? enabled : ["en"]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!accessToken || typeof fetch !== "function") return;
    void fetch("/api/auth/localization/me", {
      credentials: "same-origin",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((preference: { locale?: string | null }) => {
        if (
          preference.locale &&
          locales.includes(preference.locale as Locale) &&
          supportedLocales.includes(preference.locale as Locale)
        ) {
          const preferred = preference.locale as Locale;
          persistLocale(preferred);
          void i18n.changeLanguage(preferred);
        }
      })
      .catch(() => undefined);
  }, [accessToken, i18n, supportedLocales]);

  function changeLanguage(nextLocale: Locale) {
    persistLocale(nextLocale);
    void i18n.changeLanguage(nextLocale);
    if (accessToken && typeof fetch === "function") {
      void fetch("/api/auth/localization/me", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: nextLocale }),
      }).catch(() => undefined);
    }
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        size="sm"
        className="console-navbar-control"
        aria-label={label}
        title={languageNames[activeLocale]}
      >
        <Icon icon="globe" className="me-2" />
        <span className="console-navbar-label">{languageNames[activeLocale]}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {supportedLocales.map((language) => (
          <Dropdown.Item
            key={language}
            active={language === activeLocale}
            onClick={() => changeLanguage(language)}
          >
            {languageNames[language]}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
