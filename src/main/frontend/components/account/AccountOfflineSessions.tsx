"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { requestAccount, type AccountOfflineSession } from "@/lib/account-api";
import type { PageResponse } from "@/lib/api-types";
import { DetailLoadingState, EmptyState, ErrorState } from "@/components/admin/AsyncState";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { useAdminTableState } from "@/components/admin/useAdminTableState";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { useAccountAuth } from "./AccountAuthProvider";

export function AccountOfflineSessions({ dictionary }: { dictionary: Dictionary }) {
  const { accessToken } = useAccountAuth();
  const copy = dictionary.account.applications;
  const formatDateTime = useDateTimeFormatter();
  const alerts = useConsoleAlerts();
  const { page, size, setPage, setSize } = useAdminTableState();
  const [data, setData] = useState<PageResponse<AccountOfflineSession> | null>(null);
  const [pending, setPending] = useState<AccountOfflineSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    void requestAccount<PageResponse<AccountOfflineSession>>(accessToken, {
      url: `/api/account/offline-sessions?page=${page}&size=${size}`,
    })
      .then((value) => {
        setData(value);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, size]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const revoke = async () => {
    if (!accessToken || !pending) return;
    setBusy(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/offline-sessions/${encodeURIComponent(pending.id)}`,
      });
      setPending(null);
      if ((data?.content.length ?? 0) === 1 && page > 0) {
        setPage(page - 1);
      } else {
        load();
      }
      alerts.addAlert(copy.offlineRevoked);
    } catch {
      alerts.addError(dictionary.account.common.operationError);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <DetailLoadingState />;
  if (error) return <ErrorState message={dictionary.account.common.operationError} />;
  const items = data?.content ?? [];

  return (
    <>
      <Card className="admin-panel-card account-panel-card">
        <Card.Body className="p-0">
          <div className="p-4 border-bottom">
            <h2 className="h5 mb-1">{copy.offlineTitle}</h2>
            <div className="text-body-secondary small">{copy.offlineHelp}</div>
          </div>
          {!items.length ? (
            <EmptyState message={copy.offlineEmpty} />
          ) : (
            <div className="account-application-list">
              {items.map((session) => (
                <div className="account-application-card" key={session.id}>
                  <div className="account-application-icon">
                    <Icon icon="clock" />
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold">{session.clientName}</div>
                    <div className="small text-body-secondary font-monospace text-break">
                      {session.clientId}
                    </div>
                    <div className="account-session-meta mt-3">
                      <span>
                        {copy.offlineIssued}: {formatDateTime(session.issuedAt)}
                      </span>
                      <span>
                        {copy.offlineExpires}:{" "}
                        {session.expiresAt
                          ? formatDateTime(session.expiresAt)
                          : copy.offlineNoExpiry}
                      </span>
                    </div>
                    <Badge bg="secondary" className="mt-2">
                      {copy.offlineBadge}
                    </Badge>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => setPending(session)}
                  >
                    <ActionIcon action="revoke" />
                    {copy.offlineRevoke}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {data && (
            <div className="px-4 pb-4">
              <PaginationControls
                first={dictionary.admin.resources.first}
                last={dictionary.admin.resources.last}
                next={dictionary.admin.resources.next}
                onPageChange={setPage}
                onSizeChange={setSize}
                page={page}
                pageLabel={dictionary.admin.resources.page}
                previous={dictionary.admin.resources.previous}
                rowsPerPage={dictionary.admin.resources.rowsPerPage}
                size={size}
                totalElements={data.totalElements}
                totalPages={data.totalPages}
              />
            </div>
          )}
        </Card.Body>
      </Card>
      <ConfirmModal
        cancelLabel={dictionary.account.common.cancel}
        confirmLabel={copy.offlineRevoke}
        busy={busy}
        message={copy.offlineRevokeConfirm}
        onCancel={() => setPending(null)}
        onConfirm={() => void revoke()}
        show={pending !== null}
      />
    </>
  );
}
