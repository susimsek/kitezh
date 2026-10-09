import type { ReactNode } from "react";

export function ViewHeader({
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
    <header className="console-view-header d-flex flex-wrap justify-content-between align-items-start gap-3">
      <div className="min-w-0">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h1 className="mb-0">{title}</h1>
          {status}
          {help}
        </div>
        {description && <p className="mb-0 mt-2">{description}</p>}
      </div>
      {actions && <div className="console-view-actions d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
