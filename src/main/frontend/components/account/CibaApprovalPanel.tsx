"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner, Stack } from "react-bootstrap";

import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import type { Dictionary } from "@/i18n/get-dictionary";
import { requestAccount, type CibaPendingRequest } from "@/lib/account-api";
import type { PageResponse } from "@/lib/api-types";
import { EmptyState } from "@/components/admin/AsyncState";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAccountAuth } from "./AccountAuthProvider";

type Action = { type: "approve" | "deny"; authReqId: string } | null;

export function CibaApprovalPanel({ dictionary }: { dictionary: Dictionary }) {
  const formatDateTime = useDateTimeFormatter();
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.account.security.ciba;
  const [requests, setRequests] = useState<CibaPendingRequest[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [action, setAction] = useState<Action>(null);

  const load = useCallback(() => {
    if (!accessToken) return Promise.resolve();
    return requestAccount<PageResponse<CibaPendingRequest>>(accessToken, {
      url: "/api/ciba/requests?page=0&size=20&sort=createdAt,desc",
    })
      .then((response) => {
        setRequests(response.content);
        setHasError(false);
      })
      .catch(() => setHasError(true));
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (request: CibaPendingRequest, type: "approve" | "deny") => {
    if (!accessToken) return;
    setAction({ type, authReqId: request.authReqId });
    try {
      await requestAccount<void>(accessToken, {
        method: "POST",
        url: `/api/ciba/requests/${encodeURIComponent(request.authReqId)}/${type}?user_code=${encodeURIComponent(request.userCode)}`,
      });
      setRequests(
        (current) => current?.filter((item) => item.authReqId !== request.authReqId) ?? null,
      );
      alerts.addAlert(type === "approve" ? copy.approved : copy.denied);
    } catch {
      alerts.addError(copy.actionError);
    } finally {
      setAction(null);
    }
  };

  return (
    <Card className="admin-panel-card account-panel-card">
      <Card.Header className="bg-body p-4 border-bottom">
        <h2 className="h5 mb-1">{copy.title}</h2>
        <div className="small text-body-secondary">{copy.help}</div>
      </Card.Header>
      <Card.Body className="p-4">
        {hasError && <Alert variant="danger">{copy.loadError}</Alert>}
        {requests === null && !hasError ? (
          <div className="d-flex align-items-center gap-2" role="status">
            <Spinner animation="border" size="sm" />
            <span>{dictionary.account.common.loading}</span>
          </div>
        ) : requests?.length === 0 ? (
          <EmptyState message={copy.empty} />
        ) : (
          <Stack gap={3}>
            {(requests ?? []).map((request) => {
              const busy = action?.authReqId === request.authReqId;
              return (
                <div className="border rounded-2 p-3" key={request.authReqId}>
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <div className="fw-semibold">
                        {request.bindingMessage ?? copy.requestTitle}
                      </div>
                      <div className="small text-body-secondary mt-1">
                        {copy.code}: <code>{request.userCode}</code>
                      </div>
                      <div className="small text-body-secondary">
                        {copy.scopes}: {request.authorizedScopes}
                      </div>
                      <div className="small text-body-secondary">
                        {copy.expires}: {formatDateTime(request.expiresAt)}
                      </div>
                    </div>
                    <Badge bg="secondary">{request.deliveryMode}</Badge>
                  </div>
                  {(request.mfaRequired || request.stepUpRequired) && (
                    <div className="small text-warning-emphasis mt-2">
                      {request.mfaRequired && request.stepUpRequired
                        ? copy.mfaAndStepUp
                        : request.mfaRequired
                          ? copy.mfaRequired
                          : copy.stepUpRequired}
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={busy || action !== null}
                      onClick={() => void decide(request, "approve")}
                    >
                      {busy && action?.type === "approve" ? (
                        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                      ) : (
                        <ActionIcon action="check" />
                      )}
                      {copy.approve}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy || action !== null}
                      onClick={() => void decide(request, "deny")}
                    >
                      {busy && action?.type === "deny" ? (
                        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                      ) : (
                        <ActionIcon action="cancel" />
                      )}
                      {copy.deny}
                    </Button>
                  </div>
                </div>
              );
            })}
          </Stack>
        )}
      </Card.Body>
    </Card>
  );
}
