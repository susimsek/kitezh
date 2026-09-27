"use client";

import { useParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { ClientDetail } from "./ClientDetail";

const SECTIONS = new Set([
  "settings",
  "credentials",
  "scopes",
  "roles",
  "sessions",
  "consents",
  "events",
]);

export function ClientEntityRoute({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { id, section: candidate } = useParams<{ id: string; section: string }>();
  const section = candidate && SECTIONS.has(candidate) ? candidate : "settings";

  return (
    <ClientDetail key={id} locale={locale} dictionary={dictionary} id={id || null} tab={section} />
  );
}
