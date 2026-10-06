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
type SamlBinding = "POST" | "REDIRECT";

const pemFields = new Set<keyof IdentityProviderFormData>([
  "samlIdpCertificate",
  "samlSigningPrivateKey",
  "samlSigningCertificate",
  "samlDecryptionPrivateKey",
  "samlDecryptionCertificate",
]);

const optionalAbsoluteUri = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      try {
        const uri = new URL(value);
        return !uri.hash;
      } catch {
        return false;
      }
    }, message);

const optionalPem = (label: string, message: string) =>
  z.string().refine((value) => {
    if (!value.trim()) return true;
    const pem = value.trim();
    return (
      pem.startsWith(`-----BEGIN ${label}-----`) &&
      pem.endsWith(`-----END ${label}-----`) &&
      pem.includes("\n")
    );
  }, message);

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
  samlMetadataUri: string;
  samlAssertingPartyEntityId: string;
  samlSingleSignOnServiceUrl: string;
  samlSingleLogoutServiceUrl: string;
  samlIdpCertificate: string;
  samlSigningPrivateKey: string;
  samlSigningCertificate: string;
  samlServiceProviderEntityId: string;
  samlSignAuthnRequests: boolean;
  samlWantAssertionsSigned: boolean;
  samlNameIdFormat: string;
  samlPrincipalAttribute: string;
  samlEmailAttribute: string;
  samlFirstNameAttribute: string;
  samlLastNameAttribute: string;
  samlGroupsAttribute: string;
  samlDecryptionPrivateKey: string;
  samlDecryptionCertificate: string;
  samlSignatureAlgorithm: string;
  samlAuthnRequestBinding: SamlBinding;
  samlResponseBinding: SamlBinding;
  samlLogoutBinding: SamlBinding;
  samlForceAuthentication: boolean;
  samlPassSubject: boolean;
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
      z
        .object({
          registrationId: z
            .string()
            .trim()
            .min(1, dictionary.admin.common.validation.required)
            .max(50),
          providerType: z.string().trim().min(1),
          displayName: z
            .string()
            .trim()
            .min(1, dictionary.admin.common.validation.required)
            .max(100),
          alias: z
            .string()
            .trim()
            .regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, copy.aliasInvalid),
          iconKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
          shortStateParameter: z.boolean(),
          caseSensitiveUsername: z.boolean(),
          enabled: z.boolean(),
          clientId: z.string().trim(),
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
          samlMetadataUri: optionalAbsoluteUri(copy.uriInvalid),
          samlAssertingPartyEntityId: optionalAbsoluteUri(copy.uriInvalid),
          samlSingleSignOnServiceUrl: optionalAbsoluteUri(copy.uriInvalid),
          samlSingleLogoutServiceUrl: optionalAbsoluteUri(copy.uriInvalid),
          samlIdpCertificate: optionalPem("CERTIFICATE", copy.pemInvalid),
          samlSigningPrivateKey: optionalPem("PRIVATE KEY", copy.pemInvalid),
          samlSigningCertificate: optionalPem("CERTIFICATE", copy.pemInvalid),
          samlServiceProviderEntityId: optionalAbsoluteUri(copy.uriInvalid),
          samlSignAuthnRequests: z.boolean(),
          samlWantAssertionsSigned: z.boolean(),
          samlNameIdFormat: z.string(),
          samlPrincipalAttribute: z.string(),
          samlEmailAttribute: z.string(),
          samlFirstNameAttribute: z.string(),
          samlLastNameAttribute: z.string(),
          samlGroupsAttribute: z.string(),
          samlDecryptionPrivateKey: optionalPem("PRIVATE KEY", copy.pemInvalid),
          samlDecryptionCertificate: optionalPem("CERTIFICATE", copy.pemInvalid),
          samlSignatureAlgorithm: optionalAbsoluteUri(copy.uriInvalid),
          samlAuthnRequestBinding: z.enum(["POST", "REDIRECT"]),
          samlResponseBinding: z.enum(["POST", "REDIRECT"]),
          samlLogoutBinding: z.enum(["POST", "REDIRECT"]),
          samlForceAuthentication: z.boolean(),
          samlPassSubject: z.boolean(),
        })
        .superRefine((data, context) => {
          if (data.providerType !== "saml" && !data.clientId) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["clientId"],
              message: dictionary.admin.common.validation.required,
            });
          }
          if (
            data.providerType === "saml" &&
            !data.samlMetadataUri &&
            !(
              data.samlAssertingPartyEntityId &&
              data.samlSingleSignOnServiceUrl &&
              data.samlIdpCertificate
            )
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["samlMetadataUri"],
              message: copy.samlConfigurationRequired,
            });
          }
        }),
    [
      copy.aliasInvalid,
      copy.pemInvalid,
      copy.samlConfigurationRequired,
      copy.uriInvalid,
      dictionary.admin.common.validation.required,
    ],
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
      samlMetadataUri: "",
      samlAssertingPartyEntityId: "",
      samlSingleSignOnServiceUrl: "",
      samlSingleLogoutServiceUrl: "",
      samlIdpCertificate: "",
      samlSigningPrivateKey: "",
      samlSigningCertificate: "",
      samlServiceProviderEntityId: "",
      samlSignAuthnRequests: false,
      samlWantAssertionsSigned: true,
      samlNameIdFormat: "",
      samlPrincipalAttribute: "NameID",
      samlEmailAttribute: "email",
      samlFirstNameAttribute: "givenName",
      samlLastNameAttribute: "sn",
      samlGroupsAttribute: "groups",
      samlDecryptionPrivateKey: "",
      samlDecryptionCertificate: "",
      samlSignatureAlgorithm: "",
      samlAuthnRequestBinding: "REDIRECT",
      samlResponseBinding: "POST",
      samlLogoutBinding: "REDIRECT",
      samlForceAuthentication: false,
      samlPassSubject: false,
      ...initial,
    }),
    [initial],
  );
  const {
    register,
    watch,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IdentityProviderFormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: defaults,
  });
  const providerType = watch("providerType");
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
  const field = (name: keyof IdentityProviderFormData, label: string, type = "text") => {
    const multiline = pemFields.has(name);
    return (
      <Form.Group className="mb-3" controlId={`provider-${name}`}>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          {...(multiline ? { as: "textarea", rows: 6 } : { type })}
          isInvalid={Boolean(errors[name])}
          {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
        />
        <Form.Control.Feedback type="invalid">{errors[name]?.message}</Form.Control.Feedback>
      </Form.Group>
    );
  };
  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <Form noValidate onSubmit={handleSubmit(submit)}>
          <Row>
            <Col md={6}>
              {field("displayName", copy.name)}
              {field("registrationId", copy.registrationId)}
              {field("alias", copy.alias)}
              <Form.Group className="mb-3" controlId="provider-type">
                <Form.Label>{copy.type}</Form.Label>
                <Form.Select isInvalid={Boolean(errors.providerType)} {...register("providerType")}>
                  <option value="oidc">{copy.typeOidc}</option>
                  <option value="saml">{copy.typeSaml}</option>
                  <option value="google">{copy.typeGoogle}</option>
                  <option value="github">{copy.typeGithub}</option>
                  <option value="linkedin">{copy.typeLinkedin}</option>
                  <option value="microsoft">{copy.typeMicrosoft}</option>
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.providerType?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3" controlId="provider-icon-key">
                <Form.Label>{copy.icon}</Form.Label>
                <Form.Select {...register("iconKey")}>
                  <option value="generic">{copy.iconGeneric}</option>
                  <option value="google">{copy.typeGoogle}</option>
                  <option value="github">{copy.typeGithub}</option>
                  <option value="linkedin">{copy.typeLinkedin}</option>
                  <option value="microsoft">{copy.typeMicrosoft}</option>
                  <option value="building">{copy.iconBuilding}</option>
                  <option value="key">{copy.iconKey}</option>
                  <option value="shield">{copy.iconShield}</option>
                </Form.Select>
              </Form.Group>
              {providerType !== "saml" && field("clientId", copy.clientId)}
              {providerType !== "saml" && field("clientSecret", copy.clientSecret, "password")}
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
              {providerType !== "saml" ? (
                <>
                  {field("authorizationUri", copy.authorizationUri)}
                  {field("tokenUri", copy.tokenUri)}
                  {field("userInfoUri", copy.userInfoUri)}
                  {field("jwkSetUri", copy.jwkSetUri)}
                  {field("issuerUri", copy.issuerUri)}
                  {field("scopes", copy.scopes)}
                  {field("userNameAttribute", copy.userNameAttribute)}
                </>
              ) : (
                <>
                  {field("samlMetadataUri", copy.samlMetadataUri)}
                  {field("samlAssertingPartyEntityId", copy.samlAssertingPartyEntityId)}
                  {field("samlSingleSignOnServiceUrl", copy.samlSingleSignOnServiceUrl)}
                  {field("samlSingleLogoutServiceUrl", copy.samlSingleLogoutServiceUrl)}
                  {field("samlServiceProviderEntityId", copy.serviceProviderEntityId)}
                  {field("samlNameIdFormat", copy.samlNameIdFormat)}
                </>
              )}
            </Col>
          </Row>
          {providerType === "saml" && (
            <Row>
              <Col md={6}>
                {field("samlIdpCertificate", copy.samlIdpCertificate)}
                {field("samlSigningPrivateKey", copy.samlSigningPrivateKey, "password")}
                {field("samlSigningCertificate", copy.samlSigningCertificate)}
                {field("samlDecryptionPrivateKey", copy.samlDecryptionPrivateKey, "password")}
                {field("samlDecryptionCertificate", copy.samlDecryptionCertificate)}
              </Col>
              <Col md={6}>
                {field("samlPrincipalAttribute", copy.samlPrincipalAttribute)}
                {field("samlEmailAttribute", copy.samlEmailAttribute)}
                {field("samlFirstNameAttribute", copy.samlFirstNameAttribute)}
                {field("samlLastNameAttribute", copy.samlLastNameAttribute)}
                {field("samlGroupsAttribute", copy.samlGroupsAttribute)}
                {field("samlSignatureAlgorithm", copy.samlSignatureAlgorithm)}
                <Form.Group className="mb-3" controlId="provider-saml-authn-binding">
                  <Form.Label>{copy.samlAuthnRequestBinding}</Form.Label>
                  <Form.Select {...register("samlAuthnRequestBinding")}>
                    <option value="REDIRECT">REDIRECT</option>
                    <option value="POST">POST</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" controlId="provider-saml-response-binding">
                  <Form.Label>{copy.samlResponseBinding}</Form.Label>
                  <Form.Select {...register("samlResponseBinding")}>
                    <option value="POST">POST</option>
                    <option value="REDIRECT">REDIRECT</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" controlId="provider-saml-logout-binding">
                  <Form.Label>{copy.samlLogoutBinding}</Form.Label>
                  <Form.Select {...register("samlLogoutBinding")}>
                    <option value="REDIRECT">REDIRECT</option>
                    <option value="POST">POST</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          )}
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
            {providerType === "saml" && (
              <>
                <Form.Check
                  type="checkbox"
                  label={copy.samlSignAuthnRequests}
                  {...register("samlSignAuthnRequests")}
                />
                <Form.Check
                  type="checkbox"
                  label={copy.samlWantAssertionsSigned}
                  {...register("samlWantAssertionsSigned")}
                />
                <Form.Check
                  type="checkbox"
                  label={copy.samlForceAuthentication}
                  {...register("samlForceAuthentication")}
                />
                <Form.Check
                  type="checkbox"
                  label={copy.samlPassSubject}
                  {...register("samlPassSubject")}
                />
              </>
            )}
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
