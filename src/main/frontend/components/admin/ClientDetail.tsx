"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "react-bootstrap";
import { useRouter } from "@/routing/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ConfirmModal } from "./ConfirmModal";
import { ErrorState, LoadingState } from "./AsyncState";
import { ResultModal } from "./ResultModal";
import { DetailTabs } from "./DetailTabs";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { ClientForm } from "./ClientForm";
import { EntityRelatedData } from "./EntityRelatedData";
import { ClientScopeAssignments } from "./ClientScopeAssignments";
import { ClientRoles } from "./ClientRoles";
import type { AdminClient } from "./ClientsTable";

const CLIENT_DETAIL_TABS = [
  "settings",
  "credentials",
  "scopes",
  "roles",
  "sessions",
  "consents",
  "events",
] as const;

type Detail = AdminClient & {
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  clientIdIssuedAt: string | null;
  clientSecretExpiresAt: string | null;
  authorizationCodeTimeToLive: string;
  accessTokenTimeToLive: string;
  refreshTokenTimeToLive: string;
};
export function ClientDetail({
  locale,
  dictionary,
  id,
  tab = "settings",
}: {
  locale: Locale;
  dictionary: Dictionary;
  id: string | null;
  tab?: string | null;
}) {
  const router = useRouter();
  const { access, accessToken } = useAdminAuth();
  const [client, setClient] = useState<Detail | null>(null);
  const [error, setError] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretError, setSecretError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSecretConfirm, setShowSecretConfirm] = useState(false);
  const activeTab = CLIENT_DETAIL_TABS.includes((tab ?? "") as (typeof CLIENT_DETAIL_TABS)[number])
    ? (tab as string)
    : "settings";
  useEffect(() => {
    if (!id || !accessToken) return;
    adminRequest<Detail>(accessToken, { url: `/api/admin/clients/${encodeURIComponent(id)}` })
      .then((r) => {
        if (r.status >= 300) throw new Error();
        setClient(r.data);
      })
      .catch(() => setError(true));
  }, [accessToken, id]);
  const remove = async () => {
    if (!access?.manageClients || !id || !accessToken) return;
    const r = await adminRequest(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(id)}`,
      method: "DELETE",
    });
    if (r.status < 300) {
      router.push(`/admin/clients`);
    } else setError(true);
  };
  const regenerateSecret = async () => {
    if (!access?.manageClients || !id || !accessToken) return;
    setSecretError(false);
    const r = await adminRequest<{ clientSecret: string }>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(id)}/secret`,
      method: "POST",
    });
    if (r.status >= 300) {
      setSecretError(true);
      return;
    }
    setSecret(r.data.clientSecret);
  };
  if (!id || error) return <ErrorState message={dictionary.admin.clients.notFound} />;
  if (!client) return <LoadingState />;
  const detailUrl = `/admin/clients/${encodeURIComponent(client.id)}`;
  const copy = dictionary.admin.clients;
  const tabs = [
    { key: "settings", label: copy.settings, href: `${detailUrl}/settings` },
    {
      key: "credentials",
      label: copy.credentials,
      href: `${detailUrl}/credentials`,
    },
    {
      key: "scopes",
      label: copy.clientScopes,
      href: `${detailUrl}/scopes`,
    },
    { key: "roles", label: copy.roles.title, href: `${detailUrl}/roles` },
    { key: "sessions", label: copy.sessions, href: `${detailUrl}/sessions` },
    { key: "consents", label: copy.consents, href: `${detailUrl}/consents` },
    ...(access?.viewEvents
      ? [{ key: "events", label: copy.events, href: `${detailUrl}/events` }]
      : []),
  ];
  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: dictionary.admin.clients.title, href: `/admin/clients` },
          { label: client.clientName },
        ]}
      />
      <div className="admin-detail-heading">
        <div>
          <h1 className="h3 mb-1">{client.clientName}</h1>
          <div className="font-monospace text-body-secondary">{client.clientId}</div>
        </div>
        {access?.manageClients && (
          <div className="d-flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <AdminActionIcon action="delete" />
              {dictionary.admin.clients.delete}
            </Button>
          </div>
        )}
      </div>
      <DetailTabs tabs={tabs} active={activeTab} />
      {secretError && <Alert variant="danger">{dictionary.admin.clients.secretError}</Alert>}
      {activeTab === "settings" && (
        <ClientForm locale={locale} dictionary={dictionary} mode="edit" id={client.id} embedded />
      )}
      {activeTab === "credentials" &&
        (() => {
          const methods = Array.from(client.clientAuthenticationMethods);
          const publicClient = methods.includes("none");
          const expiresAt = client.clientSecretExpiresAt
            ? new Date(client.clientSecretExpiresAt)
            : null;
          const methodLabel = publicClient ? copy.publicClient : copy.confidentialClient;
          return (
            <div className="d-grid gap-3">
              <Card className="admin-panel-card">
                <Card.Body>
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                    <div>
                      <h2 className="h5 mb-1">{copy.clientAuthentication}</h2>
                      <p className="text-body-secondary small mb-0">
                        {copy.clientAuthenticationHelp}
                      </p>
                    </div>
                    <Badge bg={publicClient ? "secondary" : "primary"}>{methodLabel}</Badge>
                  </div>
                  <dl className="row mt-4 mb-0">
                    <dt className="col-sm-4">{copy.authenticationMethod}</dt>
                    <dd className="col-sm-8 font-monospace">{methods.join(", ")}</dd>
                    <dt className="col-sm-4">PKCE</dt>
                    <dd className="col-sm-8">
                      {client.requireProofKey ? (
                        <Badge bg="success">{copy.pkceRequired}</Badge>
                      ) : (
                        <Badge bg="secondary">{copy.pkceNotRequired}</Badge>
                      )}
                    </dd>
                    <dt className="col-sm-4">{copy.requireDpop}</dt>
                    <dd className="col-sm-8">
                      {client.requireDpop ? (
                        <Badge bg="success">{dictionary.admin.common.on}</Badge>
                      ) : (
                        <Badge bg="secondary">{dictionary.admin.common.off}</Badge>
                      )}
                    </dd>
                    <dt className="col-sm-4">{copy.requireDpopJkt}</dt>
                    <dd className="col-sm-8">
                      {client.requireDpopJkt ? (
                        <Badge bg="success">{dictionary.admin.common.on}</Badge>
                      ) : (
                        <Badge bg="secondary">{dictionary.admin.common.off}</Badge>
                      )}
                    </dd>
                    <dt className="col-sm-4">{copy.dpopRefreshTokenOnly}</dt>
                    <dd className="col-sm-8">
                      {client.dpopRefreshTokenOnly ? (
                        <Badge bg="info">{dictionary.admin.common.on}</Badge>
                      ) : (
                        <Badge bg="secondary">{dictionary.admin.common.off}</Badge>
                      )}
                    </dd>
                    <dt className="col-sm-4">{copy.dpopAlgorithms}</dt>
                    <dd className="col-sm-8 font-monospace">
                      {(client.dpopSigningAlgorithms ?? ["RS256", "ES256"]).join(", ")}
                    </dd>
                    <dt className="col-sm-4">{copy.clientCreated}</dt>
                    <dd className="col-sm-8">
                      {client.clientIdIssuedAt
                        ? new Date(client.clientIdIssuedAt).toLocaleString(locale)
                        : "—"}
                    </dd>
                  </dl>
                </Card.Body>
              </Card>

              {!publicClient && (
                <Card className="admin-panel-card">
                  <Card.Body>
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                      <div>
                        <h2 className="h5 mb-1">{copy.clientSecret}</h2>
                        <p className="text-body-secondary small mb-0">
                          {copy.clientSecretDescription}
                        </p>
                      </div>
                      <Badge bg="success">{copy.configured}</Badge>
                    </div>
                    <dl className="row mt-4">
                      <dt className="col-sm-4">{copy.expires}</dt>
                      <dd className="col-sm-8">
                        {expiresAt ? expiresAt.toLocaleString(locale) : copy.doesNotExpire}
                      </dd>
                    </dl>
                    <Button
                      variant="primary"
                      disabled={!access?.manageClients}
                      onClick={() => setShowSecretConfirm(true)}
                    >
                      <AdminActionIcon action="regenerate" />
                      {dictionary.admin.clients.regenerateSecret}
                    </Button>
                  </Card.Body>
                </Card>
              )}
            </div>
          );
        })()}
      {activeTab === "scopes" && (
        <ClientScopeAssignments
          clientId={client.id}
          dictionary={dictionary}
          onChanged={(scopes) =>
            setClient((current) => (current ? { ...current, scopes } : current))
          }
        />
      )}
      {activeTab === "roles" && <ClientRoles clientId={client.id} dictionary={dictionary} />}
      {activeTab === "sessions" && (
        <EntityRelatedData
          resource="sessions"
          url={`/api/admin/clients/${encodeURIComponent(client.id)}/sessions`}
          locale={locale}
          dictionary={dictionary}
          canManage={access?.manageUsers ?? false}
        />
      )}
      {activeTab === "consents" && (
        <EntityRelatedData
          resource="consents"
          url={`/api/admin/clients/${encodeURIComponent(client.id)}/consents`}
          locale={locale}
          dictionary={dictionary}
          canManage={access?.manageConsents ?? false}
        />
      )}
      {activeTab === "events" && (
        <EntityRelatedData
          resource="events"
          url={`/api/admin/clients/${encodeURIComponent(client.id)}/events`}
          locale={locale}
          dictionary={dictionary}
        />
      )}
      <ResultModal
        closeLabel={dictionary.admin.common.close}
        message={dictionary.admin.clients.secretHelp}
        onClose={() => setSecret(null)}
        show={secret !== null}
        title={dictionary.admin.clients.secretTitle}
        value={secret}
      />
      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={dictionary.admin.clients.regenerateSecret}
        message={copy.regenerateSecretConfirm}
        onCancel={() => setShowSecretConfirm(false)}
        onConfirm={() => {
          setShowSecretConfirm(false);
          void regenerateSecret();
        }}
        show={showSecretConfirm}
      />
      <ConfirmModal
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={dictionary.admin.clients.delete}
        message={dictionary.admin.clients.deleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          void remove();
        }}
        show={showDeleteConfirm}
      />
    </>
  );
}
