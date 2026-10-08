import type { ReactNode } from "react";
import { ViewHeader } from "@/components/admin/ViewHeader";

export function AccountPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <ViewHeader title={title} description={description} actions={actions} />;
}
