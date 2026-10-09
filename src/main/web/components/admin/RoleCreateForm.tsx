"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/routing/navigation";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { applyProblemToForm } from "@/lib/problem-detail";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";

type Role = { name: string };

export function RoleCreateForm({ dictionary }: { dictionary: Dictionary; locale: Locale }) {
  const { access, accessToken } = useAdminAuth();
  const canManageRoles = Boolean(access?.manageRoles);
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const copy = dictionary.admin.roles;
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, dictionary.admin.common.validation.required)
      .max(50, dictionary.admin.common.validation.max50)
      .regex(/^ROLE_[A-Z0-9_]+$/, dictionary.admin.common.validation.roleFormat),
    description: z.string().trim().max(500, dictionary.admin.common.validation.max500),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  const submit = async ({ name, description }: z.infer<typeof schema>) => {
    if (!accessToken || !canManageRoles) return;
    try {
      const response = await adminRequest<Role>(accessToken, {
        url: "/api/admin/roles",
        method: "POST",
        data: { name, ...(description ? { description } : {}) },
      });
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setError, {
          fields: ["name"],
          fallbackMessage: (_, problem) =>
            problem.errorCode === "admin_role_duplicate_name"
              ? dictionary.admin.common.validation.roleDuplicate
              : dictionary.admin.common.validation.roleFormat,
        });
        if (result.firstField) {
          return;
        }
        throw new Error();
      }
      router.push(`/admin/roles/${encodeURIComponent(response.data.name)}`);
    } catch {
      alerts.addError(copy.operationError);
    }
  };

  return (
    <Card className="admin-panel-card admin-create-card">
      <Card.Body>
        <Form className="admin-create-form" noValidate onSubmit={handleSubmit(submit)}>
          <Form.Group className="mb-3" controlId="role-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              autoComplete="off"
              autoFocus
              isInvalid={Boolean(errors.name)}
              maxLength={50}
              placeholder="ROLE_AUDITOR"
              disabled={!canManageRoles}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
            <Form.Text>{copy.help}</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="role-description">
            <Form.Label>{copy.description}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              isInvalid={Boolean(errors.description)}
              {...register("description")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.description?.message}
            </Form.Control.Feedback>
            <Form.Text>{copy.descriptionHelp}</Form.Text>
          </Form.Group>
          <div className="admin-create-actions">
            <Button variant="secondary" onClick={() => router.push(`/admin/roles`)}>
              <AdminActionIcon action="cancel" />
              {dictionary.admin.common.cancel}
            </Button>
            <Button disabled={!canManageRoles || isSubmitting} type="submit">
              {isSubmitting ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="add" />
              )}
              {copy.create}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
