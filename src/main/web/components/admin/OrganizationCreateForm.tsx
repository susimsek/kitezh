"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/routing/navigation";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { useForm } from "@/lib/form";
import { applyProblemToForm } from "@/lib/problem-detail";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";

export function OrganizationCreateForm({ dictionary }: { dictionary: Dictionary }) {
  const { access, accessToken } = useAdminAuth();
  const router = useRouter();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.organizations;
  const schema = z.object({
    alias: z.string().trim().min(1, dictionary.admin.common.validation.required).max(100),
    name: z.string().trim().min(1, dictionary.admin.common.validation.required).max(200),
    displayName: z.string().max(200),
    description: z.string().max(2000),
    enabled: z.boolean(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { alias: "", name: "", displayName: "", description: "", enabled: true },
  });

  const submit = async (data: z.infer<typeof schema>) => {
    if (!accessToken || (!access?.manageOrganizations && !access?.isAdmin)) return;
    try {
      const response = await adminRequest<{ id: number }>(accessToken, {
        url: "/api/admin/organizations",
        method: "POST",
        data,
      });
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setError, { fields: ["alias", "name"] });
        if (result.firstField) return;
        throw new Error();
      }
      router.push(`/admin/organizations/${response.data.id}`);
    } catch {
      alerts.addError(copy.operationError);
    }
  };

  return (
    <Card className="admin-panel-card admin-create-card">
      <Card.Body>
        <Form className="admin-create-form" noValidate onSubmit={handleSubmit(submit)}>
          <Form.Group className="mb-3" controlId="organization-alias">
            <Form.Label>{copy.alias}</Form.Label>
            <Form.Control
              autoFocus
              autoComplete="off"
              isInvalid={Boolean(errors.alias)}
              disabled={isSubmitting}
              {...register("alias")}
            />
            <Form.Control.Feedback type="invalid">{errors.alias?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="organization-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              isInvalid={Boolean(errors.name)}
              disabled={isSubmitting}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="organization-display-name">
            <Form.Label>{copy.displayName}</Form.Label>
            <Form.Control disabled={isSubmitting} {...register("displayName")} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="organization-description">
            <Form.Label>{copy.description}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              disabled={isSubmitting}
              {...register("description")}
            />
          </Form.Group>
          <Form.Check
            className="mb-3"
            type="switch"
            label={copy.enabled}
            {...register("enabled")}
          />
          <div className="admin-create-actions">
            <Button variant="secondary" onClick={() => router.push("/admin/organizations")}>
              <AdminActionIcon action="cancel" />
              {dictionary.admin.common.cancel}
            </Button>
            <Button disabled={isSubmitting} type="submit">
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
