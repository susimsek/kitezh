"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useForm } from "@/lib/form";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { ErrorState, LoadingState } from "./AsyncState";

type ApplicationRole = { name: string; description: string | null };
type ClientRole = { id: number; clientId: string; name: string; description: string | null };
type Mapping = { applicationRoles: string[]; clientRoles: ClientRole[] };
type Values = { applicationRoles: string[]; clientRoleIds: string[] };

export function ClientScopeRoleMappings({
  scopeId,
  dictionary,
  readOnly = false,
}: {
  scopeId: string;
  dictionary: Dictionary;
  readOnly?: boolean;
}) {
  const { access, accessToken } = useAdminAuth();
  const canManage = Boolean(access?.manageClients && !readOnly);
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.clientScopes;
  const common = dictionary.admin.common;
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [applicationRoles, setApplicationRoles] = useState<ApplicationRole[]>([]);
  const [clientRoles, setClientRoles] = useState<ClientRole[]>([]);
  const [error, setError] = useState(false);
  const schema = z.object({
    applicationRoles: z.array(z.string()),
    clientRoleIds: z.array(z.string()),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { applicationRoles: [], clientRoleIds: [] },
  });

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminRequest<Mapping>(accessToken, {
        url: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
      }),
      adminRequest<PageResponse<ApplicationRole>>(accessToken, {
        url: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/application-roles?page=0&size=100&sort=name,asc`,
      }),
      adminRequest<PageResponse<ClientRole>>(accessToken, {
        url: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/client-roles?page=0&size=100&sort=name,asc`,
      }),
    ])
      .then(([mappingResponse, applicationResponse, clientResponse]) => {
        if (
          mappingResponse.status >= 300 ||
          applicationResponse.status >= 300 ||
          clientResponse.status >= 300
        ) {
          throw new Error();
        }
        setMapping(mappingResponse.data);
        setApplicationRoles(applicationResponse.data.content);
        const availableClientRoles = clientResponse.data.content;
        setClientRoles(
          [...availableClientRoles, ...mappingResponse.data.clientRoles].filter(
            (role, index, roles) => roles.findIndex((item) => item.id === role.id) === index,
          ),
        );
        reset({
          applicationRoles: mappingResponse.data.applicationRoles,
          clientRoleIds: mappingResponse.data.clientRoles.map((role) => String(role.id)),
        });
      })
      .catch(() => setError(true));
  }, [accessToken, reset, scopeId]);

  const save = async (values: Values) => {
    if (!accessToken || !canManage) return;
    const response = await adminRequest<Mapping>(accessToken, {
      url: `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
      method: "PUT",
      data: {
        applicationRoles: values.applicationRoles,
        clientRoleIds: values.clientRoleIds.map(Number),
      },
    });
    if (response.status >= 300) {
      alerts.addError(copy.operationError);
      return;
    }
    setMapping(response.data);
    reset({
      applicationRoles: response.data.applicationRoles,
      clientRoleIds: response.data.clientRoles.map((role) => String(role.id)),
    });
    alerts.addAlert(copy.roleMappingsSaved);
  };

  if (error) return <ErrorState message={copy.operationError} />;
  if (!mapping) return <LoadingState />;

  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <div className="mb-3">
          <h2 className="h5 mb-1">{copy.roleMappings}</h2>
          <p className="small text-body-secondary mb-0">{copy.roleMappingsHelp}</p>
        </div>
        <Form noValidate onSubmit={handleSubmit(save)} className="d-grid gap-3">
          <Form.Group controlId="client-scope-application-roles">
            <Form.Label>{copy.applicationRoles}</Form.Label>
            <Form.Select size="lg" multiple disabled={!canManage} {...register("applicationRoles")}>
              {applicationRoles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name}
                  {role.description ? ` — ${role.description}` : ""}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="client-scope-client-roles">
            <Form.Label>{copy.clientRoles}</Form.Label>
            <Form.Select size="lg" multiple disabled={!canManage} {...register("clientRoleIds")}>
              {clientRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.clientId} / {role.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="admin-form-actions">
            <Button disabled={isSubmitting || !canManage} type="submit">
              {isSubmitting ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="save" />
              )}
              {common.save}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
