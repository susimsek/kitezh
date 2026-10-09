"use client";

import { Navigate } from "react-router-dom";
import { useParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { RoleDetail, type RoleDetailTab } from "./RoleDetail";

const SECTIONS = new Set<RoleDetailTab>(["details", "users"]);

export function RoleEntityRoute({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { id, section: candidate } = useParams<{ id: string; section: string }>();
  const section = candidate && SECTIONS.has(candidate as RoleDetailTab) ? candidate : null;

  if (!id || !section) {
    return <Navigate to={`/admin/roles/${encodeURIComponent(id ?? "")}/details`} replace />;
  }

  return (
    <RoleDetail
      key={`${id}-${section}`}
      locale={locale}
      dictionary={dictionary}
      name={id}
      tab={section as RoleDetailTab}
    />
  );
}
