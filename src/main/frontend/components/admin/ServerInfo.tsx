"use client";
import { useDictionary, useLocale } from "@/i18n/client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Nav, Spinner, Tab } from "react-bootstrap";

import { ViewHeader } from "@/components/admin/ViewHeader";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminActionIcon } from "@/components/admin/AdminActionIcon";
import { adminRequest } from "@/lib/admin-api";
import { apiUrl } from "@/lib/desktop-api";

type KeySummary = {
  kid: string;
  type: string;
  algorithm: string;
  use: string;
  createdAt: string;
};
type ServerInfo = {
  issuer: string;
  discoveryEndpoint: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  introspectionEndpoint: string;
  revocationEndpoint: string;
  jwksEndpoint: string;
  userInfoEndpoint: string;
  endSessionEndpoint: string;
  sessionTimeout: string | null;
  activeSigningKey: KeySummary | null;
};

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="bg-body-tertiary border rounded-3 p-3 small overflow-auto mb-0 font-monospace">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function CopyButton({
  copied,
  label,
  onCopy,
  copiedLabel,
  copying,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  copiedLabel: string;
  copying: boolean;
}) {
  return (
    <Button
      aria-label={copied ? copiedLabel : label}
      className="text-nowrap"
      disabled={copying}
      onClick={onCopy}
      size="sm"
      type="button"
      variant={copied ? "success" : "secondary"}
    >
      {copying ? (
        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
      ) : (
        <AdminActionIcon action={copied ? "check" : "copy"} />
      )}
      {copied ? copiedLabel : label}
    </Button>
  );
}

