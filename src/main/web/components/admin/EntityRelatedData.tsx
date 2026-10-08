"use client";

import { useEffect, useState } from "react";
import Link from "@/routing/Link";
import { Badge, Button, Spinner } from "react-bootstrap";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { encodeConsentRouteKey } from "@/lib/consent-route";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { DataTable } from "./DataTable";
import { ErrorState, LoadingState } from "./AsyncState";
import { PaginationControls } from "./PaginationControls";

export type RelatedResource = "sessions" | "consents" | "events";

type Session = {
  id: string;
  username: string | null;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  authorizationCount: number;
};

type Consent = {
  clientId: string;
  clientName: string;
  principalName: string;
  userId: number | null;
  authorities: string[];
  createdAt: string;
  updatedAt: string;
};

type Event = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  occurredAt: string;
};

export function EntityRelatedData({
  resource,
  url,
  locale,
  dictionary,
  canManage = false,
  refreshKey = 0,
}: {
  resource: RelatedResource;
  url: string;
  locale: Locale;
  dictionary: Dictionary;
  canManage?: boolean;
  refreshKey?: number;
}) {
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [items, setItems] = useState<Array<Session | Consent | Event>>([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const copy = dictionary.admin.resources;

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<Session | Consent | Event>>(accessToken, {
      url: `${url}?page=${page}&size=${size}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setItems(response.data.content);
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, page, size, url, version, refreshKey]);

  const removeSession = async (session: Session) => {
    if (!canManage || !accessToken) return;
    setActionBusy(session.id);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/sessions/${encodeURIComponent(session.id)}`,
      });
      if (response.status >= 300) {
        alerts.addError(copy.operationError);
        return;
      }
      alerts.addAlert(copy.sessionTerminated);
      setLoading(true);
      setVersion((current) => current + 1);
    } finally {
      setActionBusy(null);
    }
  };

  const revokeConsent = async (consent: Consent) => {
    if (!canManage || !accessToken) return;
    const actionKey = `${consent.clientId}:${consent.principalName}`;
    setActionBusy(actionKey);
    try {
      const response = await adminRequest(accessToken, {
        method: "DELETE",
        url: `/api/admin/consents/${encodeURIComponent(consent.clientId)}/${encodeURIComponent(consent.principalName)}`,
      });
      if (response.status >= 300) {
        alerts.addError(copy.operationError);
        return;
      }
      alerts.addAlert(copy.consentRevoked);
      setLoading(true);
      setVersion((current) => current + 1);
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.operationError} />;

  return (
    <DataTable
      isEmpty={items.length === 0}
      emptyMessage={copy.empty}
      footer={
        totalElements > 0 ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            size={size}
            rowsPerPage={copy.rowsPerPage}
            pageLabel={copy.page}
            previous={copy.previous}
            next={copy.next}
            first={copy.first}
            last={copy.last}
            onPageChange={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
            onSizeChange={(nextSize) => {
              setLoading(true);
              setPage(0);
              setSize(nextSize);
            }}
          />
        ) : undefined
      }
    >
      {resource === "sessions" && (
        <>
          <thead>
            <tr>
              <th>{copy.user}</th>
              <th>{copy.created}</th>
              <th>{copy.lastActive}</th>
              <th>{copy.expires}</th>
              <th>{copy.authorizations}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {(items as Session[]).map((session) => (
              <tr key={session.id}>
                <td>{session.username ?? "—"}</td>
                <td>{new Date(session.createdAt).toLocaleString(locale)}</td>
                <td>{new Date(session.lastAccessedAt).toLocaleString(locale)}</td>
                <td>{new Date(session.expiresAt).toLocaleString(locale)}</td>
                <td>{session.authorizationCount}</td>
                {canManage && (
                  <td className="text-end">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={actionBusy !== null}
                      onClick={() => void removeSession(session)}
                    >
                      {actionBusy === session.id ? (
                        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                      ) : (
                        <AdminActionIcon action="remove" />
                      )}
                      {copy.signOut}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </>
      )}
      {resource === "consents" && (
        <>
          <thead>
            <tr>
              <th>{copy.user}</th>
              <th>{copy.client}</th>
              <th>{copy.grantedScopes}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(items as Consent[]).map((consent) => (
              <tr key={`${consent.clientId}:${consent.principalName}`}>
                <td data-label={copy.user}>
                  {consent.userId ? (
                    <Link href={`/admin/users/${consent.userId}/details`}>
                      {consent.principalName}
                    </Link>
                  ) : (
                    consent.principalName
                  )}
                </td>
                <td data-label={copy.client}>
                  <Link href={`/admin/clients/${encodeURIComponent(consent.clientId)}/settings`}>
                    {consent.clientName}
                  </Link>
                </td>
                <td>
                  <div className="d-flex flex-wrap gap-1">
                    {consent.authorities.map((authority) => (
                      <Badge bg="secondary" key={authority}>
                        {authority}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="text-end">
                  <div className="d-flex justify-content-end gap-2 flex-wrap">
                    <Link
                      className="btn btn-sm btn-secondary"
                      href={`/admin/consents/${encodeConsentRouteKey(consent.clientId, consent.principalName)}`}
                    >
                      <AdminActionIcon action="view" />
                      {copy.details}
                    </Link>
                    {canManage && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={actionBusy !== null}
                        onClick={() => void revokeConsent(consent)}
                      >
                        {actionBusy === `${consent.clientId}:${consent.principalName}` ? (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        ) : (
                          <AdminActionIcon action="revoke" />
                        )}
                        {copy.revoke}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </>
      )}
      {resource === "events" && (
        <>
          <thead>
            <tr>
              <th>{copy.time}</th>
              <th>{copy.action}</th>
              <th>{copy.actor}</th>
              <th>{copy.target}</th>
            </tr>
          </thead>
          <tbody>
            {(items as Event[]).map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.occurredAt).toLocaleString(locale)}</td>
                <td>
                  <code>{event.action}</code>
                </td>
                <td>{event.actor}</td>
                <td className="font-monospace small">{event.targetId}</td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </DataTable>
  );
}
