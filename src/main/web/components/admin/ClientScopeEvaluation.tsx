"use client";

import { useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { useAdminAuth } from "./AdminAuthProvider";

type Evaluation = {
  requestedScopes: string[];
  effectiveScopes: string[];
  mappedClaims: string[];
  roles: string[];
  claims: Record<string, unknown>;
};

export function ClientScopeEvaluation({
  clientId,
  dictionary,
}: {
  clientId: string;
  dictionary: Dictionary;
}) {
  const { accessToken } = useAdminAuth();
  const copy = dictionary.admin.clients.scopeEvaluation;
  const [scopes, setScopes] = useState("");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const evaluate = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(false);
    const response = await adminRequest<Evaluation>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(clientId)}/scope-evaluation?scopes=${encodeURIComponent(scopes)}&subject=${encodeURIComponent(subject)}`,
    });
    setLoading(false);
    if (response.status >= 300) {
      setError(true);
      return;
    }
    setResult(response.data);
  };
  return (
    <div className="d-grid gap-3">
      <Card className="admin-panel-card">
        <Card.Body>
          <h2 className="h5">{copy.title}</h2>
          <p className="small text-body-secondary">{copy.subtitle}</p>
          {error && <Alert variant="danger">{copy.error}</Alert>}
          <div className="d-grid gap-3">
            <Form.Group controlId="client-scope-evaluation-scopes">
              <Form.Label>{copy.scopes}</Form.Label>
              <Form.Control
                value={scopes}
                onChange={(event) => setScopes(event.target.value)}
                placeholder="openid profile"
              />
            </Form.Group>
            <Form.Group controlId="client-scope-evaluation-subject">
              <Form.Label>{copy.subject}</Form.Label>
              <Form.Control
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="user"
              />
            </Form.Group>
            <Button disabled={loading} onClick={() => void evaluate()}>
              {loading && (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              )}
              {copy.evaluate}
            </Button>
          </div>
        </Card.Body>
      </Card>
      {result && (
        <Card className="admin-panel-card">
          <Card.Body>
            <dl className="row mb-0">
              <dt className="col-sm-4">{copy.effectiveScopes}</dt>
              <dd className="col-sm-8">{result.effectiveScopes.join(", ") || "—"}</dd>
              <dt className="col-sm-4">{copy.mappedClaims}</dt>
              <dd className="col-sm-8">{result.mappedClaims.join(", ") || "—"}</dd>
              <dt className="col-sm-4">{copy.roles}</dt>
              <dd className="col-sm-8">{result.roles.join(", ") || "—"}</dd>
              <dt className="col-sm-4">{copy.claims}</dt>
              <dd className="col-sm-8">
                <pre className="mb-0">{JSON.stringify(result.claims, null, 2)}</pre>
              </dd>
            </dl>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
