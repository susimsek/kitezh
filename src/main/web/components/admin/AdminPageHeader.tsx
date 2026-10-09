import type { ReactNode } from "react";
import { ViewHeader } from "./ViewHeader";

export function AdminPageHeader({
  title,
  description,
  actions,
  status,
  help,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  status?: ReactNode;
  help?: ReactNode;
}) {
  return (
    <ViewHeader
      title={title}
      description={description}
      actions={actions}
      status={status}
      help={help}
    />
  );
}
