"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PageResponse } from "@/lib/api-types";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";
import { useAdminAuth } from "./AdminAuthProvider";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ConfirmModal } from "./ConfirmModal";

type Role = { id: number; name: string };
type ApplicationRole = { name: string };
type ServiceAccount = { username: string; roleIds: number[]; applicationRoles?: string[] };
type Values = { roleIds: number[]; applicationRoles: string[] };

export function ServiceAccountRoles({
  clientId,
  dictionary,
}: {
  clientId: string;
  dictionary: Dictionary;
}) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.clients.serviceAccountRoles;
  const alerts = useConsoleAlerts();
  const [account, setAccount] = useState<ServiceAccount | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [applicationRoles, setApplicationRoles] = useState<ApplicationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const schema = z.object({
    roleIds: z.array(z.number().int().positive()),
    applicationRoles: z.array(z.string().min(1)),
  });
  const { handleSubmit, reset, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { roleIds: [], applicationRoles: [] },
  });
  const selected = watch("roleIds");
  const selectedApplicationRoles = watch("applicationRoles");
  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminRequest<ServiceAccount>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/service-account`,
      }),
      adminRequest<PageResponse<Role>>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles?page=0&size=100&sort=name,asc`,
      }),
      adminRequest<{ content: ApplicationRole[] }>(accessToken, {
        url: "/api/admin/roles?page=0&size=100&sort=name,asc",
      }),
    ])
      .then(([accountResponse, rolesResponse, applicationRolesResponse]) => {
        if (
          accountResponse.status >= 300 ||
          rolesResponse.status >= 300 ||
          applicationRolesResponse.status >= 300
        )
          throw new Error();
        setAccount(accountResponse.data);
        reset({
          roleIds: accountResponse.data.roleIds,
          applicationRoles: accountResponse.data.applicationRoles ?? [],
        });
        setRoles(rolesResponse.data.content);
        setApplicationRoles(applicationRolesResponse.data.content);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [accessToken, clientId, reset]);
  const save = async (values: Values) => {
    if (!accessToken || !account || !access?.manageClients) return;
    setSaving(true);
    try {
      const response = await adminRequest<ServiceAccount>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/service-account/roles`,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        data: values,
      });
      if (response.status >= 300) {
        alerts.addError(copy.error);
        return;
      }
      setAccount(response.data);
      reset({
        roleIds: response.data.roleIds,
        applicationRoles: response.data.applicationRoles ?? [],
      });
      alerts.addAlert(dictionary.admin.clients.saved);
    } catch {
      alerts.addError(copy.error);
    } finally {
      setSaving(false);
    }
  };
  const revokeTokens = async () => {
    if (!accessToken || !account || !access?.manageClients) return;
    setRevoking(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/service-account/revoke`,
        method: "POST",
      });
      if (response.status >= 300) {
        alerts.addError(copy.error);
        return;
      }
      alerts.addAlert(copy.tokensRevoked);
    } catch {
      alerts.addError(copy.error);
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  };
  if (loading) return <div className="text-body-secondary">{dictionary.admin.common.loading}</div>;
  if (loadError) return <Alert variant="danger">{copy.error}</Alert>;
  if (!account) return <div className="text-body-secondary">{copy.notEnabled}</div>;
  return (
    <>
      <Card className="admin-panel-card">
        <Card.Body>
          <h2 className="h5">{copy.title}</h2>
          <p className="small text-body-secondary">{account.username}</p>
          <Form noValidate onSubmit={handleSubmit(save)}>
            <div className="d-grid gap-3">
              <div>
                <h3 className="h6">{copy.applicationRoles}</h3>
                <div className="d-grid gap-2">
                  {applicationRoles.map((role) => (
                    <Form.Check
                      key={role.name}
                      id={`service-account-application-role-${role.name}`}
                      type="checkbox"
                      label={role.name}
                      checked={selectedApplicationRoles.includes(role.name)}
                      disabled={!access?.manageClients || saving}
                      onChange={(event) =>
                        setValue(
                          "applicationRoles",
                          event.target.checked
                            ? [...selectedApplicationRoles, role.name]
                            : selectedApplicationRoles.filter((name) => name !== role.name),
                          { shouldDirty: true, shouldValidate: true },
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="h6">{copy.clientRoles}</h3>
                <div className="d-grid gap-2">
                  {roles.map((role) => (
                    <Form.Check
                      key={role.id}
                      id={`service-account-role-${role.id}`}
                      type="checkbox"
                      label={role.name}
                      checked={selected.includes(role.id)}
                      disabled={!access?.manageClients || saving}
                      onChange={(event) =>
                        setValue(
                          "roleIds",
                          event.target.checked
                            ? [...selected, role.id]
                            : selected.filter((id) => id !== role.id),
                          { shouldDirty: true, shouldValidate: true },
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              <Button type="submit" disabled={saving || revoking || !access?.manageClients}>
                {saving && (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                )}
                {dictionary.admin.common.save}
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={saving || revoking || !access?.manageClients}
                onClick={() => setShowRevokeConfirm(true)}
              >
                {revoking ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : null}
                {copy.revokeTokens}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      <ConfirmModal
        busy={revoking}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.revokeTokens}
        message={copy.revokeTokensConfirm}
        onCancel={() => setShowRevokeConfirm(false)}
        onConfirm={() => void revokeTokens()}
        show={showRevokeConfirm}
      />
    </>
  );
}
