"use client";

import { useParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { UserForm } from "./UserForm";

const SECTIONS = new Set([
  "details",
  "credentials",
  "roles",
  "groups",
  "sessions",
  "consents",
  "events",
]);

export function UserEntityRoute({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { id, section: candidate } = useParams<{ id: string; section: string }>();
  const section = candidate && SECTIONS.has(candidate) ? candidate : "details";

  return (
    <UserForm key={id} locale={locale} dictionary={dictionary} id={id || null} tab={section} />
  );
}
