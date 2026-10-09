"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { useLocale } from "@/i18n/client";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { requestAccount, type AccountSession } from "@/lib/account-api";
import type { PageResponse } from "@/lib/api-types";
import { DetailLoadingState, EmptyState, ErrorState } from "@/components/admin/AsyncState";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { useAdminTableState } from "@/components/admin/useAdminTableState";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { useAccountAuth } from "./AccountAuthProvider";

type PendingAction =
  { type: "single"; session: AccountSession } | { type: "others" } | { type: "all" } | null;

export function AccountSessions({ dictionary }: { dictionary: Dictionary }) {
  const locale = useLocale();
  const formatDateTime = useDateTimeFormatter();
  const { accessToken, logout } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.account;
  const [pending, setPending] = useState<PendingAction>(null);
  const { page, size, setPage, setSize } = useAdminTableState();
  const [data, setData] = useState<PageResponse<AccountSession> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [sessionRemoving, setSessionRemoving] = useState(false);
  const [otherSessionsRemoving, setOtherSessionsRemoving] = useState(false);
  const items = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<PageResponse<AccountSession>>(accessToken, {
      url: `/api/account/sessions?page=${page}&size=${size}`,
    })
      .then((value) => {
        setData(value);
        setIsError(false);
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [accessToken, page, size]);

  const remove = async (id: string) => {
    if (!accessToken) return;
    setSessionRemoving(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/sessions/${encodeURIComponent(id)}`,
      });
      if (items.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        const refreshed = await requestAccount<PageResponse<AccountSession>>(accessToken, {
          url: `/api/account/sessions?page=${page}&size=${size}`,
        });
        setData(refreshed);
      }
      alerts.addAlert(copy.sessions.signOut);
    } catch {
      alerts.addError(copy.common.operationError);
    } finally {
      setSessionRemoving(false);
    }
  };

  const removeOthers = async () => {
    if (!accessToken) return;
    setOtherSessionsRemoving(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: "/api/account/sessions/others",
      });
      if (items.length === 1 && page > 0) {
        setPage(page - 1);
      } else {
        const refreshed = await requestAccount<PageResponse<AccountSession>>(accessToken, {
          url: `/api/account/sessions?page=${page}&size=${size}`,
        });
        setData(refreshed);
      }
      alerts.addAlert(copy.sessions.signOutOthers);
    } catch {
      alerts.addError(copy.common.operationError);
    } finally {
      setOtherSessionsRemoving(false);
    }
  };

  const removeAll = async () => {
    if (!accessToken) return;
    try {
      // Keep the current authorization alive until OIDC logout consumes its ID-token hint.
      // Deleting the current authorization first makes the end-session request invalid.
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: "/api/account/sessions/others",
      });
      await logout(locale);
    } catch {
      alerts.addError(copy.common.operationError);
    }
  };

  const confirm = async () => {
    const action = pending;
    setPending(null);
    if (!action) return;
    if (action.type === "single") await remove(action.session.id);
    if (action.type === "others") await removeOthers();
    if (action.type === "all") await removeAll();
  };

  const confirmMessage =
    pending?.type === "single"
      ? copy.sessions.signOutConfirm
      : pending?.type === "others"
        ? copy.sessions.signOutOthersConfirm
        : copy.sessions.signOutAllConfirm;
  const confirmLabel =
    pending?.type === "all"
      ? copy.sessions.signOutAll
      : pending?.type === "others"
        ? copy.sessions.signOutOthers
        : copy.sessions.signOut;
  const confirmBusy =
    pending?.type === "single"
      ? sessionRemoving
      : pending?.type === "others"
        ? otherSessionsRemoving
        : pending?.type === "all"
          ? otherSessionsRemoving
          : false;

  if (isLoading) return <DetailLoadingState />;
  if (isError) return <ErrorState message={copy.common.operationError} />;

  return (
    <>
      <Card className="admin-panel-card account-panel-card">
        <Card.Body className="p-0">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 p-4 border-bottom">
            <div>
              <h2 className="h5 mb-1">{copy.sessions.title}</h2>
              <div className="text-body-secondary small">{copy.sessions.help}</div>
            </div>
            {items.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                {items.some((session) => !session.current) && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={sessionRemoving || otherSessionsRemoving}
                    onClick={() => setPending({ type: "others" })}
                    data-testid="sign-out-others"
                  >
                    <ActionIcon action="logout" />
                    {copy.sessions.signOutOthers}
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={sessionRemoving || otherSessionsRemoving}
                  onClick={() => setPending({ type: "all" })}
                >
                  <ActionIcon action="logout" />
                  {copy.sessions.signOutAll}
                </Button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState message={copy.common.empty} />
          ) : (
            <div className="account-session-list">
              {items.map((session) => (
                <div
                  className={`account-session-card ${session.current ? "current" : ""}`}
                  key={session.id}
                  data-testid="session-row"
                >
                  <div className="account-session-icon">
                    <Icon icon={session.current ? "shieldHalved" : "desktop"} />
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <strong>
                        {session.current ? copy.sessions.current : copy.sessions.session}
                      </strong>
                      {session.current && <Badge bg="primary">{copy.sessions.current}</Badge>}
                    </div>
                    <div className="font-monospace small text-body-secondary text-truncate">
                      {session.id}
                    </div>
                    <div className="account-session-meta">
                      <span>
                        <Icon icon="clock" />
                        {copy.sessions.created}: {formatDateTime(session.createdAt)}
                      </span>
                      <span>
                        {copy.sessions.lastAccess}: {formatDateTime(session.lastAccessedAt)}
                      </span>
                      <span>
                        {copy.sessions.expires}: {formatDateTime(session.expiresAt)}
                      </span>
                    </div>
                    {session.clients.length > 0 && (
                      <div className="mt-3">
                        <div className="small text-body-secondary mb-2">
                          {copy.sessions.applications}
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          {session.clients.map((client) => (
                            <Badge key={client.clientId} bg="secondary" title={client.clientId}>
                              {client.clientName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {!session.current && (
                    <Button
                      variant="link"
                      className="text-danger text-decoration-none text-nowrap"
                      size="sm"
                      onClick={() => setPending({ type: "single", session })}
                    >
                      <ActionIcon action="logout" />
                      {copy.sessions.signOut}
                    </Button>
                  )}
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
        confirmLabel={confirmLabel}
        busy={confirmBusy}
        message={confirmMessage}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirm()}
        show={pending !== null}
      />
    </>
  );
}
