"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { requestAccount, type AccountApplication } from "@/lib/account-api";
import type { PageResponse } from "@/lib/api-types";
import { DetailLoadingState, EmptyState, ErrorState } from "@/components/admin/AsyncState";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { useAdminTableState } from "@/components/admin/useAdminTableState";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { useAccountAuth } from "./AccountAuthProvider";
import { AccountOfflineSessions } from "./AccountOfflineSessions";

export function AccountApplications({ dictionary }: { dictionary: Dictionary }) {
  const formatDateTime = useDateTimeFormatter();
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.account;
  const [pending, setPending] = useState<AccountApplication | null>(null);
  const { page, size, setPage, setSize } = useAdminTableState();
  const [data, setData] = useState<PageResponse<AccountApplication> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [applicationRevoking, setApplicationRevoking] = useState(false);
  const items = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<PageResponse<AccountApplication>>(accessToken, {
      url: `/api/account/applications?page=${page}&size=${size}`,
    })
      .then((value) => {
        setData(value);
        setIsError(false);
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [accessToken, page, size]);

  const revoke = async (application: AccountApplication) => {
    if (!accessToken) return;
    setApplicationRevoking(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/applications/${encodeURIComponent(application.clientId)}`,
      });
      if (items.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        const refreshed = await requestAccount<PageResponse<AccountApplication>>(accessToken, {
          url: `/api/account/applications?page=${page}&size=${size}`,
        });
        setData(refreshed);
        setIsError(false);
      }
      alerts.addAlert(copy.applications.revoke);
    } catch {
      alerts.addError(copy.common.operationError);
    } finally {
      setApplicationRevoking(false);
    }
  };

  if (isLoading) return <DetailLoadingState />;
  if (isError) return <ErrorState message={copy.common.operationError} />;

  return (
    <>
      <Card className="admin-panel-card account-panel-card">
        <Card.Body className="p-0">
          <div className="p-4 border-bottom">
            <h2 className="h5 mb-1">{copy.applications.title}</h2>
            <div className="text-body-secondary small">{copy.applications.help}</div>
          </div>
          {items.length === 0 ? (
            <EmptyState message={copy.common.empty} />
          ) : (
            <div className="account-application-list">
              {items.map((application) => (
                <div
                  className="account-application-card"
                  key={application.clientId}
                  data-cy="application-row"
                >
                  <div className="account-application-icon">
                    <Icon icon="cube" />
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold">{application.clientName}</div>
                    <div className="small text-body-secondary font-monospace text-break">
                      {application.clientId}
                    </div>
                    <div className="small text-body-secondary mt-3 mb-2">
                      <Icon className="me-2" icon="shieldHalved" />
                      {copy.applications.access}
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {application.scopes.map((scope) => (
                        <Badge key={scope} bg="secondary">
                          {scope.replace(/^SCOPE_/, "")}
                        </Badge>
                      ))}
                    </div>
                    <div className="account-session-meta mt-3">
                      <span>
                        {copy.applications.grantedAt}: {formatDateTime(application.createdAt)}
                      </span>
                      <span>
                        {copy.applications.updatedAt}: {formatDateTime(application.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={applicationRevoking}
                    onClick={() => setPending(application)}
                  >
                    <ActionIcon action="revoke" />
                    {copy.applications.revoke}
                  </Button>
                </div>
              ))}
            </div>
          )}
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
              totalElements={totalElements}
              totalPages={totalPages}
            />
          </div>
        </Card.Body>
      </Card>

      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.applications.revoke}
        busy={applicationRevoking}
        message={copy.applications.revokeConfirm}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const application = pending;
          setPending(null);
          if (application) void revoke(application);
        }}
        show={pending !== null}
      />
      <AccountOfflineSessions dictionary={dictionary} />
    </>
  );
}
