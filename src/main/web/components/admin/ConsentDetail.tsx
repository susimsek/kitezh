"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "react-bootstrap";
import Link from "@/routing/Link";
import { useRouter } from "@/routing/navigation";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { decodeConsentRouteKey } from "@/lib/consent-route";

import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";
import { DetailLoadingState, ErrorState } from "./AsyncState";
import { ViewHeader } from "./ViewHeader";

type Consent = {
  clientId: string;
  clientName: string;
  principalName: string;
  userId: number | null;
  authorities: string[];
  createdAt: string;
  updatedAt: string;
};

export function ConsentDetail({
  locale,
  dictionary,
  routeKey,
}: {
  locale: Locale;
  dictionary: Dictionary;
  routeKey: string;
}) {
  const router = useRouter();
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const actualKey = routeKey;
  const identity = decodeConsentRouteKey(actualKey);
  const clientId = identity?.clientId ?? null;
  const username = identity?.username ?? null;
  const [consent, setConsent] = useState<Consent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !clientId || !username) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await adminRequest<Consent>(accessToken, {
        url: `/api/admin/consents/${encodeURIComponent(clientId)}/${encodeURIComponent(username)}`,
      });
      if (response.status >= 300) throw new Error();
      setConsent(response.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, clientId, username]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const revoke = async () => {
    if (!access?.manageConsents || !accessToken || !consent) return;
    const response = await adminRequest(accessToken, {
      url: `/api/admin/consents/${encodeURIComponent(consent.clientId)}/${encodeURIComponent(consent.principalName)}`,
      method: "DELETE",
    });
    if (response.status >= 300) {
      alerts.addError(dictionary.admin.resources.operationError);
      return;
    }
    alerts.addAlert(dictionary.admin.resources.consentRevoked);
    router.replace(`/admin/consents`);
  };

  if (loading && !consent) return <DetailLoadingState />;
  if (error || !consent) {
    return <ErrorState message={dictionary.admin.resources.operationError} />;
  }

  return (
    <div className="d-grid gap-4">
      <AdminBreadcrumb
        items={[
          { label: dictionary.admin.nav.consents, href: `/admin/consents` },
          { label: `${consent.principalName} · ${consent.clientName}` },
        ]}
      />
      <ViewHeader
        title={dictionary.admin.resources.consentDetails}
        description={dictionary.admin.resources.consentDescription}
        actions={
          access?.manageConsents ? (
            <Button variant="danger" onClick={() => setShowRevoke(true)}>
              <AdminActionIcon action="revoke" />
              {dictionary.admin.resources.revoke}
            </Button>
          ) : undefined
        }
      />

      <Card className="admin-panel-card">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-md-3">{dictionary.admin.resources.user}</dt>
            <dd className="col-md-9">
              {consent.userId ? (
                <Link href={`/admin/users/${consent.userId}/details`}>{consent.principalName}</Link>
              ) : (
                consent.principalName
              )}
            </dd>
            <dt className="col-md-3">{dictionary.admin.resources.client}</dt>
            <dd className="col-md-9">
              <Link href={`/admin/clients/${encodeURIComponent(consent.clientId)}/settings`}>
                {consent.clientName}
              </Link>
              <div className="small text-body-secondary font-monospace text-break">
                {consent.clientId}
              </div>
            </dd>
            <dt className="col-md-3">{dictionary.admin.resources.grantedScopes}</dt>
            <dd className="col-md-9">
              <div className="d-flex flex-wrap gap-1">
                {consent.authorities.map((authority) => (
                  <Badge bg="secondary" key={authority}>
                    {authority.replace("SCOPE_", "")}
                  </Badge>
                ))}
              </div>
            </dd>
            <dt className="col-md-3">{dictionary.admin.resources.created}</dt>
            <dd className="col-md-9">{new Date(consent.createdAt).toLocaleString(locale)}</dd>
            <dt className="col-md-3">{dictionary.admin.resources.updated}</dt>
            <dd className="col-md-9">{new Date(consent.updatedAt).toLocaleString(locale)}</dd>
          </dl>
        </Card.Body>
      </Card>

      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={dictionary.admin.resources.revoke}
        message={dictionary.admin.resources.revokeConfirm}
        onCancel={() => setShowRevoke(false)}
        onConfirm={() => {
          setShowRevoke(false);
          void revoke();
        }}
        show={showRevoke}
      />
    </div>
  );
}