export default function ServerInfoPage() {
  const locale = useLocale();
  const { accessToken } = useAdminAuth();
  const copy = useDictionary().admin.serverInfo;
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [discovery, setDiscovery] = useState<unknown>(null);
  const [jwks, setJwks] = useState<unknown>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [copyingValue, setCopyingValue] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [discoveryError, setDiscoveryError] = useState(false);
  const [jwksError, setJwksError] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    adminRequest<ServerInfo>(accessToken, {
      url: "/api/admin/server-info",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status >= 300) throw new Error("Server information request failed");
        setInfo(response.data);

        const localUrl = (endpoint: string) => {
          const url = new URL(endpoint);
          return apiUrl(`${url.pathname}${url.search}`);
        };
        const [discoveryResponse, jwksResponse] = await Promise.all([
          fetch(localUrl(response.data.discoveryEndpoint), { signal: controller.signal }),
          fetch(localUrl(response.data.jwksEndpoint), { signal: controller.signal }),
        ]);
        if (discoveryResponse.ok) setDiscovery(await discoveryResponse.json());
        else setDiscoveryError(true);
        if (jwksResponse.ok) setJwks(await jwksResponse.json());
        else setJwksError(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [accessToken]);

  const loading = Boolean(accessToken) && !info && !loadError;

  const copyValue = async (value: string) => {
    setCopyingValue(value);
    try {
      await navigator.clipboard.writeText(value);
      setCopyFailed(false);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 1800);
    } catch {
      setCopiedValue(null);
      setCopyFailed(true);
    } finally {
      setCopyingValue(null);
    }
  };

  const endpointRows = info
    ? [
        [copy.issuer, info.issuer],
        [copy.authorization, info.authorizationEndpoint],
        [copy.token, info.tokenEndpoint],
        [copy.introspection, info.introspectionEndpoint],
        [copy.revocation, info.revocationEndpoint],
        [copy.userInfo, info.userInfoEndpoint],
        [copy.jwks, info.jwksEndpoint],
        [copy.endSession, info.endSessionEndpoint],
      ]
    : [];

  return (
    <div className="d-grid gap-4">
      <ViewHeader title={copy.title} description={copy.description} />

      {copyFailed && <Alert variant="warning">{copy.copyFailed}</Alert>}

      {loading && <div role="status">{copy.loading}</div>}
      {loadError && <Alert variant="danger">{copy.loadError}</Alert>}

      {!loading && !loadError && (
        <>
          <Card className="admin-panel-card">
            <Card.Body>
              <h2 className="h5 mb-3">{copy.runtime}</h2>
              <dl className="row mb-0">
                <dt className="col-lg-3">{copy.sessionTimeout}</dt>
                <dd className="col-lg-9">{info?.sessionTimeout ?? "—"}</dd>
                <dt className="col-lg-3">{copy.activeSigningKey}</dt>
                <dd className="col-lg-9">
                  {info?.activeSigningKey ? (
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <code>{info.activeSigningKey.kid}</code>
                      <Badge bg="success">{copy.active}</Badge>
                      <Badge bg="secondary">{info.activeSigningKey.algorithm}</Badge>
                      <span className="text-body-secondary small">
                        {new Date(info.activeSigningKey.createdAt).toLocaleString(locale)}
                      </span>
                      <span className="text-body-secondary small">
                        {copy.keyType}: {info.activeSigningKey.type} · {copy.keyUse}:{" "}
                        {info.activeSigningKey.use}
                      </span>
                    </div>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
            </Card.Body>
          </Card>

          <Card className="admin-panel-card">
            <Card.Body>
              <h2 className="h5 mb-3">OIDC / OAuth 2.0 {copy.endpoints}</h2>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">{copy.name}</th>
                      <th scope="col">{copy.url}</th>
                      <th aria-label={copy.copy} scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {endpointRows.map(([label, value]) => (
                      <tr key={label}>
                        <th className="text-nowrap">{label}</th>
                        <td className="font-monospace small text-break">{value}</td>
                        <td className="text-end">
                          <CopyButton
                            copied={copiedValue === value}
                            copying={copyingValue === value}
                            copiedLabel={copy.copied}
                            label={copy.copy}
                            onCopy={() => void copyValue(value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>

          <Tab.Container defaultActiveKey="discovery">
            <Card className="admin-panel-card">
              <Card.Header className="bg-body">
                <Nav variant="tabs">
                  <Nav.Item>
                    <Nav.Link eventKey="discovery">{copy.discovery}</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="jwks">{copy.jwks}</Nav.Link>
                  </Nav.Item>
                </Nav>
              </Card.Header>
              <Card.Body>
                <Tab.Content>
                  <Tab.Pane eventKey="discovery">
                    <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                      <div className="small text-body-secondary text-break">
                        {info?.discoveryEndpoint ?? "—"}
                      </div>
                      {info && discovery !== null && (
                        <CopyButton
                          copied={copiedValue === JSON.stringify(discovery, null, 2)}
                          copying={copyingValue === JSON.stringify(discovery, null, 2)}
                          copiedLabel={copy.copied}
                          label={copy.copyJson}
                          onCopy={() => void copyValue(JSON.stringify(discovery, null, 2))}
                        />
                      )}
                    </div>
                    {discoveryError ? (
                      <Alert className="mb-0" variant="warning">
                        {copy.configurationError}
                      </Alert>
                    ) : (
                      <JsonPanel value={discovery ?? {}} />
                    )}
                  </Tab.Pane>
                  <Tab.Pane eventKey="jwks">
                    <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                      <div className="small text-body-secondary text-break">
                        {info?.jwksEndpoint ?? "—"}
                      </div>
                      {info && jwks !== null && (
                        <CopyButton
                          copied={copiedValue === JSON.stringify(jwks, null, 2)}
                          copying={copyingValue === JSON.stringify(jwks, null, 2)}
                          copiedLabel={copy.copied}
                          label={copy.copyJson}
                          onCopy={() => void copyValue(JSON.stringify(jwks, null, 2))}
                        />
                      )}
                    </div>
                    {jwksError ? (
                      <Alert className="mb-0" variant="warning">
                        {copy.jwksError}
                      </Alert>
                    ) : (
                      <JsonPanel value={jwks ?? {}} />
                    )}
                  </Tab.Pane>
                </Tab.Content>
              </Card.Body>
            </Card>
          </Tab.Container>
        </>
      )}
    </div>
  );
}
