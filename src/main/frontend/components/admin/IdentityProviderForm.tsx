"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { useForm } from "@/lib/form";
import { useRouter } from "@/routing/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import { applyProblemToForm } from "@/lib/problem-detail";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";

export type IdentityProviderSyncMode = "legacy" | "import" | "read_only" | "force";

export type IdentityProviderFormData = {
  registrationId: string;
  providerType: string;
  displayName: string;
  alias: string;
  iconKey: string;
  shortStateParameter: boolean;
  caseSensitiveUsername: boolean;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  hideOnLogin: boolean;
  accountLinkingOnly: boolean;
  trustEmail: boolean;
  mfaRequired: boolean;
  requiredClaims: string;
  storeTokens: boolean;
  storedTokensReadable: boolean;
  guiOrder: number;
  showInAccountConsole: string;
  syncMode: IdentityProviderSyncMode;
  authorizationUri: string;
  tokenUri: string;
  userInfoUri: string;
  jwkSetUri: string;
  issuerUri: string;
  clientAuthenticationMethod: string;
  scopes: string;
  userNameAttribute: string;
};
export function IdentityProviderForm({
  dictionary,
  id,
  initial,
}: {
  dictionary: Dictionary;
  id?: string;
  initial?: Partial<IdentityProviderFormData>;
}) {
  const { accessToken } = useAdminAuth();
  const router = useRouter();
  const alerts = useConsoleAlerts();
  const copy = dictionary.admin.identityProviders;
  const edit = Boolean(id);
  const schema = useMemo(
    () =>
      z.object({
        registrationId: z
          .string()
          .trim()
          .min(1, dictionary.admin.common.validation.required)
          .max(50),
        providerType: z.string().trim().min(1),
        displayName: z.string().trim().min(1, dictionary.admin.common.validation.required).max(100),
        alias: z
          .string()
          .trim()
          .regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, copy.aliasInvalid),
        iconKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
        shortStateParameter: z.boolean(),
        caseSensitiveUsername: z.boolean(),
        enabled: z.boolean(),
        clientId: z.string().trim().min(1, dictionary.admin.common.validation.required),
        clientSecret: z.string().max(1000),
        hideOnLogin: z.boolean(),
        accountLinkingOnly: z.boolean(),
        trustEmail: z.boolean(),
        mfaRequired: z.boolean(),
        requiredClaims: z.string().max(500),
        storeTokens: z.boolean(),
        storedTokensReadable: z.boolean(),
        guiOrder: z.number().min(0),
        showInAccountConsole: z.string(),
        syncMode: z.enum(["legacy", "import", "read_only", "force"]),
        authorizationUri: z.string(),
        tokenUri: z.string(),
        userInfoUri: z.string(),
        jwkSetUri: z.string(),
        issuerUri: z.string(),
        clientAuthenticationMethod: z.string(),
        scopes: z.string().min(1),
        userNameAttribute: z.string().min(1),
      }),
    [copy.aliasInvalid, dictionary.admin.common.validation.required],
  );
  const defaults = useMemo<IdentityProviderFormData>(
    () => ({
      registrationId: "",
      providerType: "oidc",
      displayName: "",
      alias: "",
      iconKey: "generic",
      shortStateParameter: false,
      caseSensitiveUsername: false,
      enabled: true,
      clientId: "",
      clientSecret: "",
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: false,
      requiredClaims: "sub,email",
      storeTokens: false,
      storedTokensReadable: false,
      guiOrder: 0,
      showInAccountConsole: "always",
      syncMode: "import",
      authorizationUri: "",
      tokenUri: "",
      userInfoUri: "",
      jwkSetUri: "",
      issuerUri: "",
      clientAuthenticationMethod: "client_secret_basic",
      scopes: "openid,profile,email",
      userNameAttribute: "sub",
      ...initial,
    }),
    [initial],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IdentityProviderFormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: defaults,
  });
  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);
  const submit = async (data: IdentityProviderFormData) => {
    if (!accessToken) return;
    const response = await adminRequest<{ id: string }>(accessToken, {
      url: edit ? `/api/admin/identity-providers/${id}` : "/api/admin/identity-providers",
      method: edit ? "PUT" : "POST",
      data,
    });
    if (response.status >= 300) {
      const result = applyProblemToForm(response.data, setError, {
        fields: ["registrationId", "alias", "clientId", "clientSecret"],
        fallbackMessage: () => copy.saveError,
      });
      if (result.firstField) return;
      alerts.addError(copy.saveError);
      return;
    }
    alerts.addAlert(edit ? copy.saved : copy.created);
    router.push(`/admin/identity-providers/${response.data.id}/details`);
  };
  const field = (name: keyof IdentityProviderFormData, label: string, type = "text") => (
    <Form.Group className="mb-3" controlId={`provider-${name}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        type={type}
        isInvalid={Boolean(errors[name])}
        {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
      />
      <Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback>
    </Form.Group>
  );
  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <Form noValidate onSubmit={handleSubmit(submit)}>
          <Row>
            <Col md={6}>
              {field("displayName", copy.name)}
              {field("registrationId", copy.registrationId)}
              {field("alias", copy.alias)}
              {field("providerType", copy.type)}
              <Form.Group className="mb-3" controlId="provider-icon-key">
                <Form.Label>{copy.icon}</Form.Label>
                <Form.Select {...register("iconKey")}>
                  <option value="generic">{copy.iconGeneric}</option>
                  <option value="google">Google</option>
                  <option value="github">GitHub</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="microsoft">Microsoft</option>
                  <option value="building">{copy.iconBuilding}</option>
                  <option value="key">{copy.iconKey}</option>
                  <option value="shield">{copy.iconShield}</option>
                </Form.Select>
              </Form.Group>
              {field("clientId", copy.clientId)}
              {field("clientSecret", copy.clientSecret, "password")}
              {field("guiOrder", copy.order, "number")}
              <Form.Group className="mb-3" controlId="provider-sync-mode">
                <Form.Label>{copy.syncMode}</Form.Label>
                <Form.Select {...register("syncMode")}>
                  <option value="legacy">{copy.syncModeLegacy}</option>
                  <option value="import">{copy.syncModeImport}</option>
                  <option value="read_only">{copy.syncModeReadOnly}</option>
                  <option value="force">{copy.syncModeForce}</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              {field("authorizationUri", copy.authorizationUri)}
              {field("tokenUri", copy.tokenUri)}
              {field("userInfoUri", copy.userInfoUri)}
              {field("jwkSetUri", copy.jwkSetUri)}
              {field("issuerUri", copy.issuerUri)}
              {field("scopes", copy.scopes)}
              {field("userNameAttribute", copy.userNameAttribute)}
            </Col>
          </Row>
          <div className="d-flex flex-wrap gap-3 mb-3">
            {(
              [
                "enabled",
                "shortStateParameter",
                "caseSensitiveUsername",
                "hideOnLogin",
                "accountLinkingOnly",
                "trustEmail",
                "mfaRequired",
                "storeTokens",
                "storedTokensReadable",
              ] as const
            ).map((name) => (
              <Form.Check key={name} type="checkbox" label={copy[name]} {...register(name)} />
            ))}
          </div>
          <Row>
            <Col md={6}>{field("requiredClaims", copy.requiredClaims)}</Col>
            <Col md={6}>
              <Form.Group controlId="provider-auth-method">
                <Form.Label>{copy.clientAuthenticationMethod}</Form.Label>
                <Form.Select {...register("clientAuthenticationMethod")}>
                  <option value="client_secret_basic">client_secret_basic</option>
                  <option value="client_secret_post">client_secret_post</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <div className="admin-create-actions mt-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.push("/admin/identity-providers")}
            >
              <AdminActionIcon action="cancel" />
              {dictionary.admin.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : (
                <AdminActionIcon action={edit ? "save" : "add"} />
              )}
              {edit ? dictionary.admin.common.save : copy.create}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
