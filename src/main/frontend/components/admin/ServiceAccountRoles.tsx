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

type Role = { id: number; name: string };
type ServiceAccount = { username: string; roleIds: number[] };
type Values = { roleIds: number[] };

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const schema = z.object({ roleIds: z.array(z.number().int().positive()) });
  const { handleSubmit, reset, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { roleIds: [] },
  });
  const selected = watch("roleIds");
  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminRequest<ServiceAccount>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/service-account`,
      }),
      adminRequest<PageResponse<Role>>(accessToken, {
        url: `/api/admin/clients/${encodeURIComponent(clientId)}/roles?page=0&size=100&sort=name,asc`,
      }),
    ])
      .then(([accountResponse, rolesResponse]) => {
        if (accountResponse.status >= 300 || rolesResponse.status >= 300) throw new Error();
        setAccount(accountResponse.data);
        reset({ roleIds: accountResponse.data.roleIds });
        setRoles(rolesResponse.data.content);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, clientId, reset]);
  const save = async (values: Values) => {
    if (!accessToken || !account || !access?.manageClients) return;
    setSaving(true);
    const response = await adminRequest<ServiceAccount>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(clientId)}/service-account/roles`,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      data: values,
    });
    setSaving(false);
    if (response.status >= 300) {
      setError(true);
      return;
    }
    setAccount(response.data);
    reset({ roleIds: response.data.roleIds });
    alerts.addAlert(dictionary.admin.clients.saved);
  };
  if (loading) return <div className="text-body-secondary">{dictionary.admin.common.loading}</div>;
  if (error) return <Alert variant="danger">{copy.error}</Alert>;
  if (!account) return <div className="text-body-secondary">{copy.notEnabled}</div>;
  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <h2 className="h5">{copy.title}</h2>
        <p className="small text-body-secondary">{account.username}</p>
        <Form noValidate onSubmit={handleSubmit(save)}>
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
          <Button className="mt-3" type="submit" disabled={saving || !access?.manageClients}>
            {saving && <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />}
            {dictionary.admin.common.save}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
