"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { useRouter } from "@/routing/navigation";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";

import { AdminActionIcon } from "./AdminActionIcon";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { useAdminAuth } from "./AdminAuthProvider";
import { ClientMappers } from "./ClientMappers";
import { ClientScopeRoleMappings } from "./ClientScopeRoleMappings";
import { ConfirmModal } from "./ConfirmModal";
import { DetailLoadingState, ErrorState } from "./AsyncState";
import { ViewHeader } from "./ViewHeader";

type ClientScope = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  builtIn: boolean;
  displayOnConsentScreen: boolean;
  consentScreenText: string | null;
  includeInTokenScope: boolean;
  createdAt: string;
  updatedAt: string;
  groupMapperEnabled: boolean;
  groupClaimName: string;
  groupMapperFullPath: boolean;
};

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

export function ClientScopeDetail({
  dictionary,
  id,
  locale,
}: {
  dictionary: Dictionary;
  id: string;
  locale: Locale;
}) {
  const { access, accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const router = useRouter();
  const copy = dictionary.admin.clientScopes;
  const common = dictionary.admin.common;
  const [scope, setScope] = useState<ClientScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const schema = z.object({
    name: z.string().trim().min(1, common.validation.required).max(100, common.validation.max100),
    displayName: z.string().max(200, common.validation.max200),
    description: z.string().max(500, common.validation.max500),
    displayOnConsentScreen: z.boolean(),
    consentScreenText: z.string().max(200, common.validation.max200),
    includeInTokenScope: z.boolean(),
    groupMapperEnabled: z.boolean(),
    groupClaimName: z.string().trim().min(1, common.validation.required).max(100),
    groupMapperFullPath: z.boolean(),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
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

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await adminRequest<ClientScope>(accessToken, {
        url: `/api/admin/client-scopes/${encodeURIComponent(id)}`,
      });
      if (response.status >= 300) throw new Error();
      setScope(response.data);
      reset({
        name: response.data.name,
        displayName: response.data.displayName ?? "",
        description: response.data.description ?? "",
        displayOnConsentScreen: response.data.displayOnConsentScreen,
        consentScreenText: response.data.consentScreenText ?? "",
        includeInTokenScope: response.data.includeInTokenScope,
        groupMapperEnabled: response.data.groupMapperEnabled,
        groupClaimName: response.data.groupClaimName,
        groupMapperFullPath: response.data.groupMapperFullPath,
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, reset]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const save = async (values: Values) => {
    if (!access?.manageClients || !accessToken || !scope || scope.builtIn) return;
    const response = await adminRequest<ClientScope>(accessToken, {
      url: `/api/admin/client-scopes/${encodeURIComponent(scope.id)}`,
      method: "PUT",
      data: values,
    });
    if (response.status >= 300) {
      alerts.addError(copy.operationError);
      return;
    }
    setScope(response.data);
    reset({
      name: response.data.name,
      displayName: response.data.displayName ?? "",
      description: response.data.description ?? "",
      displayOnConsentScreen: response.data.displayOnConsentScreen,
      consentScreenText: response.data.consentScreenText ?? "",
      includeInTokenScope: response.data.includeInTokenScope,
      groupMapperEnabled: response.data.groupMapperEnabled,
      groupClaimName: response.data.groupClaimName,
      groupMapperFullPath: response.data.groupMapperFullPath,
    });
    alerts.addAlert(copy.saved);
  };

  const remove = async () => {
    if (!access?.manageClients || !accessToken || !scope || scope.builtIn) return;
    const response = await adminRequest(accessToken, {
      url: `/api/admin/client-scopes/${encodeURIComponent(scope.id)}`,
      method: "DELETE",
    });
    if (response.status >= 300) {
      setShowDelete(false);
      alerts.addError(
        response.status === 400
          ? scope.builtIn
            ? copy.protectedError
            : copy.assignedDeleteError
          : copy.operationError,
      );
      return;
    }
    alerts.addAlert(copy.deleted);
    router.replace("/admin/client-scopes");
  };

  if (loading && !scope) return <DetailLoadingState />;
  if (error || !scope) {
    return <ErrorState message={copy.operationError} />;
  }

  return (
    <div className="d-grid gap-4">
      <AdminBreadcrumb
        items={[{ label: copy.title, href: "/admin/client-scopes" }, { label: scope.name }]}
      />
      <ViewHeader
        title={scope.name}
        description={scope.displayName || copy.subtitle}
        actions={
          access?.manageClients && !scope.builtIn ? (
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              <AdminActionIcon action="delete" />
              {copy.delete}
            </Button>
          ) : undefined
        }
      />
      <Card className="admin-panel-card">
        <Card.Body>
          <Form id="client-scope-detail-form" noValidate onSubmit={handleSubmit(save)}>
            <Form.Group className="mb-3" controlId="client-scope-detail-name">
              <Form.Label>{copy.name}</Form.Label>
              <Form.Control
                disabled={scope.builtIn || !access?.manageClients}
                isInvalid={Boolean(errors.name)}
                {...register("name")}
              />
              <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="client-scope-detail-display-name">
              <Form.Label>{copy.displayName}</Form.Label>
              <Form.Control
                disabled={scope.builtIn || !access?.manageClients}
                isInvalid={Boolean(errors.displayName)}
                {...register("displayName")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.displayName?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-4" controlId="client-scope-detail-description">
              <Form.Label>{copy.description}</Form.Label>
              <Form.Control
                as="textarea"
                disabled={scope.builtIn || !access?.manageClients}
                isInvalid={Boolean(errors.description)}
                rows={4}
                {...register("description")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.description?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="client-scope-detail-consent-screen-text">
              <Form.Label>{copy.consentScreenText}</Form.Label>
              <Form.Control
                disabled={scope.builtIn || !access?.manageClients}
                isInvalid={Boolean(errors.consentScreenText)}
                maxLength={200}
                {...register("consentScreenText")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.consentScreenText?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Check
              className="mb-2"
              disabled={scope.builtIn || !access?.manageClients}
              label={copy.displayOnConsentScreen}
              {...register("displayOnConsentScreen")}
            />
            <Form.Check
              className="mb-4"
              disabled={scope.builtIn || !access?.manageClients}
              label={copy.includeInTokenScope}
              {...register("includeInTokenScope")}
            />
            <Form.Group className="mb-3" controlId="client-scope-detail-group-claim-name">
              <Form.Label>{copy.groupClaimName}</Form.Label>
              <Form.Control
                disabled={scope.builtIn || !access?.manageClients}
                isInvalid={Boolean(errors.groupClaimName)}
                {...register("groupClaimName")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.groupClaimName?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Check
              className="mb-2"
              disabled={scope.builtIn || !access?.manageClients}
              label={copy.groupMapperEnabled}
              {...register("groupMapperEnabled")}
            />
            <Form.Check
              className="mb-4"
              disabled={scope.builtIn || !access?.manageClients}
              label={copy.groupMapperFullPath}
              {...register("groupMapperFullPath")}
            />
            <div className="admin-form-actions">
              <Button
                disabled={isSubmitting || !access?.manageClients || scope.builtIn}
                type="submit"
              >
                {isSubmitting ? (
                  <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                ) : (
                  <AdminActionIcon action="save" />
                )}
                {common.save}
              </Button>
            </div>
          </Form>
          <dl className="row mt-4 mb-0">
            <dt className="col-md-3">{dictionary.admin.resources.created}</dt>
            <dd className="col-md-9">{new Date(scope.createdAt).toLocaleString(locale)}</dd>
            <dt className="col-md-3">{dictionary.admin.resources.updated}</dt>
            <dd className="col-md-9">{new Date(scope.updatedAt).toLocaleString(locale)}</dd>
          </dl>
        </Card.Body>
      </Card>

      <ClientMappers
        baseUrl={`/api/admin/client-scopes/${encodeURIComponent(scope.id)}/mappers`}
        clientId={scope.id}
        dictionary={dictionary}
        readOnly={scope.builtIn}
      />
      <ClientScopeRoleMappings
        dictionary={dictionary}
        readOnly={scope.builtIn}
        scopeId={scope.id}
      />

      <ConfirmModal
        cancelLabel={common.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteConfirm}
        onCancel={() => setShowDelete(false)}
        onConfirm={() => void remove()}
        show={showDelete}
      />
    </div>
  );
}
