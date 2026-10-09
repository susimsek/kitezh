"use client";

import { Navigate } from "react-router-dom";
import { useParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { GroupDetail, type GroupDetailTab } from "./GroupDetail";

const SECTIONS = new Set<GroupDetailTab>(["details", "permissions", "roles", "members"]);

export function GroupEntityRoute({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { id, section: candidate } = useParams<{ id: string; section: string }>();
  const section = candidate && SECTIONS.has(candidate as GroupDetailTab) ? candidate : null;

  if (!id || !section) {
    return <Navigate to={`/admin/groups/${encodeURIComponent(id ?? "")}/details`} replace />;
  }

  return (
    <GroupDetail
      key={`${id}-${section}`}
      locale={locale}
      dictionary={dictionary}
      id={id}
      tab={section as GroupDetailTab}
    />
  );
}
