"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@/lib/form";
import { z } from "zod";
import { Button, Card, Form, Spinner, Table } from "react-bootstrap";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ErrorState, LoadingState } from "./AsyncState";

type ClientMapper = {
  id: number;
  name: string;
  mapperType: string;
  source: string | null;
  claimName: string;
  addToIdToken: boolean;
  addToAccessToken: boolean;
  value: string | null;
  priority: number;
};

type Values = {
  name: string;
  mapperType:
    | "user-property"
    | "user-attribute"
    | "group-membership"
    | "client-role"
    | "audience"
    | "hardcoded-claim"
    | "email"
    | "full-name"
    | "locale"
    | "username";
  source: string;
  claimName: string;
  addToIdToken: boolean;
  addToAccessToken: boolean;
  value: string;
  priority: number;
};

export function ClientMappers({
  clientId,
  dictionary,
}: {
  clientId: string;
  dictionary: Dictionary;
}) {
  const { access, accessToken } = useAdminAuth();
  const copy = dictionary.admin.clients.mappers;
  const alerts = useConsoleAlerts();
  const [items, setItems] = useState<ClientMapper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const schema = z
    .object({
      name: z.string().trim().min(1, dictionary.admin.common.validation.required).max(100),
      mapperType: z.enum([
        "user-property",
        "user-attribute",
        "group-membership",
        "client-role",
        "audience",
        "hardcoded-claim",
        "email",
        "full-name",
        "locale",
        "username",
      ]),
      source: z.string().trim().max(200),
      claimName: z.string().trim().min(1, dictionary.admin.common.validation.required).max(200),
      addToIdToken: z.boolean(),
      addToAccessToken: z.boolean(),
      value: z.string().trim().max(1000),
      priority: z.number().int().min(0).max(10000),
    })
    .superRefine((value, context) => {
      if (["user-property", "user-attribute"].includes(value.mapperType) && !value.source) {
        context.addIssue({ code: "custom", path: ["source"], message: copy.sourceRequired });
      }
      if (!value.addToIdToken && !value.addToAccessToken) {
        context.addIssue({
          code: "custom",
          path: ["addToAccessToken"],
          message: copy.targetRequired,
        });
      }
    });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      mapperType: "user-property",
      source: "email",
      claimName: "email",
      addToIdToken: false,
      addToAccessToken: true,
      value: "",
      priority: 100,
    },
  });

  const load = () => {
    if (!accessToken) return;
    adminRequest<PageResponse<ClientMapper>>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(clientId)}/mappers?page=0&size=20&sort=name,asc`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setItems(response.data.content);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [accessToken, clientId]);

  const submit = async (values: Values) => {
    if (!accessToken || !access?.manageClients) return;
    setSaving(true);
    const response = await adminRequest<ClientMapper>(accessToken, {
      url:
        editing === null
          ? `/api/admin/clients/${encodeURIComponent(clientId)}/mappers`
          : `/api/admin/clients/${encodeURIComponent(clientId)}/mappers/${editing}`,
      method: editing === null ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      data: values,
    });
    setSaving(false);
    if (response.status >= 300) return;
    alerts.addAlert(copy.saved);
    setEditing(null);
    reset();
    setLoading(true);
    load();
  };

  const remove = async (id: number) => {
    if (!accessToken || !access?.manageClients) return;
    setDeleting(id);
    const response = await adminRequest(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(clientId)}/mappers/${id}`,
      method: "DELETE",
    });
    setDeleting(null);
    if (response.status < 300) {
      alerts.addAlert(copy.deleted);
      setLoading(true);
      load();
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={copy.loadError} />;
  return (
    <div className="d-grid gap-3">
      {access?.manageClients && (
        <Card className="admin-panel-card">
          <Card.Body>
            <h2 className="h5">{editing === null ? copy.create : copy.edit}</h2>
            <Form noValidate onSubmit={handleSubmit(submit)} className="d-grid gap-3">
              <Form.Group controlId="client-mapper-name">
                <Form.Label>{copy.name}</Form.Label>
                <Form.Control isInvalid={Boolean(errors.name)} {...register("name")} />
                <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="client-mapper-type">
                <Form.Label>{copy.type}</Form.Label>
                <Form.Select {...register("mapperType")}>
                  <option value="user-property">user-property</option>
                  <option value="user-attribute">user-attribute</option>
                  <option value="group-membership">group-membership</option>
                  <option value="client-role">client-role</option>
                  <option value="audience">audience</option>
                  <option value="hardcoded-claim">hardcoded-claim</option>
                  <option value="email">email</option>
                  <option value="full-name">full-name</option>
                  <option value="locale">locale</option>
                  <option value="username">username</option>
                </Form.Select>
              </Form.Group>
              <Form.Group controlId="client-mapper-value">
                <Form.Label>{copy.value}</Form.Label>
                <Form.Control isInvalid={Boolean(errors.value)} {...register("value")} />
                <Form.Control.Feedback type="invalid">
                  {errors.value?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="client-mapper-priority">
                <Form.Label>{copy.priority}</Form.Label>
                <Form.Control
                  type="number"
                  isInvalid={Boolean(errors.priority)}
                  {...register("priority", { valueAsNumber: true })}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.priority?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="client-mapper-source">
                <Form.Label>{copy.source}</Form.Label>
                <Form.Control isInvalid={Boolean(errors.source)} {...register("source")} />
                <Form.Control.Feedback type="invalid">
                  {errors.source?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="client-mapper-claim-name">
                <Form.Label>{copy.claimName}</Form.Label>
                <Form.Control isInvalid={Boolean(errors.claimName)} {...register("claimName")} />
                <Form.Control.Feedback type="invalid">
                  {errors.claimName?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <div className="d-flex gap-3">
                <Form.Check type="switch" label={copy.idToken} {...register("addToIdToken")} />
                <Form.Check
                  type="switch"
                  label={copy.accessToken}
                  {...register("addToAccessToken")}
                />
              </div>
              {errors.addToAccessToken && (
                <div className="invalid-feedback d-block">{errors.addToAccessToken.message}</div>
              )}
              <div className="d-flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Spinner animation="border" size="sm" className="me-2" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {dictionary.admin.common.save}
                </Button>
                {editing !== null && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      reset();
                    }}
                  >
                    {dictionary.admin.common.cancel}
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      <Card className="admin-panel-card">
        <Card.Body>
          <h2 className="h5">{copy.title}</h2>
          <p className="small text-body-secondary">{copy.subtitle}</p>
          {items.length === 0 ? (
            <div className="text-body-secondary">{copy.empty}</div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>{copy.name}</th>
                  <th>{copy.type}</th>
                  <th>{copy.claimName}</th>
                  <th>{copy.targets}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className="font-monospace">{item.mapperType}</td>
                    <td className="font-monospace">{item.claimName}</td>
                    <td>
                      {[
                        item.addToIdToken && copy.idToken,
                        item.addToAccessToken && copy.accessToken,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(item.id);
                          reset({
                            ...item,
                            mapperType: item.mapperType as Values["mapperType"],
                            source: item.source ?? "",
                            value: item.value ?? "",
                            priority: item.priority ?? 100,
                          });
                        }}
                      >
                        <AdminActionIcon action="edit" />
                        {copy.edit}
                      </Button>{" "}
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={deleting === item.id}
                        onClick={() => void remove(item.id)}
                      >
                        {deleting === item.id ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <AdminActionIcon action="delete" />
                        )}
                        {copy.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
