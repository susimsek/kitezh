import type { ReactNode } from "react";
import { useDictionary } from "@/i18n/client";
import { Alert } from "react-bootstrap";

function useAdminCopy() {
  return useDictionary().admin.common;
}

export function LoadingState() {
  const copy = useAdminCopy();
  return (
    <div className="console-skeleton" role="status" aria-label={copy.loading}>
      <div className="console-skeleton-title" />
      <div className="console-skeleton-toolbar" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="console-skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function DetailLoadingState() {
  const copy = useAdminCopy();
  return (
    <div
      className="console-skeleton console-skeleton-detail"
      role="status"
      aria-label={copy.loading}
    >
      <div className="console-skeleton-title" />
      <div className="console-skeleton-detail-line" />
      <div className="console-skeleton-detail-card" />
      <div className="console-skeleton-detail-card" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <Alert variant="danger">{message}</Alert>;
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="console-empty-state text-center text-body-secondary">
      <div>{message}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
