"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { useRouter } from "@/routing/navigation";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { applyProblemToForm } from "@/lib/problem-detail";

import { AdminActionIcon } from "./AdminActionIcon";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminBreadcrumb } from "./AdminBreadcrumb";

export type UserProfileDefinition = {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  type: "STRING" | "EMAIL" | "INTEGER" | "BOOLEAN";
  required: boolean;
  multivalued: boolean;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  enabled: boolean;
  displayOrder: number;
  builtIn: boolean;
};

type Values = {
  name: string;
  displayName: string;
  description: string;
  type: UserProfileDefinition["type"];
  required: boolean;
  multivalued: boolean;
  minLength?: number;
  maxLength?: number;
  pattern: string;
  enabled: boolean;
  displayOrder: number;
};

export function UserProfileAttributeForm({
  dictionary,
  id,
}: {
  dictionary: Dictionary;
  id?: string;
}) {
  const { access, accessToken } = useAdminAuth();
  const canManage = Boolean(access?.isAdmin);
  const copy = dictionary.admin.userProfileSettings;
  const validation = dictionary.admin.common.validation;
  const router = useRouter();
  const alerts = useConsoleAlerts();
  const editingId = id ? Number(id) : null;
  const [loading, setLoading] = useState(editingId !== null);
  const [loadError, setLoadError] = useState(false);
  const [breadcrumbLabel, setBreadcrumbLabel] = useState(
    editingId === null ? copy.createTitle : copy.editTitle,
  );
  const schema = z.object({
    name: z.string().trim().min(1, validation.required).max(100, validation.max100),
    displayName: z.string().trim().min(1, validation.required).max(200, validation.max200),
    description: z.string().max(1000, validation.max1000),
    type: z.enum(["STRING", "EMAIL", "INTEGER", "BOOLEAN"]),
    required: z.boolean(),
    multivalued: z.boolean(),
    minLength: z.number().int().min(0, validation.invalid).max(2000, validation.invalid).optional(),
    maxLength: z.number().int().min(0, validation.invalid).max(2000, validation.invalid).optional(),
    pattern: z.string().max(500, validation.max500),
    enabled: z.boolean(),
    displayOrder: z.number().int().min(0, validation.invalid).max(10000, validation.invalid),
  });
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      type: "STRING",
      required: false,
      multivalued: false,
      minLength: undefined,
      maxLength: undefined,
      pattern: "",
      enabled: true,
      displayOrder: 0,
    },
  });

  useEffect(() => {
    if (editingId === null || !accessToken) return;
    adminRequest<UserProfileDefinition[]>(accessToken, {
      url: "/api/admin/settings/user-profile",
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        const definition = response.data.find((item) => item.id === editingId);
        if (!definition) throw new Error();
        reset({
          name: definition.name,
          displayName: definition.displayName,
          description: definition.description ?? "",
          type: definition.type,
          required: definition.required,
          multivalued: definition.multivalued,
          minLength: definition.minLength ?? undefined,
          maxLength: definition.maxLength ?? undefined,
          pattern: definition.pattern ?? "",
          enabled: definition.enabled,
          displayOrder: definition.displayOrder,
        });
        setBreadcrumbLabel(definition.displayName || definition.name);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [accessToken, editingId, reset]);

  const submit = handleSubmit(async (values) => {
    if (!accessToken || !canManage) return;
    try {
      const response = await adminRequest<UserProfileDefinition>(accessToken, {
        method: editingId === null ? "POST" : "PUT",
        url:
          editingId === null
            ? "/api/admin/settings/user-profile"
            : `/api/admin/settings/user-profile/${editingId}`,
        data: {
          ...values,
          minLength: values.minLength ?? null,
          maxLength: values.maxLength ?? null,
        },
      });
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setError, {
          fields: ["name", "displayName", "pattern", "minLength", "maxLength", "displayOrder"],
          fallbackMessage: validation.invalid,
        });
        if (result.firstField) return;
        throw new Error();
      }
      alerts.addAlert(copy.saved);
      router.push("/admin/settings/user-profile");
    } catch {
      alerts.addError(copy.error);
    }
  });

  if (loading) {
    return (
      <div className="d-grid gap-4">
        <AdminBreadcrumb
          items={[
            {
              label: dictionary.admin.settings.sections.userProfile,
              href: "/admin/settings/user-profile",
            },
            { label: breadcrumbLabel },
          ]}
        />
        <div role="status">{copy.loading}</div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="d-grid gap-4">
        <AdminBreadcrumb
          items={[
            {
              label: dictionary.admin.settings.sections.userProfile,
              href: "/admin/settings/user-profile",
            },
            { label: breadcrumbLabel },
          ]}
        />
        <div className="alert alert-danger">{copy.error}</div>
      </div>
    );
  }

  return (
    <div className="d-grid gap-4">
      <AdminBreadcrumb
        items={[
          {
            label: dictionary.admin.settings.sections.userProfile,
            href: "/admin/settings/user-profile",
          },
          { label: breadcrumbLabel },
        ]}
      />
      <Card className="admin-panel-card admin-create-card">
        <Card.Body>
          <Form className="admin-create-form" noValidate onSubmit={submit}>
            <Form.Group className="mb-3" controlId="profile-definition-name">
              <Form.Label>{copy.name}</Form.Label>
              <Form.Control
                autoComplete="off"
                autoFocus
                maxLength={100}
                disabled={!canManage || editingId !== null}
                isInvalid={Boolean(errors.name)}
                {...register("name")}
              />
              <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-display-name">
              <Form.Label>{copy.displayName}</Form.Label>
              <Form.Control
                maxLength={200}
                disabled={!canManage}
                isInvalid={Boolean(errors.displayName)}
                {...register("displayName")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.displayName?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-description">
              <Form.Label>{copy.description}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                disabled={!canManage}
                {...register("description")}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-type">
              <Form.Label>{copy.type}</Form.Label>
              <Form.Select disabled={!canManage} {...register("type")}>
                <option value="STRING">{copy.types.string}</option>
                <option value="EMAIL">{copy.types.email}</option>
                <option value="INTEGER">{copy.types.integer}</option>
                <option value="BOOLEAN">{copy.types.boolean}</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-display-order">
              <Form.Label>{copy.displayOrder}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={10000}
                disabled={!canManage}
                isInvalid={Boolean(errors.displayOrder)}
                {...register("displayOrder", { setValueAs: (value) => Number(value) })}
              />
              <Form.Control.Feedback type="invalid">
                {errors.displayOrder?.message}
              </Form.Control.Feedback>
              <Form.Text>{copy.displayOrderHelp}</Form.Text>
            </Form.Group>
            <div className="d-flex flex-wrap gap-4 mb-3">
              <Form.Check
                type="switch"
                label={copy.required}
                disabled={!canManage}
                {...register("required")}
              />
              <Form.Check
                type="switch"
                label={copy.multivalued}
                disabled={!canManage}
                {...register("multivalued")}
              />
              <Form.Check
                type="switch"
                label={copy.enabled}
                disabled={!canManage}
                {...register("enabled")}
              />
            </div>
            <Form.Group className="mb-3" controlId="profile-definition-min-length">
              <Form.Label>{copy.minLength}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={2000}
                disabled={!canManage}
                {...register("minLength", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-max-length">
              <Form.Label>{copy.maxLength}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={2000}
                disabled={!canManage}
                {...register("maxLength", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="profile-definition-pattern">
              <Form.Label>{copy.pattern}</Form.Label>
              <Form.Control
                maxLength={500}
                disabled={!canManage}
                isInvalid={Boolean(errors.pattern)}
                {...register("pattern")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.pattern?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <div className="admin-create-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => router.push("/admin/settings/user-profile")}
              >
                <AdminActionIcon action="cancel" />
                {dictionary.admin.common.cancel}
              </Button>
              <Button disabled={!canManage || isSubmitting} type="submit">
                {isSubmitting ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <AdminActionIcon action="save" />
                )}
                {editingId === null ? copy.create : copy.update}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
