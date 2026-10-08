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

type Values = {
  name: string;
  displayName: string;
  description: string;
  displayOnConsentScreen: boolean;
  consentScreenText: string;
  includeInTokenScope: boolean;
  groupMapperEnabled: boolean;
  groupClaimName: string;
  groupMapperFullPath: boolean;
};

export function ClientScopeCreateForm({ dictionary }: { dictionary: Dictionary; locale: Locale }) {
  const { access, accessToken } = useAdminAuth();
  const canManageClients = Boolean(access?.manageClients);
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const copy = dictionary.admin.clientScopes;
  const common = dictionary.admin.common;
  const schema = z.object({
    name: z.string().trim().min(1, common.validation.required).max(100, common.validation.max100),
    displayName: z.string().max(200, common.validation.max200),
    description: z.string().max(500, common.validation.max500),
    displayOnConsentScreen: z.boolean(),
    consentScreenText: z.string().max(200, common.validation.max200),
    includeInTokenScope: z.boolean(),
    groupMapperEnabled: z.boolean(),
    groupClaimName: z
      .string()
      .trim()
      .min(1, common.validation.required)
      .max(100, common.validation.max100),
    groupMapperFullPath: z.boolean(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      displayOnConsentScreen: false,
      consentScreenText: "",
      includeInTokenScope: true,
      groupMapperEnabled: false,
      groupClaimName: "groups",
      groupMapperFullPath: true,
    },
  });

  const submit = async (values: Values) => {
    if (!accessToken || !canManageClients) return;
    try {
      const response = await adminRequest(accessToken, {
        url: "/api/admin/client-scopes",
        method: "POST",
        data: values,
      });
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setError, {
          fields: ["name"],
          fallbackMessage: (_, problem) =>
            problem.errorCode === "admin_client_scope_duplicate"
              ? common.validation.scopeDuplicate
              : common.validation.required,
        });
        if (result.firstField) {
          return;
        }
        throw new Error();
      }
      router.push(`/admin/client-scopes`);
    } catch {
      alerts.addError(copy.operationError);
    }
  };

  return (
    <Card className="admin-panel-card admin-create-card">
      <Card.Body>
        <Form className="admin-create-form" noValidate onSubmit={handleSubmit(submit)}>
          <Form.Group className="mb-3" controlId="client-scope-name">
            <Form.Label>{copy.name}</Form.Label>
            <Form.Control
              autoComplete="off"
              autoFocus
              isInvalid={Boolean(errors.name)}
              maxLength={100}
              disabled={!canManageClients}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="client-scope-display-name">
            <Form.Label>{copy.displayName}</Form.Label>
            <Form.Control
              isInvalid={Boolean(errors.displayName)}
              maxLength={200}
              disabled={!canManageClients}
              {...register("displayName")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.displayName?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="client-scope-description">
            <Form.Label>{copy.description}</Form.Label>
            <Form.Control
              as="textarea"
              isInvalid={Boolean(errors.description)}
              maxLength={500}
              rows={4}
              disabled={!canManageClients}
              {...register("description")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.description?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="client-scope-consent-screen-text">
            <Form.Label>{copy.consentScreenText}</Form.Label>
            <Form.Control
              isInvalid={Boolean(errors.consentScreenText)}
              maxLength={200}
              disabled={!canManageClients}
              {...register("consentScreenText")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.consentScreenText?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Check
            className="mb-2"
            type="switch"
            id="client-scope-display-on-consent-screen"
            label={copy.displayOnConsentScreen}
            disabled={!canManageClients}
            {...register("displayOnConsentScreen")}
          />
          <Form.Check
            className="mb-3"
            type="switch"
            id="client-scope-include-in-token-scope"
            label={copy.includeInTokenScope}
            disabled={!canManageClients}
            {...register("includeInTokenScope")}
          />
          <Form.Group className="mb-3" controlId="client-scope-group-claim-name">
            <Form.Label>{copy.groupClaimName}</Form.Label>
            <Form.Control
              isInvalid={Boolean(errors.groupClaimName)}
              maxLength={100}
              disabled={!canManageClients}
              {...register("groupClaimName")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.groupClaimName?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Check
            className="mb-2"
            type="switch"
            id="client-scope-group-mapper-enabled"
            label={copy.groupMapperEnabled}
            disabled={!canManageClients}
            {...register("groupMapperEnabled")}
          />
          <Form.Check
            className="mb-3"
            type="switch"
            id="client-scope-group-mapper-full-path"
            label={copy.groupMapperFullPath}
            disabled={!canManageClients}
            {...register("groupMapperFullPath")}
          />
          <div className="admin-create-actions">
            <Button variant="secondary" onClick={() => router.push(`/admin/client-scopes`)}>
              <AdminActionIcon action="cancel" />
              {common.cancel}
            </Button>
            <Button disabled={!canManageClients || isSubmitting} type="submit">
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
