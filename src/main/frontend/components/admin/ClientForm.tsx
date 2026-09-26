"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { useRouter } from "@/routing/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@/lib/form";
import { useWatch, type FieldErrors } from "react-hook-form";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { applyProblemToForm } from "@/lib/problem-detail";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ErrorState, LoadingState } from "./AsyncState";
import { HelpItem } from "./HelpItem";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ResultModal } from "./ResultModal";
import type { AdminClient } from "./ClientsTable";

type Detail = AdminClient & {
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  authorizationCodeTimeToLive: string;
  accessTokenTimeToLive: string;
  refreshTokenTimeToLive: string;
};

type ClientScopeOption = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
};

type FormState = {
  clientId: string;
  clientName: string;
  clientAuthenticationMethods: (typeof METHODS)[number][];
  authorizationGrantTypes: (typeof GRANTS)[number][];
  redirectUris: string;
  postLogoutRedirectUris: string;
  scopes: string;
  requireAuthorizationConsent: boolean;
  requireProofKey: boolean;
  requireDpop: boolean;
  requireDpopJkt: boolean;
  dpopRefreshTokenOnly: boolean;
  dpopSigningAlgorithms: (typeof DPOP_ALGORITHMS)[number][];
  authorizationCodeTimeToLive: string;
  accessTokenTimeToLive: string;
  refreshTokenTimeToLive: string;
};

const EMPTY: FormState = {
  clientId: "",
  clientName: "",
  clientAuthenticationMethods: ["client_secret_basic"],
  authorizationGrantTypes: ["authorization_code", "refresh_token"],
  redirectUris: "",
  postLogoutRedirectUris: "",
  scopes: "openid profile",
  requireAuthorizationConsent: true,
  requireProofKey: true,
  requireDpop: false,
  requireDpopJkt: false,
  dpopRefreshTokenOnly: false,
  dpopSigningAlgorithms: ["RS256", "ES256"],
  authorizationCodeTimeToLive: "PT5M",
  accessTokenTimeToLive: "PT5M",
  refreshTokenTimeToLive: "PT1H",
};

const METHODS = ["client_secret_basic", "client_secret_post", "none"] as const;
const GRANTS = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "urn:ietf:params:oauth:grant-type:token-exchange",
] as const;
const DPOP_ALGORITHMS = ["RS256", "ES256"] as const;
const CLIENT_FORM_STEP_FIELDS: (keyof FormState)[][] = [
  ["clientId", "clientName"],
  [
    "clientAuthenticationMethods",
    "authorizationGrantTypes",
    "requireAuthorizationConsent",
    "requireProofKey",
  ],
  ["redirectUris", "postLogoutRedirectUris", "scopes"],
];
const clientSchema = (validation: Dictionary["admin"]["common"]["validation"]) =>
  z
    .object({
      clientId: z.string().trim().min(1, validation.required).max(100, validation.max100),
      clientName: z.string().trim().min(1, validation.required).max(200, validation.max200),
      scopes: z.string().trim().min(1, validation.scope),
      clientAuthenticationMethods: z.array(z.enum(METHODS)).min(1, validation.selection),
      authorizationGrantTypes: z.array(z.enum(GRANTS)).min(1, validation.selection),
      redirectUris: z
        .string()
        .refine((value) => lines(value).every(isValidAbsoluteUri), validation.uri),
      postLogoutRedirectUris: z
        .string()
        .refine((value) => lines(value).every(isValidAbsoluteUri), validation.uri),
      requireAuthorizationConsent: z.boolean(),
      requireProofKey: z.boolean(),
      requireDpop: z.boolean(),
      requireDpopJkt: z.boolean(),
      dpopRefreshTokenOnly: z.boolean(),
      dpopSigningAlgorithms: z.array(z.enum(DPOP_ALGORITHMS)).min(1, validation.selection),
      authorizationCodeTimeToLive: z.string(),
      accessTokenTimeToLive: z.string(),
      refreshTokenTimeToLive: z.string(),
    })
    .superRefine((value, context) => {
      const authorizationCode = value.authorizationGrantTypes.includes("authorization_code");
      const publicClient = value.clientAuthenticationMethods.includes("none");
      if (authorizationCode && lines(value.redirectUris).length === 0)
        context.addIssue({ code: "custom", path: ["redirectUris"], message: validation.required });
      if (publicClient && value.clientAuthenticationMethods.length > 1)
        context.addIssue({
          code: "custom",
          path: ["clientAuthenticationMethods"],
          message: validation.selection,
        });
      if (publicClient && value.authorizationGrantTypes.includes("client_credentials"))
        context.addIssue({
          code: "custom",
          path: ["authorizationGrantTypes"],
          message: validation.selection,
        });
      if (publicClient && authorizationCode && !value.requireProofKey)
        context.addIssue({
          code: "custom",
          path: ["authorizationGrantTypes"],
          message: validation.selection,
        });
      if (value.requireProofKey && !authorizationCode)
        context.addIssue({
          code: "custom",
          path: ["authorizationGrantTypes"],
          message: validation.selection,
        });
    });

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidAbsoluteUri(value: string) {
  if (!URL.canParse(value)) return false;
  const uri = new URL(value);
  return Boolean(uri.protocol) && uri.hash === "";
}

