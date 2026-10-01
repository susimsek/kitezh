"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "react-bootstrap";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

import { useDictionary } from "@/i18n/client";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminPageHeader } from "./AdminPageHeader";
import { ConfirmModal } from "./ConfirmModal";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";
import { useAdminTableState } from "./useAdminTableState";
import { AdminActionIcon } from "./AdminActionIcon";

type OfflineSession = {
  id: string;
  username: string;
  clientId: string;
  clientName: string;
  issuedAt: string;
  expiresAt: string | null;
};

export default function AdminOfflineSessions() {
  const dictionary = useDictionary();
  const copy = dictionary.admin.resources;
  const { accessToken, access } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const date = useDateTimeFormatter();
  const { page, size, setPage, setSize } = useAdminTableState(
    20,
    true,
    "refreshTokenIssuedAt,desc",
  );
  const [data, setData] = useState<PageResponse<OfflineSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<OfflineSession | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    void adminRequest<PageResponse<OfflineSession>>(accessToken, {
      url: `/api/admin/offline-sessions?page=${page}&size=${size}&sort=refreshTokenIssuedAt,desc`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setData(response.data);
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
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/offline-sessions/${encodeURIComponent(pending.id)}`,
      });
      if (response.status >= 300) throw new Error();
      setPending(null);
      load();
      alerts.addAlert(copy.offlineRevoked);
    } catch {
      alerts.addError(copy.operationError);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.operationError} />;
  const items = data?.content ?? [];
  return (
    <>
      <AdminPageHeader title={copy.offlineSessions} description={copy.offlineSessionsDescription} />
      <DataTable
        isEmpty={items.length === 0}
        emptyMessage={copy.empty}
        footer={
          data && data.totalElements > 0 ? (
            <PaginationControls
              page={page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              size={size}
              rowsPerPage={copy.rowsPerPage}
              pageLabel={copy.page}
              previous={copy.previous}
              next={copy.next}
              first={copy.first}
              last={copy.last}
              onPageChange={setPage}
              onSizeChange={setSize}
            />
          ) : undefined
        }
      >
        <thead>
          <tr>
            <th>{copy.user}</th>
            <th>{copy.client}</th>
            <th>{copy.created}</th>
            <th>{copy.expires}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div>{item.username}</div>
                <Badge bg="secondary">{copy.offlineBadge}</Badge>
              </td>
              <td>
                <div>{item.clientName}</div>
                <div className="small text-body-secondary font-monospace">{item.clientId}</div>
              </td>
              <td>{date(item.issuedAt)}</td>
              <td>{item.expiresAt ? date(item.expiresAt) : copy.offlineNoExpiry}</td>
              <td className="text-end">
                {(access?.manageConsents || access?.isAdmin) && (
                  <Button
                    variant="link"
                    className="text-danger"
                    disabled={busy}
                    onClick={() => setPending(item)}
                  >
                    <AdminActionIcon action="revoke" />
                    {copy.revoke}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <ConfirmModal
        cancelLabel={copy.cancel}
        confirmLabel={copy.revoke}
        busy={busy}
        message={copy.offlineRevokeConfirm}
        onCancel={() => setPending(null)}
        onConfirm={() => void revoke()}
        show={pending !== null}
      />
    </>
  );
}
