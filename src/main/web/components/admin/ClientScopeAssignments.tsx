import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Spinner } from "react-bootstrap";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ErrorState, LoadingState } from "./AsyncState";
import type { ClientScope } from "./ClientScopesTable";

type Assignments = {
  defaultScopes: string[];
  optionalScopes: string[];
  availableScopes: ClientScope[];
};

type Props = {
  clientId: string;
  dictionary: Dictionary;
  onChanged?: (scopes: string[]) => void;
};

export function ClientScopeAssignments({ clientId, dictionary, onChanged }: Props) {
  const copy = dictionary.admin.clientScopes;
  const { access, accessToken } = useAdminAuth();
  const { addAlert, addError } = useConsoleAlerts();
  const [data, setData] = useState<Assignments | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<Assignments>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(clientId)}/scope-assignments`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setData(response.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [accessToken, clientId]);

  const assigned = useMemo(() => {
    const values = new Set<string>();
    data?.defaultScopes.forEach((scope) => values.add(scope));
    data?.optionalScopes.forEach((scope) => values.add(scope));
    return values;
  }, [data]);

  const persist = async (defaultScopes: string[], optionalScopes: string[]) => {
    if (!access?.manageClients || !accessToken) return;
    setSaving(true);
    try {
      const response = await adminRequest<Assignments>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/scope-assignments`,
        method: "PUT",
        data: { defaultScopes, optionalScopes },
      });
      if (response.status >= 300) {
        addError(copy.operationError);
        return;
      }
      setData(response.data);
      onChanged?.([...response.data.defaultScopes, ...response.data.optionalScopes]);
      addAlert(copy.assignmentSaved);
    } catch {
      addError(copy.operationError);
    } finally {
      setSaving(false);
    }
  };

  const move = (scope: string, target: "default" | "optional" | "available") => {
    if (!data || saving) return;
    const defaults = data.defaultScopes.filter((item) => item !== scope);
    const optional = data.optionalScopes.filter((item) => item !== scope);
    if (target === "default") defaults.push(scope);
    if (target === "optional") optional.push(scope);
    void persist(defaults, optional);
  };

  if (failed) return <ErrorState message={copy.operationError} />;
  if (!data) return <LoadingState />;

  const renderScope = (scope: ClientScope, kind: "default" | "optional" | "available") => (
    <div className="client-scope-assignment-row" key={`${kind}-${scope.id}`}>
      <div className="min-w-0">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <strong className="font-monospace">{scope.name}</strong>
          {scope.displayName && <span className="text-body-secondary">{scope.displayName}</span>}
        </div>
        {scope.description && (
          <div className="small text-body-secondary mt-1">{scope.description}</div>
        )}
      </div>
      {access?.manageClients && (
        <div className="d-flex gap-2 flex-wrap justify-content-end">
          {kind !== "default" && (
            <Button
              size="sm"
              variant="primary"
              disabled={saving}
              onClick={() => move(scope.name, "default")}
            >
              {saving ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="add" />
              )}
              {copy.addDefault}
            </Button>
          )}
          {kind !== "optional" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={() => move(scope.name, "optional")}
            >
              {saving ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="add" />
              )}
              {copy.addOptional}
            </Button>
          )}
          {kind !== "available" && (
            <Button
              size="sm"
              variant="link"
              className="text-danger text-decoration-none"
              disabled={saving}
              onClick={() => move(scope.name, "available")}
            >
              {saving ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="remove" />
              )}
              {copy.remove}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const defaultSet = new Set(data.defaultScopes);
  const optionalSet = new Set(data.optionalScopes);
  const defaults = data.availableScopes.filter((scope) => defaultSet.has(scope.name));
  const optional = data.availableScopes.filter((scope) => optionalSet.has(scope.name));
  const available = data.availableScopes.filter((scope) => !assigned.has(scope.name));

  return (
    <div className="d-grid gap-4">
      <section className="client-scope-assignment-section">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">{copy.defaultScopes}</h2>
            <div className="small text-body-secondary">{copy.defaultHelp}</div>
          </div>
          <Badge bg="primary" pill>
            {defaults.length}
          </Badge>
        </div>
        <div className="client-scope-assignment-list">
          {defaults.length ? (
            defaults.map((scope) => renderScope(scope, "default"))
          ) : (
            <div className="text-body-secondary small py-2">{dictionary.admin.resources.empty}</div>
          )}
        </div>
      </section>

      <section className="client-scope-assignment-section">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">{copy.optionalScopes}</h2>
            <div className="small text-body-secondary">{copy.optionalHelp}</div>
          </div>
          <Badge bg="secondary" pill>
            {optional.length}
          </Badge>
        </div>
        <div className="client-scope-assignment-list">
          {optional.length ? (
            optional.map((scope) => renderScope(scope, "optional"))
          ) : (
            <div className="text-body-secondary small py-2">{dictionary.admin.resources.empty}</div>
          )}
        </div>
      </section>

      <section className="client-scope-assignment-section">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <h2 className="h5 mb-0">{copy.availableScopes}</h2>
          <Badge bg="secondary" pill>
            {available.length}
          </Badge>
        </div>
        <div className="client-scope-assignment-list">
          {available.length ? (
            available.map((scope) => renderScope(scope, "available"))
          ) : (
            <div className="text-body-secondary small py-2">{dictionary.admin.resources.empty}</div>
          )}
        </div>
      </section>
    </div>
  );
}