function words(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ClientForm({
  dictionary,
  mode,
  id,
  embedded = false,
}: {
  locale: Locale;
  dictionary: Dictionary;
  mode: "create" | "edit";
  id?: string | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { access, accessToken } = useAdminAuth();
  const canManageClients = Boolean(access?.manageClients);
  const alerts = useConsoleAlerts();
  const missingId = mode === "edit" && !id;
  const [loading, setLoading] = useState(mode === "edit" && Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [scopeCatalog, setScopeCatalog] = useState<ClientScopeOption[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    reset,
    setValue,
    setFocus,
    setError: setFieldError,
    control,
  } = useForm<FormState>({
    resolver: zodResolver(clientSchema(dictionary.admin.common.validation)),
    mode: "onChange",
    defaultValues: EMPTY,
  });
  const clientAuthenticationMethods = useWatch({
    control,
    name: "clientAuthenticationMethods",
    defaultValue: EMPTY.clientAuthenticationMethods,
  });
  const authorizationGrantTypes = useWatch({
    control,
    name: "authorizationGrantTypes",
    defaultValue: EMPTY.authorizationGrantTypes,
  });
  const requireProofKey = useWatch({
    control,
    name: "requireProofKey",
    defaultValue: EMPTY.requireProofKey,
  });
  const requireAuthorizationConsent = useWatch({
    control,
    name: "requireAuthorizationConsent",
    defaultValue: EMPTY.requireAuthorizationConsent,
  });
  const requireDpop = useWatch({
    control,
    name: "requireDpop",
    defaultValue: EMPTY.requireDpop,
  });
  const requireDpopJkt = useWatch({
    control,
    name: "requireDpopJkt",
    defaultValue: EMPTY.requireDpopJkt,
  });
  const dpopRefreshTokenOnly = useWatch({
    control,
    name: "dpopRefreshTokenOnly",
    defaultValue: EMPTY.dpopRefreshTokenOnly,
  });
  const dpopSigningAlgorithms = useWatch({
    control,
    name: "dpopSigningAlgorithms",
    defaultValue: EMPTY.dpopSigningAlgorithms,
  });
  const selectedScopes = useWatch({ control, name: "scopes", defaultValue: EMPTY.scopes });

  useEffect(() => {
    if (mode !== "create" || !accessToken) return;
    adminRequest<PageResponse<ClientScopeOption>>(accessToken, {
      url: "/api/admin/client-scopes?page=0&size=100",
    })
      .then((response) => {
        if (response.status < 300 && Array.isArray(response.data.content))
          setScopeCatalog(response.data.content);
      })
      .catch(() => undefined);
  }, [accessToken, mode]);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    if (!id || !accessToken) {
      return;
    }

    adminRequest<Detail>(accessToken, {
      url: `/api/admin/clients/${encodeURIComponent(id)}`,
    })
      .then((response) => {
        if (response.status >= 300) {
          throw new Error();
        }
        return response.data;
      })
      .then((client) =>
        reset({
          clientId: client.clientId,
          clientName: client.clientName,
          clientAuthenticationMethods:
            client.clientAuthenticationMethods as FormState["clientAuthenticationMethods"],
          authorizationGrantTypes:
            client.authorizationGrantTypes as FormState["authorizationGrantTypes"],
          redirectUris: client.redirectUris.join("\n"),
          postLogoutRedirectUris: client.postLogoutRedirectUris.join("\n"),
          scopes: client.scopes.join(" "),
          requireAuthorizationConsent: client.requireAuthorizationConsent,
          requireProofKey: client.requireProofKey,
          requireDpop: client.requireDpop ?? false,
          requireDpopJkt: client.requireDpopJkt ?? false,
          dpopRefreshTokenOnly: client.dpopRefreshTokenOnly ?? false,
          dpopSigningAlgorithms: (client.dpopSigningAlgorithms ?? [
            "RS256",
            "ES256",
          ]) as FormState["dpopSigningAlgorithms"],
          authorizationCodeTimeToLive: client.authorizationCodeTimeToLive ?? "PT5M",
          accessTokenTimeToLive: client.accessTokenTimeToLive ?? "PT5M",
          refreshTokenTimeToLive: client.refreshTokenTimeToLive ?? "PT1H",
        }),
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, id, mode, reset]);

  const toggle = (
    field: "clientAuthenticationMethods" | "authorizationGrantTypes",
    value: string,
  ) => {
    if (!canManageClients) return;
    const selected = getValues(field) as string[];
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setValue(field, next as FormState[typeof field], { shouldDirty: true, shouldValidate: true });
  };

  const toggleScope = (scope: string) => {
    if (!canManageClients) return;
    const selected = words(getValues("scopes"));
    const next = selected.includes(scope)
      ? selected.filter((item) => item !== scope)
      : [...selected, scope];
    setValue("scopes", next.join(" "), { shouldDirty: true, shouldValidate: true });
  };

  const submit = async (values: FormState) => {
    if (!canManageClients) return;
    setSaving(true);
    setError(false);
    setErrorMessage(null);

    if (!accessToken) {
      setSaving(false);
      return;
    }

    const payload = {
      ...values,
      redirectUris: lines(values.redirectUris),
      postLogoutRedirectUris: lines(values.postLogoutRedirectUris),
      scopes: words(values.scopes),
    };

    const url =
      mode === "create"
        ? "/api/admin/clients"
        : `/api/admin/clients/${encodeURIComponent(id ?? "")}`;

    try {
      const response = await adminRequest<Detail | { client: Detail; clientSecret: string | null }>(
        accessToken,
        {
          url,
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          data: payload,
        },
      );
      if (response.status >= 300) {
        const result = applyProblemToForm(response.data, setFieldError, {
          fields: Object.keys(EMPTY),
          fallbackMessage: ({ field }, problem) =>
            problem.errorCode === "admin_client_duplicate_client_id"
              ? dictionary.admin.common.validation.clientIdDuplicate
              : field === "scopes"
                ? dictionary.admin.common.validation.scope
                : field === "redirectUris"
                  ? dictionary.admin.common.validation.uri
                  : field === "clientAuthenticationMethods" || field === "authorizationGrantTypes"
                    ? dictionary.admin.common.validation.selection
                    : dictionary.admin.common.validation.required,
        });
        if (mode === "create" && result.firstField) {
          const firstInvalidField = result.firstField as keyof FormState;
          const invalidStep = CLIENT_FORM_STEP_FIELDS.findIndex((fields) =>
            fields.includes(firstInvalidField),
          );
          if (invalidStep >= 0) {
            setStep(invalidStep);
            window.setTimeout(() => setFocus(firstInvalidField), 0);
          } else {
            setFocus(firstInvalidField);
          }
        }
        throw new Error(
          typeof response.data === "object" &&
            response.data !== null &&
            "detail" in response.data &&
            typeof response.data.detail === "string"
            ? response.data.detail
            : dictionary.admin.clients.saveError,
        );
      }
      alerts.addAlert(dictionary.admin.clients.saved);
      if (mode === "create") {
        const created = response.data as {
          client: Detail;
          clientSecret: string | null;
        };
        if (created.clientSecret) {
          setCreatedClientId(created.client.id);
          setCreatedSecret(created.clientSecret);
          return;
        }
        router.push(`/admin/clients/${encodeURIComponent(created.client.id)}/settings`);
      } else {
        const saved = response.data as Detail;
        router.push(`/admin/clients/${encodeURIComponent(saved.id)}/settings`);
      }
    } catch (exception: unknown) {
      setError(true);
      setErrorMessage(
        exception instanceof Error ? exception.message : dictionary.admin.clients.saveError,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInvalid = (formErrors: FieldErrors<FormState>) => {
    if (mode !== "create") return;
    const firstInvalidField = Object.keys(formErrors)[0] as keyof FormState | undefined;
    const invalidStep = firstInvalidField
      ? CLIENT_FORM_STEP_FIELDS.findIndex((fields) => fields.includes(firstInvalidField))
      : -1;
    if (invalidStep >= 0) {
      setStep(invalidStep);
      if (firstInvalidField) {
        window.setTimeout(() => setFocus(firstInvalidField), 0);
      }
    } else if (firstInvalidField) {
      setFocus(firstInvalidField);
    }
  };

  if (missingId) {
    return <ErrorState message={dictionary.admin.clients.notFound} />;
  }

  if (loading) return <LoadingState />;

  const stepLabels = [
    dictionary.admin.clients.generalSettings,
    dictionary.admin.clients.capabilityConfig,
    dictionary.admin.clients.loginSettings,
  ];
  const nextLabel = dictionary.admin.clients.next;
  const backLabel = dictionary.admin.clients.back;

  return (
    <Form
      className={mode === "create" ? "admin-create-form" : undefined}
      onSubmit={handleSubmit(submit, handleInvalid)}
    >
      {error && (
        <Alert variant="danger">{errorMessage ?? dictionary.admin.clients.saveError}</Alert>
      )}

      {mode === "create" && (
        <div className="admin-stepper mb-4" aria-label={dictionary.admin.clients.creationSteps}>
          {stepLabels.map((label, index) => (
            <button
              className={`admin-step ${index === step ? "active" : ""} ${index < step ? "complete" : ""}`}
              disabled={!canManageClients}
              key={label}
              onClick={() => index < step && setStep(index)}
              type="button"
            >
              <span className="admin-step-number">{index + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {(mode === "edit" || step === 0) && (
        <Card
          className={`admin-panel-card mb-3${embedded ? " admin-detail-section" : ""}${mode === "create" ? " admin-create-card" : ""}`}
        >
          <Card.Body>
            <h2 className="h5 mb-1">{dictionary.admin.clients.general}</h2>
            <p className="small text-body-secondary mb-4">
              {mode === "create" ? stepLabels[0] : dictionary.admin.clients.editSubtitle}
            </p>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>{dictionary.admin.clients.clientId}</Form.Label>
                <Form.Control
                  disabled={!canManageClients}
                  isInvalid={Boolean(errors.clientId)}
                  {...register("clientId")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.clientId?.message}
                </Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label>{dictionary.admin.clients.clientName}</Form.Label>
                <Form.Control
                  disabled={!canManageClients}
                  isInvalid={Boolean(errors.clientName)}
                  {...register("clientName")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.clientName?.message}
                </Form.Control.Feedback>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {(mode === "edit" || step === 1) && (
        <Card
          className={`admin-panel-card mb-3${embedded ? " admin-detail-section" : ""}${mode === "create" ? " admin-create-card" : ""}`}
        >
          <Card.Body>
            <h2 className="h5 mb-1">{dictionary.admin.clients.capabilities}</h2>
            <p className="small text-body-secondary mb-4">{stepLabels[1]}</p>
            <Row className="g-4">
              <Col lg={6}>
                <Form.Label className="fw-semibold">
                  <HelpItem
                    label={dictionary.admin.clients.authMethods}
                    help={dictionary.admin.clients.authMethodsHelp}
                  />
                </Form.Label>
                <div className="admin-choice-list">
                  {METHODS.map((method) => (
                    <Form.Check
                      key={method}
                      type="checkbox"
                      label={method}
                      checked={clientAuthenticationMethods.includes(method)}
                      disabled={!canManageClients}
                      onChange={() => toggle("clientAuthenticationMethods", method)}
                    />
                  ))}
                </div>
                {errors.clientAuthenticationMethods && (
                  <div className="invalid-feedback d-block">
                    {errors.clientAuthenticationMethods.message}
                  </div>
                )}
              </Col>
              <Col lg={6}>
                <Form.Label className="fw-semibold">{dictionary.admin.clients.grants}</Form.Label>
                <div className="admin-choice-list">
                  {GRANTS.map((grant) => (
                    <Form.Check
                      key={grant}
                      type="checkbox"
                      label={grant}
                      checked={authorizationGrantTypes.includes(grant)}
                      disabled={!canManageClients}
                      onChange={() => toggle("authorizationGrantTypes", grant)}
                    />
                  ))}
                </div>
                {errors.authorizationGrantTypes && (
                  <div className="invalid-feedback d-block">
                    {errors.authorizationGrantTypes.message}
                  </div>
                )}
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div>
                    <div className="fw-semibold">
                      <HelpItem
                        label={dictionary.admin.clients.requirePkce}
                        help={dictionary.admin.clients.requirePkceHelp}
                      />
                    </div>
                    <div className="small text-body-secondary">S256</div>
                  </div>
                  <Form.Check
                    type="switch"
                    checked={requireProofKey}
                    disabled={!canManageClients}
                    onChange={(e) =>
                      setValue("requireProofKey", e.target.checked, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div className="fw-semibold">
                    <HelpItem
                      label={dictionary.admin.clients.requireConsent}
                      help={dictionary.admin.clients.requireConsentHelp}
                    />
                  </div>
                  <Form.Check
                    type="switch"
                    checked={requireAuthorizationConsent}
                    disabled={!canManageClients}
                    onChange={(e) =>
                      setValue("requireAuthorizationConsent", e.target.checked, {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div className="fw-semibold">
                    <HelpItem
                      label={dictionary.admin.clients.requireDpop}
                      help={dictionary.admin.clients.requireDpopHelp}
                    />
                  </div>
                  <Form.Check
                    type="switch"
                    checked={requireDpop}
                    disabled={!canManageClients}
                    onChange={(e) =>
                      setValue("requireDpop", e.target.checked, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div className="fw-semibold">
                    <HelpItem
                      label={dictionary.admin.clients.requireDpopJkt}
                      help={dictionary.admin.clients.requireDpopJktHelp}
                    />
                  </div>
                  <Form.Check
                    type="switch"
                    checked={requireDpopJkt}
                    disabled={!canManageClients}
                    onChange={(e) =>
                      setValue("requireDpopJkt", e.target.checked, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div className="fw-semibold">
                    <HelpItem
                      label={dictionary.admin.clients.dpopRefreshTokenOnly}
                      help={dictionary.admin.clients.dpopRefreshTokenOnlyHelp}
                    />
                  </div>
                  <Form.Check
                    type="switch"
                    checked={dpopRefreshTokenOnly}
                    disabled={!canManageClients}
                    onChange={(e) =>
                      setValue("dpopRefreshTokenOnly", e.target.checked, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="admin-setting-row">
                  <div className="fw-semibold">{dictionary.admin.clients.dpopAlgorithms}</div>
                  <div className="d-flex gap-3">
                    {DPOP_ALGORITHMS.map((algorithm) => (
                      <Form.Check
                        checked={dpopSigningAlgorithms.includes(algorithm)}
                        disabled={!canManageClients}
                        key={algorithm}
                        label={algorithm}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...dpopSigningAlgorithms, algorithm]
                            : dpopSigningAlgorithms.filter((value) => value !== algorithm);
                          setValue("dpopSigningAlgorithms", next, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        type="checkbox"
                      />
                    ))}
                  </div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {(mode === "edit" || step === 2) && (
        <Card
          className={`admin-panel-card mb-3${embedded ? " admin-detail-section" : ""}${mode === "create" ? " admin-create-card" : ""}`}
        >
          <Card.Body>
            <h2 className="h5 mb-1">{stepLabels[2]}</h2>
            <p className="small text-body-secondary mb-4">
              {dictionary.admin.clients.redirectUris}
            </p>
            <Row className="g-3">
              <Col lg={6}>
                <Form.Label>
                  <HelpItem
                    label={dictionary.admin.clients.redirectUris}
                    help={dictionary.admin.clients.redirectUrisHelp}
                  />
                </Form.Label>
                <Form.Control
                  as="textarea"
                  disabled={!canManageClients}
                  rows={4}
                  placeholder={dictionary.admin.clients.redirectUrisPlaceholder}
                  isInvalid={Boolean(errors.redirectUris)}
                  {...register("redirectUris")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.redirectUris?.message}
                </Form.Control.Feedback>
              </Col>
              <Col lg={6}>
                <Form.Label>{dictionary.admin.clients.postLogoutUris}</Form.Label>
                <Form.Control
                  as="textarea"
                  disabled={!canManageClients}
                  rows={4}
                  isInvalid={Boolean(errors.postLogoutRedirectUris)}
                  {...register("postLogoutRedirectUris")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.postLogoutRedirectUris?.message}
                </Form.Control.Feedback>
              </Col>
              {mode === "create" && (
                <Col xs={12}>
                  <Form.Label>{dictionary.admin.clients.scopes}</Form.Label>
                  <div className="client-scope-create-grid">
                    {scopeCatalog.map((scope) => (
                      <label className="client-scope-create-option" key={scope.id}>
                        <Form.Check
                          type="checkbox"
                          checked={words(selectedScopes).includes(scope.name)}
                          disabled={!canManageClients}
                          onChange={() => toggleScope(scope.name)}
                        />
                        <span>
                          <strong className="font-monospace">{scope.name}</strong>
                          {scope.displayName && (
                            <span className="text-body-secondary ms-2">{scope.displayName}</span>
                          )}
                          {scope.description && (
                            <span className="d-block small text-body-secondary mt-1">
                              {scope.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <input type="hidden" {...register("scopes")} />
                  {errors.scopes && (
                    <div className="invalid-feedback d-block">{errors.scopes.message}</div>
                  )}
                </Col>
              )}
            </Row>
          </Card.Body>
        </Card>
      )}

      <div
        className={`admin-create-actions${mode === "create" ? " admin-create-wizard-actions" : ""}`}
      >
        <Button
          variant="secondary"
          type="button"
          onClick={() =>
            mode === "create" && step > 0
              ? setStep(step - 1)
              : router.push(
                  embedded && id
                    ? `/admin/clients/${encodeURIComponent(id)}/settings`
                    : `/admin/clients`,
                )
          }
        >
          <AdminActionIcon action={mode === "create" && step > 0 ? "back" : "cancel"} />
          {mode === "create" && step > 0 ? backLabel : dictionary.admin.common.cancel}
        </Button>
        {mode === "create" && step < 2 ? (
          <Button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setStep((current) => current + 1);
            }}
          >
            <AdminActionIcon action="next" />
            {nextLabel}
          </Button>
        ) : (
          <Button type="submit" disabled={!canManageClients || saving}>
            {saving ? (
              <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
            ) : (
              <AdminActionIcon action="save" />
            )}
            {dictionary.admin.common.save}
          </Button>
        )}
      </div>

      <ResultModal
        closeLabel={dictionary.admin.common.close}
        message={dictionary.admin.clients.secretHelp}
        onClose={() => {
          if (createdClientId) {
            router.push(`/admin/clients/${encodeURIComponent(createdClientId)}/settings`);
          }
        }}
        show={createdSecret !== null}
        title={dictionary.admin.clients.secretTitle}
        value={createdSecret}
      />
    </Form>
  );
}
