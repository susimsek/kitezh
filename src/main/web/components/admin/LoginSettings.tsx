"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "@/lib/form";
import type { FieldErrors, Path, UseFormRegister, UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";

import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { DetailTabs } from "./DetailTabs";
import { ViewHeader } from "./ViewHeader";

type Settings = {
  userRegistration: boolean;
  forgotPassword: boolean;
  passwordResetOtpMode: "none" | "if-configured" | "required";
  passwordResetTokenLifespanSeconds: number;
  passwordResetResendCooldownSeconds: number;
  rememberMe: boolean;
  passkeys: boolean;
  loginWithEmail: boolean;
  verifyEmail: boolean;
  webauthnMediation: "none" | "optional" | "conditional";
  webauthnPolicy: WebAuthnPolicy;
  webauthnPasswordlessPolicy: WebAuthnPolicy;
  emailUpdateReauthenticationMinutes: number;
  googleLoginEnabled: boolean;
  githubLoginEnabled: boolean;
  linkedinLoginEnabled: boolean;
  microsoftLoginEnabled: boolean;
  sessionTimeoutMinutes: number;
  passwordMinimumLength: number;
  bruteForceEnabled: boolean;
  bruteForceMaxFailures: number;
  bruteForceMaxSecondaryFailures: number;
  mfaVerificationTimeoutSeconds: number;
  passwordMaximumLength: number;
  passwordMinimumUppercase: number;
  passwordMinimumLowercase: number;
  passwordMinimumDigits: number;
  passwordMinimumSpecialCharacters: number;
  passwordRejectUsername: boolean;
  passwordRejectEmail: boolean;
  passwordRejectCommonPasswords: boolean;
  passwordHistorySize: number;
  passwordExpirationDays: number;
  passwordCommonPasswords: string;
  bruteForceQuickLoginWindowMillis: number;
  bruteForceMinimumQuickLoginWaitSeconds: number;
  bruteForceWaitIncrementSeconds: number;
  bruteForceMaxWaitSeconds: number;
  bruteForceFailureResetTimeSeconds: number;
  bruteForceMaxTemporaryLockouts: number;
  bruteForcePermanentLockout: boolean;
  bruteForceIpRequestsPerMinute: number;
  bruteForceUsernameIpRequestsPerMinute: number;
  otpEnabled: boolean;
  otpRequired: boolean;
  otpIssuer: string;
  otpAlgorithm: "SHA1" | "SHA256" | "SHA512";
  otpDigits: number;
  otpPeriodSeconds: number;
  otpLookAheadWindow: number;
  otpCodeReusable: boolean;
  otpAddRecoveryCodes: boolean;
  recoveryCodeWarningThreshold: number;
};

type LoginSettingsResponse = Partial<
  Omit<Settings, "webauthnPolicy" | "webauthnPasswordlessPolicy">
> & {
  webauthnPolicy?: Partial<WebAuthnPolicy> | null;
  webauthnPasswordlessPolicy?: Partial<WebAuthnPolicy> | null;
};

type CaptchaSettings = {
  enabled: boolean;
  provider: "recaptcha" | "enterprise";
  siteKey: string;
  projectId: string;
  action: string;
  recaptchaV3: boolean;
  scoreThreshold: number;
  useRecaptchaNet: boolean;
  secretConfigured: boolean;
  apiKeyConfigured: boolean;
  secretKey: string;
  apiKey: string;
  loginEnabled: boolean;
  loginAction: string;
  loginRecaptchaV3: boolean;
  loginScoreThreshold: number;
};

type WebAuthnPolicy = {
  rpName: string;
  rpId: string;
  signatureAlgorithms: string;
  attestation: "none" | "indirect" | "direct" | "enterprise";
  authenticatorAttachment: "any" | "platform" | "cross-platform";
  residentKey: "discouraged" | "preferred" | "required";
  userVerification: "discouraged" | "preferred" | "required";
  timeoutSeconds: number;
  avoidSameAuthenticator: boolean;
  acceptableAaguids: string;
};

const defaultWebAuthnPolicy: WebAuthnPolicy = {
  rpName: "Kitezh",
  rpId: "",
  signatureAlgorithms: "ES256,RS256,EdDSA",
  attestation: "none",
  authenticatorAttachment: "any",
  residentKey: "preferred",
  userVerification: "preferred",
  timeoutSeconds: 300,
  avoidSameAuthenticator: true,
  acceptableAaguids: "",
};

const defaultPasswordlessWebAuthnPolicy: WebAuthnPolicy = {
  ...defaultWebAuthnPolicy,
  residentKey: "required",
  userVerification: "required",
};

const defaultSettings: Settings = {
  userRegistration: true,
  forgotPassword: true,
  passwordResetOtpMode: "none",
  passwordResetTokenLifespanSeconds: 43200,
  passwordResetResendCooldownSeconds: 30,
  rememberMe: true,
  passkeys: false,
  loginWithEmail: false,
  verifyEmail: false,
  webauthnMediation: "none",
  webauthnPolicy: defaultWebAuthnPolicy,
  webauthnPasswordlessPolicy: defaultPasswordlessWebAuthnPolicy,
  emailUpdateReauthenticationMinutes: 5,
  sessionTimeoutMinutes: 30,
  passwordMinimumLength: 12,
  bruteForceEnabled: true,
  bruteForceMaxFailures: 5,
  bruteForceMaxSecondaryFailures: 0,
  mfaVerificationTimeoutSeconds: 300,
  passwordMaximumLength: 128,
  passwordMinimumUppercase: 1,
  passwordMinimumLowercase: 1,
  passwordMinimumDigits: 1,
  passwordMinimumSpecialCharacters: 1,
  passwordRejectUsername: true,
  passwordRejectEmail: true,
  passwordRejectCommonPasswords: true,
  passwordHistorySize: 5,
  passwordExpirationDays: 90,
  passwordCommonPasswords: "password,123456,12345678,qwerty,qwerty123,admin,letmein",
  bruteForceQuickLoginWindowMillis: 1000,
  bruteForceMinimumQuickLoginWaitSeconds: 60,
  bruteForceWaitIncrementSeconds: 60,
  bruteForceMaxWaitSeconds: 900,
  bruteForceFailureResetTimeSeconds: 43200,
  bruteForceMaxTemporaryLockouts: 3,
  bruteForcePermanentLockout: false,
  bruteForceIpRequestsPerMinute: 30,
  bruteForceUsernameIpRequestsPerMinute: 5,
  otpEnabled: false,
  otpRequired: false,
  otpIssuer: "Kitezh",
  otpAlgorithm: "SHA1",
  otpDigits: 6,
  otpPeriodSeconds: 30,
  otpLookAheadWindow: 1,
  otpCodeReusable: false,
  otpAddRecoveryCodes: false,
  recoveryCodeWarningThreshold: 2,
  googleLoginEnabled: true,
  githubLoginEnabled: true,
  linkedinLoginEnabled: true,
  microsoftLoginEnabled: false,
};

const defaultCaptchaSettings: CaptchaSettings = {
  enabled: false,
  provider: "recaptcha",
  siteKey: "",
  projectId: "",
  action: "register",
  recaptchaV3: false,
  scoreThreshold: 0.7,
  useRecaptchaNet: false,
  secretConfigured: false,
  apiKeyConfigured: false,
  secretKey: "",
  apiKey: "",
  loginEnabled: false,
  loginAction: "login",
  loginRecaptchaV3: false,
  loginScoreThreshold: 0.7,
};

type SocialProviderSetting = {
  provider: string;
  alias: string;
  hideOnLogin: boolean;
  accountLinkingOnly: boolean;
  trustEmail: boolean;
  mfaRequired: boolean;
  requiredClaims: string;
  storeTokens: boolean;
  storedTokensReadable: boolean;
  guiOrder: number;
  showInAccountConsole: "always" | "when-linked" | "never";
  clientId: string;
  clientSecretConfigured: boolean;
  clientSecret: string;
};

type SocialProviderFormValues = {
  providers: SocialProviderSetting[];
};

export type LoginSettingsSection =
  | "login"
  | "social-login"
  | "webauthn"
  | "password-policy"
  | "otp-policy"
  | "brute-force"
  | "sessions";

export default function LoginSettingsPage({
  embedded = false,
  focusSection,
}: {
  embedded?: boolean;
  focusSection?: LoginSettingsSection;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.admin.loginSettings;
  const validation = dictionary.admin.common.validation;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [socialProvidersLoaded, setSocialProvidersLoaded] = useState(false);
  const [socialProviderTab, setSocialProviderTab] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaSettings>(defaultCaptchaSettings);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const webAuthnPolicySchema = () =>
    z.object({
      rpName: z.string().trim().min(1, validation.required).max(255),
      rpId: z.string().trim().max(253),
      signatureAlgorithms: z.string().trim().min(1, validation.required).max(255),
      attestation: z.enum(["none", "indirect", "direct", "enterprise"]),
      authenticatorAttachment: z.enum(["any", "platform", "cross-platform"]),
      residentKey: z.enum(["discouraged", "preferred", "required"]),
      userVerification: z.enum(["discouraged", "preferred", "required"]),
      timeoutSeconds: z.number().int().min(1, validation.positiveNumber).max(86400),
      avoidSameAuthenticator: z.boolean(),
      acceptableAaguids: z.string().max(4000),
    });
  const schema = z.object({
    userRegistration: z.boolean(),
    forgotPassword: z.boolean(),
    passwordResetOtpMode: z.enum(["none", "if-configured", "required"]),
    passwordResetTokenLifespanSeconds: z
      .number()
      .int()
      .min(60, validation.positiveNumber)
      .max(86400, validation.maximumNumber),
    passwordResetResendCooldownSeconds: z
      .number()
      .int()
      .min(0, validation.positiveNumber)
      .max(86400, validation.maximumNumber),
    rememberMe: z.boolean(),
    passkeys: z.boolean(),
    loginWithEmail: z.boolean(),
    verifyEmail: z.boolean(),
    webauthnMediation: z.enum(["none", "optional", "conditional"]),
    webauthnPolicy: webAuthnPolicySchema(),
    webauthnPasswordlessPolicy: webAuthnPolicySchema(),
    emailUpdateReauthenticationMinutes: z
      .number()
      .int()
      .min(0, validation.positiveNumber)
      .max(1440, validation.maximumNumber),
    googleLoginEnabled: z.boolean(),
    githubLoginEnabled: z.boolean(),
    linkedinLoginEnabled: z.boolean(),
    microsoftLoginEnabled: z.boolean(),
    sessionTimeoutMinutes: z.number().int().min(1, validation.positiveNumber),
    passwordMinimumLength: z.number().int().min(8, validation.minimumPasswordLength),
    bruteForceEnabled: z.boolean(),
    bruteForceMaxFailures: z.number().int().min(1, validation.positiveNumber),
    bruteForceMaxSecondaryFailures: z.number().int().min(0, validation.positiveNumber),
    mfaVerificationTimeoutSeconds: z.number().int().min(1, validation.positiveNumber),
    passwordMaximumLength: z.number().int().min(8, validation.maximumPasswordLength),
    passwordMinimumUppercase: z.number().int().min(0, validation.positiveNumber),
    passwordMinimumLowercase: z.number().int().min(0, validation.positiveNumber),
    passwordMinimumDigits: z.number().int().min(0, validation.positiveNumber),
    passwordMinimumSpecialCharacters: z.number().int().min(0, validation.positiveNumber),
    passwordRejectUsername: z.boolean(),
    passwordRejectEmail: z.boolean(),
    passwordRejectCommonPasswords: z.boolean(),
    passwordHistorySize: z.number().int().min(0, validation.positiveNumber),
    passwordExpirationDays: z.number().int().min(0, validation.positiveNumber),
    passwordCommonPasswords: z.string().trim().min(1, validation.required).max(4000),
    bruteForceQuickLoginWindowMillis: z.number().int().min(0, validation.positiveNumber),
    bruteForceMinimumQuickLoginWaitSeconds: z.number().int().min(0, validation.positiveNumber),
    bruteForceWaitIncrementSeconds: z.number().int().min(0, validation.positiveNumber),
    bruteForceMaxWaitSeconds: z.number().int().min(0, validation.positiveNumber),
    bruteForceFailureResetTimeSeconds: z.number().int().min(0, validation.positiveNumber),
    bruteForceMaxTemporaryLockouts: z.number().int().min(0, validation.positiveNumber),
    bruteForcePermanentLockout: z.boolean(),
    bruteForceIpRequestsPerMinute: z.number().int().min(1, validation.positiveNumber),
    bruteForceUsernameIpRequestsPerMinute: z.number().int().min(1, validation.positiveNumber),
    otpEnabled: z.boolean(),
    otpRequired: z.boolean(),
    otpIssuer: z.string().trim().min(1, validation.required).max(100),
    otpAlgorithm: z.enum(["SHA1", "SHA256", "SHA512"]),
    otpDigits: z
      .number()
      .int()
      .refine((value) => value === 6 || value === 8, validation.positiveNumber),
    otpPeriodSeconds: z.number().int().min(15, validation.positiveNumber),
    otpLookAheadWindow: z.number().int().min(0, validation.positiveNumber),
    otpCodeReusable: z.boolean(),
    otpAddRecoveryCodes: z.boolean(),
    recoveryCodeWarningThreshold: z.number().int().min(0, validation.positiveNumber),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Settings>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: defaultSettings,
  });
  const socialProviderSchema = z.object({
    providers: z.array(
      z.object({
        provider: z.string().min(1),
        alias: z.string().trim().min(1, validation.required).max(50),
        hideOnLogin: z.boolean(),
        accountLinkingOnly: z.boolean(),
        trustEmail: z.boolean(),
        mfaRequired: z.boolean(),
        requiredClaims: z.string().trim().min(1, validation.required).max(500),
        storeTokens: z.boolean(),
        storedTokensReadable: z.boolean(),
        guiOrder: z.number().int().min(0, validation.positiveNumber),
        showInAccountConsole: z.enum(["always", "when-linked", "never"]),
        clientId: z.string().trim().max(500),
        clientSecretConfigured: z.boolean(),
        clientSecret: z.string().max(2000),
      }),
    ),
  });
  const {
    register: registerSocial,
    reset: resetSocial,
    handleSubmit: handleSocialSubmit,
    watch: watchSocial,
    formState: { errors: socialErrors, isSubmitting: socialProvidersSubmitting },
  } = useForm<SocialProviderFormValues>({
    resolver: zodResolver(socialProviderSchema),
    mode: "onChange",
    defaultValues: { providers: [] },
  });
  const socialProviders = watchSocial("providers");

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<LoginSettingsResponse>(accessToken, { url: "/api/admin/settings/login" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset(normalizeSettings(response.data));
        setLoaded(true);
      })
      .catch(() => setError(true));
  }, [accessToken, reset]);

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<Omit<CaptchaSettings, "secretKey" | "apiKey">>(accessToken, {
      url: "/api/admin/settings/registration-captcha",
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setCaptcha({ ...defaultCaptchaSettings, ...response.data });
        setCaptchaLoaded(true);
      })
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<Array<Omit<SocialProviderSetting, "clientSecret">>>(accessToken, {
      url: "/api/admin/settings/social-providers",
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        resetSocial({
          providers: response.data.map((provider) => ({
            ...provider,
            clientId: provider.clientId ?? "",
            trustEmail: provider.trustEmail ?? false,
            mfaRequired: provider.mfaRequired ?? false,
            requiredClaims: provider.requiredClaims ?? "sub",
            clientSecret: "",
          })),
        });
        setSocialProvidersLoaded(true);
      })
      .catch(() => setError(true));
  }, [accessToken, resetSocial]);

  useEffect(() => {
    if (!loaded || !focusSection) return;
    const element = document.getElementById(`login-settings-${focusSection}`);
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "start" });
    }
  }, [focusSection, loaded]);

  const activeSection = focusSection ?? "login";
  const activeSocialProvider =
    socialProviders.find((provider) => provider.provider === socialProviderTab)?.provider ??
    socialProviders[0]?.provider ??
    "";
  const webAuthnLabels = {
    rpName: copy.webauthnRpName,
    rpId: copy.webauthnRpId,
    signatureAlgorithms: copy.webauthnSignatureAlgorithms,
    attestation: copy.webauthnAttestation,
    attestationNone: copy.webauthnAttestationNone,
    attestationIndirect: copy.webauthnAttestationIndirect,
    attestationDirect: copy.webauthnAttestationDirect,
    attestationEnterprise: copy.webauthnAttestationEnterprise,
    authenticatorAttachment: copy.webauthnAuthenticatorAttachment,
    authenticatorAny: copy.webauthnAuthenticatorAny,
    authenticatorPlatform: copy.webauthnAuthenticatorPlatform,
    authenticatorCrossPlatform: copy.webauthnAuthenticatorCrossPlatform,
    residentKey: copy.webauthnResidentKey,
    residentDiscouraged: copy.webauthnResidentDiscouraged,
    residentPreferred: copy.webauthnResidentPreferred,
    residentRequired: copy.webauthnResidentRequired,
    userVerification: copy.webauthnUserVerification,
    userVerificationDiscouraged: copy.webauthnUserVerificationDiscouraged,
    userVerificationPreferred: copy.webauthnUserVerificationPreferred,
    userVerificationRequired: copy.webauthnUserVerificationRequired,
    timeoutSeconds: copy.webauthnTimeoutSeconds,
    avoidSameAuthenticator: copy.webauthnAvoidSameAuthenticator,
    acceptableAaguids: copy.webauthnAcceptableAaguids,
    rpIdHelp: copy.webauthnRpIdHelp,
    signatureAlgorithmsHelp: copy.webauthnSignatureAlgorithmsHelp,
    acceptableAaguidsHelp: copy.webauthnAcceptableAaguidsHelp,
  };

  const submit = handleSubmit(async (values) => {
    if (!accessToken) return;
    setError(false);
    try {
      const response = await adminRequest<Settings>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/login",
        data: values,
      });
      if (response.status >= 300) throw new Error();
      reset({ ...defaultSettings, ...response.data });
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
    }
  });

  const saveSocialProviders = handleSocialSubmit(async ({ providers }) => {
    if (!accessToken) return;
    setError(false);
    try {
      const response = await adminRequest<Array<Omit<SocialProviderSetting, "clientSecret">>>(
        accessToken,
        {
          method: "PUT",
          url: "/api/admin/settings/social-providers",
          data: {
            providers: providers.map(
              ({
                provider,
                alias,
                hideOnLogin,
                accountLinkingOnly,
                trustEmail,
                mfaRequired,
                requiredClaims,
                storeTokens,
                storedTokensReadable,
                guiOrder,
                showInAccountConsole,
                clientId,
                clientSecret,
              }) => ({
                provider,
                alias,
                hideOnLogin,
                accountLinkingOnly,
                trustEmail,
                mfaRequired,
                requiredClaims,
                storeTokens,
                storedTokensReadable,
                guiOrder,
                showInAccountConsole,
                clientId,
                clientSecret,
              }),
            ),
          },
        },
      );
      if (response.status >= 300) throw new Error();
      resetSocial({
        providers: response.data.map((provider) => ({
          ...provider,
          trustEmail: provider.trustEmail ?? false,
          mfaRequired: provider.mfaRequired ?? false,
          requiredClaims: provider.requiredClaims ?? "sub",
          clientSecret: "",
        })),
      });
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
      setError(true);
    }
  });

  const saveCaptcha = async () => {
    if (!accessToken) return;
    setError(false);
    setCaptchaSubmitting(true);
    try {
      const response = await adminRequest<Omit<CaptchaSettings, "secretKey" | "apiKey">>(
        accessToken,
        {
          method: "PUT",
          url: "/api/admin/settings/registration-captcha",
          data: {
            enabled: captcha.enabled,
            provider: captcha.provider,
            siteKey: captcha.siteKey,
            secretKey: captcha.secretKey,
            projectId: captcha.projectId,
            apiKey: captcha.apiKey,
            action: captcha.action,
            recaptchaV3: captcha.recaptchaV3,
            scoreThreshold: captcha.scoreThreshold,
            useRecaptchaNet: captcha.useRecaptchaNet,
            loginEnabled: captcha.loginEnabled,
            loginAction: captcha.loginAction,
            loginRecaptchaV3: captcha.loginRecaptchaV3,
            loginScoreThreshold: captcha.loginScoreThreshold,
          },
        },
      );
      if (response.status >= 300) throw new Error();
      setCaptcha({ ...defaultCaptchaSettings, ...response.data });
      alerts.addAlert(copy.captchaSaved);
    } catch {
      alerts.addError(copy.captchaError);
    } finally {
      setCaptchaSubmitting(false);
    }
  };

  const providerLabel = (provider: string) => provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="d-grid gap-4">
      {!embedded && <ViewHeader title={copy.title} description={copy.subtitle} />}
      {error && <Alert variant="danger">{copy.error}</Alert>}
      <Card className="admin-panel-card">
        <Card.Body>
          {!loaded ? (
            <div role="status">{copy.loading}</div>
          ) : (
            <Form noValidate onSubmit={submit}>
              <section hidden={activeSection !== "login"}>
                <h2 className="h5 mb-3" id="login-settings-login">
                  {copy.sectionLogin}
                </h2>
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.userRegistration}
                  {...register("userRegistration")}
                />
                {captchaLoaded && (
                  <Card className="admin-panel-card mb-4">
                    <Card.Body>
                      <h3 className="h6">{copy.captchaTitle}</h3>
                      <p className="text-body-secondary small">{copy.captchaHelp}</p>
                      <Form.Check
                        className="mb-3"
                        type="switch"
                        label={copy.captchaEnabled}
                        checked={captcha.enabled}
                        onChange={(event) =>
                          setCaptcha((current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                      />
                      <Form.Check
                        className="mb-3"
                        type="switch"
                        label={copy.captchaLoginEnabled}
                        checked={captcha.loginEnabled}
                        onChange={(event) =>
                          setCaptcha((current) => ({
                            ...current,
                            loginEnabled: event.target.checked,
                          }))
                        }
                      />
                      <div className="d-grid gap-3">
                        <Form.Group controlId="registration-captcha-provider">
                          <Form.Label>{copy.captchaProvider}</Form.Label>
                          <Form.Select
                            value={captcha.provider}
                            onChange={(event) =>
                              setCaptcha((current) => ({
                                ...current,
                                provider: event.target.value as CaptchaSettings["provider"],
                              }))
                            }
                          >
                            <option value="recaptcha">{copy.captchaProviderRecaptcha}</option>
                            <option value="enterprise">{copy.captchaProviderEnterprise}</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group controlId="registration-captcha-site-key">
                          <Form.Label>{copy.captchaSiteKey}</Form.Label>
                          <Form.Control
                            value={captcha.siteKey}
                            onChange={(event) =>
                              setCaptcha((current) => ({
                                ...current,
                                siteKey: event.target.value,
                              }))
                            }
                          />
                        </Form.Group>
                        {captcha.provider === "enterprise" && (
                          <Form.Group controlId="registration-captcha-project-id">
                            <Form.Label>{copy.captchaProjectId}</Form.Label>
                            <Form.Control
                              value={captcha.projectId}
                              onChange={(event) =>
                                setCaptcha((current) => ({
                                  ...current,
                                  projectId: event.target.value,
                                }))
                              }
                            />
                          </Form.Group>
                        )}
                        <Form.Group controlId="registration-captcha-secret">
                          <Form.Label>
                            {captcha.provider === "enterprise"
                              ? copy.captchaApiKey
                              : copy.captchaSecret}
                          </Form.Label>
                          <Form.Control
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                              captcha.provider === "enterprise"
                                ? copy.captchaKeyPlaceholder
                                : copy.captchaSecretPlaceholder
                            }
                            value={
                              captcha.provider === "enterprise" ? captcha.apiKey : captcha.secretKey
                            }
                            onChange={(event) =>
                              setCaptcha((current) =>
                                current.provider === "enterprise"
                                  ? { ...current, apiKey: event.target.value }
                                  : { ...current, secretKey: event.target.value },
                              )
                            }
                          />
                          {(captcha.provider === "enterprise"
                            ? captcha.apiKeyConfigured
                            : captcha.secretConfigured) && (
                            <Form.Text className="text-success">
                              {copy.captchaKeyConfigured}
                            </Form.Text>
                          )}
                        </Form.Group>
                        <Form.Group controlId="registration-captcha-action">
                          <Form.Label>{copy.captchaAction}</Form.Label>
                          <Form.Control
                            value={captcha.action}
                            onChange={(event) =>
                              setCaptcha((current) => ({
                                ...current,
                                action: event.target.value,
                              }))
                            }
                          />
                        </Form.Group>
                        <Form.Group controlId="login-captcha-action">
                          <Form.Label>{copy.captchaLoginAction}</Form.Label>
                          <Form.Control
                            value={captcha.loginAction}
                            onChange={(event) =>
                              setCaptcha((current) => ({
                                ...current,
                                loginAction: event.target.value,
                              }))
                            }
                          />
                        </Form.Group>
                        <Form.Check
                          type="switch"
                          label={copy.captchaV3}
                          checked={captcha.recaptchaV3}
                          onChange={(event) =>
                            setCaptcha((current) => ({
                              ...current,
                              recaptchaV3: event.target.checked,
                            }))
                          }
                        />
                        {captcha.recaptchaV3 && (
                          <Form.Group controlId="registration-captcha-score">
                            <Form.Label>{copy.captchaScoreThreshold}</Form.Label>
                            <Form.Control
                              type="number"
                              min="0"
                              max="1"
                              step="0.05"
                              value={captcha.scoreThreshold}
                              onChange={(event) =>
                                setCaptcha((current) => ({
                                  ...current,
                                  scoreThreshold: Number(event.target.value),
                                }))
                              }
                            />
                          </Form.Group>
                        )}
                        <Form.Check
                          type="switch"
                          label={copy.captchaLoginV3}
                          checked={captcha.loginRecaptchaV3}
                          onChange={(event) =>
                            setCaptcha((current) => ({
                              ...current,
                              loginRecaptchaV3: event.target.checked,
                            }))
                          }
                        />
                        {(captcha.loginRecaptchaV3 || captcha.provider === "enterprise") && (
                          <Form.Group controlId="login-captcha-score">
                            <Form.Label>{copy.captchaLoginScoreThreshold}</Form.Label>
                            <Form.Control
                              type="number"
                              min="0"
                              max="1"
                              step="0.05"
                              value={captcha.loginScoreThreshold}
                              onChange={(event) =>
                                setCaptcha((current) => ({
                                  ...current,
                                  loginScoreThreshold: Number(event.target.value),
                                }))
                              }
                            />
                          </Form.Group>
                        )}
                        <Form.Check
                          type="switch"
                          label={copy.captchaUseRecaptchaNet}
                          checked={captcha.useRecaptchaNet}
                          onChange={(event) =>
                            setCaptcha((current) => ({
                              ...current,
                              useRecaptchaNet: event.target.checked,
                            }))
                          }
                        />
                      </div>
                      <div className="admin-form-actions mt-4">
                        <Button type="button" disabled={captchaSubmitting} onClick={saveCaptcha}>
                          {captchaSubmitting ? (
                            <Spinner
                              animation="border"
                              aria-hidden="true"
                              className="me-2"
                              size="sm"
                            />
                          ) : (
                            <AdminActionIcon action="save" />
                          )}
                          {copy.captchaSave}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                )}
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.forgotPassword}
                  {...register("forgotPassword")}
                />
                <div className="d-grid gap-3 mb-4">
                  <Form.Group controlId="login-password-reset-otp-mode">
                    <Form.Label>{copy.passwordResetOtpMode}</Form.Label>
                    <Form.Select {...register("passwordResetOtpMode")}>
                      <option value="none">{copy.passwordResetOtpNone}</option>
                      <option value="if-configured">{copy.passwordResetOtpIfConfigured}</option>
                      <option value="required">{copy.passwordResetOtpRequired}</option>
                    </Form.Select>
                    <Form.Text>{copy.passwordResetOtpModeHelp}</Form.Text>
                  </Form.Group>
                  <NumberField
                    id="login-password-reset-lifespan"
                    label={copy.passwordResetTokenLifespan}
                    error={errors.passwordResetTokenLifespanSeconds?.message}
                    registration={register("passwordResetTokenLifespanSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-password-reset-cooldown"
                    label={copy.passwordResetResendCooldown}
                    error={errors.passwordResetResendCooldownSeconds?.message}
                    registration={register("passwordResetResendCooldownSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.rememberMe}
                  {...register("rememberMe")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.passkeys}
                  {...register("passkeys")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.loginWithEmail}
                  {...register("loginWithEmail")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.verifyEmail}
                  {...register("verifyEmail")}
                />
                <NumberField
                  id="login-email-reauthentication"
                  label={copy.emailUpdateReauthentication}
                  error={errors.emailUpdateReauthenticationMinutes?.message}
                  registration={register("emailUpdateReauthenticationMinutes", {
                    valueAsNumber: true,
                  })}
                />
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "social-login"}>
                <h2 className="h5 mb-2" id="login-settings-social-login">
                  {copy.sectionSocialLogin}
                </h2>
                <p className="text-body-secondary mb-4">{copy.socialLoginHelp}</p>
                <Form.Check
                  className="mb-4"
                  type="switch"
                  id="login-google-provider"
                  label={copy.googleLogin}
                  {...register("googleLoginEnabled")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  id="login-github-provider"
                  label={copy.githubLogin}
                  {...register("githubLoginEnabled")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  id="login-linkedin-provider"
                  label={copy.linkedinLogin}
                  {...register("linkedinLoginEnabled")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  id="login-microsoft-provider"
                  label={copy.microsoftLogin}
                  {...register("microsoftLoginEnabled")}
                />
                {socialProvidersLoaded && (
                  <>
                    <h3 className="h6 mt-4 mb-2">{copy.socialCredentials}</h3>
                    <p className="text-body-secondary small">{copy.socialCredentialsHelp}</p>
                    <DetailTabs
                      tabs={socialProviders.map((provider) => ({
                        key: provider.provider,
                        label: providerLabel(provider.provider),
                        onSelect: () => setSocialProviderTab(provider.provider),
                      }))}
                      active={activeSocialProvider}
                    />
                    <div className="d-grid gap-3 mt-3">
                      {socialProviders
                        .filter((provider) => provider.provider === activeSocialProvider)
                        .map((provider) => {
                          const providerIndex = socialProviders.findIndex(
                            (item) => item.provider === provider.provider,
                          );
                          const providerErrors = socialErrors.providers?.[providerIndex];
                          return (
                            <Card key={provider.provider} className="admin-panel-card">
                              <Card.Body>
                                <h4 className="h6">{providerLabel(provider.provider)}</h4>
                                <div className="d-grid gap-3">
                                  <Form.Group controlId={`social-${provider.provider}-alias`}>
                                    <Form.Label>{copy.providerAlias}</Form.Label>
                                    <Form.Control
                                      isInvalid={Boolean(providerErrors?.alias)}
                                      {...registerSocial(`providers.${providerIndex}.alias`)}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                      {providerErrors?.alias?.message}
                                    </Form.Control.Feedback>
                                  </Form.Group>
                                  <Form.Group controlId={`social-${provider.provider}-order`}>
                                    <Form.Label>{copy.providerGuiOrder}</Form.Label>
                                    <Form.Control
                                      type="number"
                                      min={0}
                                      isInvalid={Boolean(providerErrors?.guiOrder)}
                                      {...registerSocial(`providers.${providerIndex}.guiOrder`, {
                                        valueAsNumber: true,
                                      })}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                      {providerErrors?.guiOrder?.message}
                                    </Form.Control.Feedback>
                                  </Form.Group>
                                  <Form.Group
                                    controlId={`social-${provider.provider}-account-visibility`}
                                  >
                                    <Form.Label>{copy.providerAccountVisibility}</Form.Label>
                                    <Form.Select
                                      {...registerSocial(
                                        `providers.${providerIndex}.showInAccountConsole`,
                                      )}
                                    >
                                      <option value="always">{copy.providerAccountAlways}</option>
                                      <option value="when-linked">
                                        {copy.providerAccountWhenLinked}
                                      </option>
                                      <option value="never">{copy.providerAccountNever}</option>
                                    </Form.Select>
                                  </Form.Group>
                                  <div>
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-hide-on-login`}
                                      label={copy.providerHideOnLogin}
                                      {...registerSocial(`providers.${providerIndex}.hideOnLogin`)}
                                    />
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-account-linking-only`}
                                      label={copy.providerAccountLinkingOnly}
                                      {...registerSocial(
                                        `providers.${providerIndex}.accountLinkingOnly`,
                                      )}
                                    />
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-trust-email`}
                                      label={copy.providerTrustEmail}
                                      {...registerSocial(`providers.${providerIndex}.trustEmail`)}
                                    />
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-mfa-required`}
                                      label={copy.providerMfaRequired}
                                      {...registerSocial(`providers.${providerIndex}.mfaRequired`)}
                                    />
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-store-tokens`}
                                      label={copy.providerStoreTokens}
                                      {...registerSocial(`providers.${providerIndex}.storeTokens`)}
                                    />
                                    <Form.Check
                                      type="switch"
                                      id={`social-${provider.provider}-stored-tokens-readable`}
                                      label={copy.providerStoredTokensReadable}
                                      {...registerSocial(
                                        `providers.${providerIndex}.storedTokensReadable`,
                                      )}
                                    />
                                  </div>
                                </div>
                                <Form.Group
                                  className="mt-3"
                                  controlId={`social-${provider.provider}-required-claims`}
                                >
                                  <Form.Label>{copy.providerRequiredClaims}</Form.Label>
                                  <Form.Control
                                    isInvalid={Boolean(providerErrors?.requiredClaims)}
                                    {...registerSocial(`providers.${providerIndex}.requiredClaims`)}
                                  />
                                  <Form.Control.Feedback type="invalid">
                                    {providerErrors?.requiredClaims?.message}
                                  </Form.Control.Feedback>
                                  <Form.Text>{copy.providerRequiredClaimsHelp}</Form.Text>
                                </Form.Group>
                                <Form.Group controlId={`social-${provider.provider}-client-id`}>
                                  <Form.Label>{copy.clientId}</Form.Label>
                                  <Form.Control
                                    isInvalid={Boolean(providerErrors?.clientId)}
                                    {...registerSocial(`providers.${providerIndex}.clientId`)}
                                  />
                                  <Form.Control.Feedback type="invalid">
                                    {providerErrors?.clientId?.message}
                                  </Form.Control.Feedback>
                                </Form.Group>
                                <Form.Group
                                  className="mt-3"
                                  controlId={`social-${provider.provider}-client-secret`}
                                >
                                  <Form.Label>{copy.clientSecret}</Form.Label>
                                  <Form.Control
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder={copy.clientSecretPlaceholder}
                                    isInvalid={Boolean(providerErrors?.clientSecret)}
                                    {...registerSocial(`providers.${providerIndex}.clientSecret`)}
                                  />
                                  <Form.Control.Feedback type="invalid">
                                    {providerErrors?.clientSecret?.message}
                                  </Form.Control.Feedback>
                                  {provider.clientSecretConfigured && (
                                    <Form.Text className="text-success">
                                      {copy.clientSecretConfigured}
                                    </Form.Text>
                                  )}
                                </Form.Group>
                              </Card.Body>
                            </Card>
                          );
                        })}
                    </div>
                    <div className="admin-form-actions mt-4">
                      <Button
                        type="button"
                        disabled={socialProvidersSubmitting}
                        onClick={saveSocialProviders}
                      >
                        {socialProvidersSubmitting ? (
                          <Spinner
                            animation="border"
                            aria-hidden="true"
                            className="me-2"
                            size="sm"
                          />
                        ) : (
                          <AdminActionIcon action="save" />
                        )}
                        {copy.socialCredentialsSave}
                      </Button>
                    </div>
                  </>
                )}
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "webauthn"}>
                <h2 className="h5 mb-3" id="login-settings-webauthn">
                  {copy.sectionWebAuthn}
                </h2>
                <p className="text-body-secondary">{copy.webAuthnPolicyHelp}</p>
                <Form.Group controlId="login-webauthn-mediation">
                  <Form.Label>{copy.webauthnMediation}</Form.Label>
                  <Form.Select {...register("webauthnMediation")}>
                    <option value="none">{copy.webauthnMediationNone}</option>
                    <option value="optional">{copy.webauthnMediationOptional}</option>
                    <option value="conditional">{copy.webauthnMediationConditional}</option>
                  </Form.Select>
                  <Form.Text>{copy.webauthnMediationHelp}</Form.Text>
                </Form.Group>
                <WebAuthnPolicyFields
                  title={copy.webauthnRegistrationPolicy}
                  help={copy.webauthnRegistrationPolicyHelp}
                  prefix="webauthnPolicy"
                  register={register}
                  errors={errors}
                  labels={webAuthnLabels}
                />
                <WebAuthnPolicyFields
                  title={copy.webauthnPasswordlessPolicy}
                  help={copy.webauthnPasswordlessPolicyHelp}
                  prefix="webauthnPasswordlessPolicy"
                  register={register}
                  errors={errors}
                  labels={webAuthnLabels}
                />
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "sessions"}>
                <h2 className="h5 mb-3" id="login-settings-sessions">
                  {copy.sectionSessions}
                </h2>
                <NumberField
                  id="login-session-timeout"
                  label={copy.sessionTimeout}
                  error={errors.sessionTimeoutMinutes?.message}
                  registration={register("sessionTimeoutMinutes", { valueAsNumber: true })}
                />
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "password-policy"}>
                <h2 className="h5 mb-3" id="login-settings-password-policy">
                  {copy.sectionPasswordPolicy}
                </h2>
                <div className="d-grid gap-3">
                  <NumberField
                    id="login-password-minimum"
                    label={copy.passwordMinimumLength}
                    error={errors.passwordMinimumLength?.message}
                    registration={register("passwordMinimumLength", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-maximum"
                    label={copy.passwordMaximumLength}
                    error={errors.passwordMaximumLength?.message}
                    registration={register("passwordMaximumLength", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-uppercase"
                    label={copy.passwordMinimumUppercase}
                    error={errors.passwordMinimumUppercase?.message}
                    registration={register("passwordMinimumUppercase", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-lowercase"
                    label={copy.passwordMinimumLowercase}
                    error={errors.passwordMinimumLowercase?.message}
                    registration={register("passwordMinimumLowercase", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-digits"
                    label={copy.passwordMinimumDigits}
                    error={errors.passwordMinimumDigits?.message}
                    registration={register("passwordMinimumDigits", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-special"
                    label={copy.passwordMinimumSpecialCharacters}
                    error={errors.passwordMinimumSpecialCharacters?.message}
                    registration={register("passwordMinimumSpecialCharacters", {
                      valueAsNumber: true,
                    })}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.passwordRejectUsername}
                    {...register("passwordRejectUsername")}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.passwordRejectEmail}
                    {...register("passwordRejectEmail")}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.passwordRejectCommonPasswords}
                    {...register("passwordRejectCommonPasswords")}
                  />
                  <NumberField
                    id="login-password-history"
                    label={copy.passwordHistorySize}
                    error={errors.passwordHistorySize?.message}
                    registration={register("passwordHistorySize", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-password-expiration"
                    label={copy.passwordExpirationDays}
                    error={errors.passwordExpirationDays?.message}
                    registration={register("passwordExpirationDays", { valueAsNumber: true })}
                  />
                  <Form.Group controlId="login-password-common-list">
                    <Form.Label>{copy.passwordCommonPasswords}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      isInvalid={Boolean(errors.passwordCommonPasswords)}
                      {...register("passwordCommonPasswords")}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.passwordCommonPasswords?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                </div>
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "brute-force"}>
                <h2 className="h5 mb-3" id="login-settings-brute-force">
                  {copy.sectionBruteForce}
                </h2>
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.bruteForceEnabled}
                  {...register("bruteForceEnabled")}
                />
                <div className="d-grid gap-3">
                  <NumberField
                    id="login-brute-force-failures"
                    label={copy.bruteForceMaxFailures}
                    error={errors.bruteForceMaxFailures?.message}
                    registration={register("bruteForceMaxFailures", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-mfa-brute-force-failures"
                    label={copy.bruteForceMaxSecondaryFailures}
                    error={errors.bruteForceMaxSecondaryFailures?.message}
                    registration={register("bruteForceMaxSecondaryFailures", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-mfa-verification-timeout"
                    label={copy.mfaVerificationTimeout}
                    error={errors.mfaVerificationTimeoutSeconds?.message}
                    registration={register("mfaVerificationTimeoutSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-quick-window"
                    label={copy.bruteForceQuickLoginWindowMillis}
                    error={errors.bruteForceQuickLoginWindowMillis?.message}
                    registration={register("bruteForceQuickLoginWindowMillis", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-quick-wait"
                    label={copy.bruteForceMinimumQuickLoginWaitSeconds}
                    error={errors.bruteForceMinimumQuickLoginWaitSeconds?.message}
                    registration={register("bruteForceMinimumQuickLoginWaitSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-wait-increment"
                    label={copy.bruteForceWaitIncrementSeconds}
                    error={errors.bruteForceWaitIncrementSeconds?.message}
                    registration={register("bruteForceWaitIncrementSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-max-wait"
                    label={copy.bruteForceMaxWaitSeconds}
                    error={errors.bruteForceMaxWaitSeconds?.message}
                    registration={register("bruteForceMaxWaitSeconds", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-failure-reset"
                    label={copy.bruteForceFailureResetTimeSeconds}
                    error={errors.bruteForceFailureResetTimeSeconds?.message}
                    registration={register("bruteForceFailureResetTimeSeconds", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-max-temporary-lockouts"
                    label={copy.bruteForceMaxTemporaryLockouts}
                    error={errors.bruteForceMaxTemporaryLockouts?.message}
                    registration={register("bruteForceMaxTemporaryLockouts", {
                      valueAsNumber: true,
                    })}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.bruteForcePermanentLockout}
                    {...register("bruteForcePermanentLockout")}
                  />
                  <NumberField
                    id="login-ip-rate-limit"
                    label={copy.bruteForceIpRequestsPerMinute}
                    error={errors.bruteForceIpRequestsPerMinute?.message}
                    registration={register("bruteForceIpRequestsPerMinute", {
                      valueAsNumber: true,
                    })}
                  />
                  <NumberField
                    id="login-user-ip-rate-limit"
                    label={copy.bruteForceUsernameIpRequestsPerMinute}
                    error={errors.bruteForceUsernameIpRequestsPerMinute?.message}
                    registration={register("bruteForceUsernameIpRequestsPerMinute", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>

              <section hidden={activeSection !== "otp-policy"}>
                <h2 className="h5 mb-3" id="login-settings-otp-policy">
                  {copy.sectionOtpPolicy}
                </h2>
                <Form.Check
                  className="mb-3"
                  type="switch"
                  label={copy.otpEnabled}
                  {...register("otpEnabled")}
                />
                <Form.Check
                  className="mb-4"
                  type="switch"
                  label={copy.otpRequired}
                  {...register("otpRequired")}
                />
                <div className="d-grid gap-3">
                  <Form.Group controlId="login-otp-issuer">
                    <Form.Label>{copy.otpIssuer}</Form.Label>
                    <Form.Control
                      isInvalid={Boolean(errors.otpIssuer)}
                      {...register("otpIssuer")}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.otpIssuer?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group controlId="login-otp-algorithm">
                    <Form.Label>{copy.otpAlgorithm}</Form.Label>
                    <Form.Select {...register("otpAlgorithm")}>
                      <option value="SHA1">SHA-1</option>
                      <option value="SHA256">SHA-256</option>
                      <option value="SHA512">SHA-512</option>
                    </Form.Select>
                  </Form.Group>
                  <NumberField
                    id="login-otp-digits"
                    label={copy.otpDigits}
                    error={errors.otpDigits?.message}
                    registration={register("otpDigits", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-otp-period"
                    label={copy.otpPeriodSeconds}
                    error={errors.otpPeriodSeconds?.message}
                    registration={register("otpPeriodSeconds", { valueAsNumber: true })}
                  />
                  <NumberField
                    id="login-otp-look-ahead"
                    label={copy.otpLookAheadWindow}
                    error={errors.otpLookAheadWindow?.message}
                    registration={register("otpLookAheadWindow", { valueAsNumber: true })}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.otpCodeReusable}
                    {...register("otpCodeReusable")}
                  />
                  <Form.Check
                    type="switch"
                    label={copy.otpAddRecoveryCodes}
                    {...register("otpAddRecoveryCodes")}
                  />
                  <NumberField
                    id="login-recovery-code-warning-threshold"
                    label={copy.recoveryCodeWarningThreshold}
                    error={errors.recoveryCodeWarningThreshold?.message}
                    registration={register("recoveryCodeWarningThreshold", { valueAsNumber: true })}
                  />
                </div>
                <SaveButton copy={copy.save} isSubmitting={isSubmitting} />
              </section>
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

function NumberField({
  id,
  label,
  error,
  registration,
}: {
  id: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <Form.Group controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Control type="number" isInvalid={Boolean(error)} {...registration} />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}

function WebAuthnPolicyFields({
  title,
  help,
  prefix,
  register,
  errors,
  labels,
}: {
  title: string;
  help: string;
  prefix: "webauthnPolicy" | "webauthnPasswordlessPolicy";
  register: UseFormRegister<Settings>;
  errors: FieldErrors<Settings>;
  labels: {
    rpName: string;
    rpId: string;
    signatureAlgorithms: string;
    attestation: string;
    attestationNone: string;
    attestationIndirect: string;
    attestationDirect: string;
    attestationEnterprise: string;
    authenticatorAttachment: string;
    authenticatorAny: string;
    authenticatorPlatform: string;
    authenticatorCrossPlatform: string;
    residentKey: string;
    residentDiscouraged: string;
    residentPreferred: string;
    residentRequired: string;
    userVerification: string;
    userVerificationDiscouraged: string;
    userVerificationPreferred: string;
    userVerificationRequired: string;
    timeoutSeconds: string;
    avoidSameAuthenticator: string;
    acceptableAaguids: string;
    rpIdHelp: string;
    signatureAlgorithmsHelp: string;
    acceptableAaguidsHelp: string;
  };
}) {
  const policyErrors = errors[prefix] as FieldErrors<WebAuthnPolicy> | undefined;
  const path = (field: keyof WebAuthnPolicy) => `${prefix}.${field}` as Path<Settings>;
  const fieldError = (field: keyof WebAuthnPolicy) => policyErrors?.[field]?.message;
  return (
    <Card className="admin-panel-card mt-4">
      <Card.Body>
        <h3 className="h6 mb-2">{title}</h3>
        <p className="text-body-secondary small">{help}</p>
        <div className="d-grid gap-3">
          <Form.Group controlId={`${prefix}-rp-name`}>
            <Form.Label>{labels.rpName}</Form.Label>
            <Form.Control isInvalid={Boolean(fieldError("rpName"))} {...register(path("rpName"))} />
            <Form.Control.Feedback type="invalid">{fieldError("rpName")}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId={`${prefix}-rp-id`}>
            <Form.Label>{labels.rpId}</Form.Label>
            <Form.Control isInvalid={Boolean(fieldError("rpId"))} {...register(path("rpId"))} />
            <Form.Control.Feedback type="invalid">{fieldError("rpId")}</Form.Control.Feedback>
            <Form.Text>{labels.rpIdHelp}</Form.Text>
          </Form.Group>
          <Form.Group controlId={`${prefix}-signature-algorithms`}>
            <Form.Label>{labels.signatureAlgorithms}</Form.Label>
            <Form.Control
              isInvalid={Boolean(fieldError("signatureAlgorithms"))}
              {...register(path("signatureAlgorithms"))}
            />
            <Form.Control.Feedback type="invalid">
              {fieldError("signatureAlgorithms")}
            </Form.Control.Feedback>
            <Form.Text>{labels.signatureAlgorithmsHelp}</Form.Text>
          </Form.Group>
          <Form.Group controlId={`${prefix}-attestation`}>
            <Form.Label>{labels.attestation}</Form.Label>
            <Form.Select {...register(path("attestation"))}>
              <option value="none">{labels.attestationNone}</option>
              <option value="indirect">{labels.attestationIndirect}</option>
              <option value="direct">{labels.attestationDirect}</option>
              <option value="enterprise">{labels.attestationEnterprise}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId={`${prefix}-authenticator-attachment`}>
            <Form.Label>{labels.authenticatorAttachment}</Form.Label>
            <Form.Select {...register(path("authenticatorAttachment"))}>
              <option value="any">{labels.authenticatorAny}</option>
              <option value="platform">{labels.authenticatorPlatform}</option>
              <option value="cross-platform">{labels.authenticatorCrossPlatform}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId={`${prefix}-resident-key`}>
            <Form.Label>{labels.residentKey}</Form.Label>
            <Form.Select {...register(path("residentKey"))}>
              <option value="discouraged">{labels.residentDiscouraged}</option>
              <option value="preferred">{labels.residentPreferred}</option>
              <option value="required">{labels.residentRequired}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId={`${prefix}-user-verification`}>
            <Form.Label>{labels.userVerification}</Form.Label>
            <Form.Select {...register(path("userVerification"))}>
              <option value="discouraged">{labels.userVerificationDiscouraged}</option>
              <option value="preferred">{labels.userVerificationPreferred}</option>
              <option value="required">{labels.userVerificationRequired}</option>
            </Form.Select>
          </Form.Group>
          <NumberField
            id={`${prefix}-timeout`}
            label={labels.timeoutSeconds}
            error={fieldError("timeoutSeconds")}
            registration={register(path("timeoutSeconds"), { valueAsNumber: true })}
          />
          <Form.Check
            type="switch"
            label={labels.avoidSameAuthenticator}
            {...register(path("avoidSameAuthenticator"))}
          />
          <Form.Group controlId={`${prefix}-acceptable-aaguids`}>
            <Form.Label>{labels.acceptableAaguids}</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              isInvalid={Boolean(fieldError("acceptableAaguids"))}
              {...register(path("acceptableAaguids"))}
            />
            <Form.Control.Feedback type="invalid">
              {fieldError("acceptableAaguids")}
            </Form.Control.Feedback>
            <Form.Text>{labels.acceptableAaguidsHelp}</Form.Text>
          </Form.Group>
        </div>
      </Card.Body>
    </Card>
  );
}

function SaveButton({ copy, isSubmitting }: { copy: string; isSubmitting: boolean }) {
  return (
    <div className="admin-form-actions mt-4">
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
        ) : (
          <AdminActionIcon action="save" />
        )}
        {copy}
      </Button>
    </div>
  );
}

function normalizeSettings(settings: LoginSettingsResponse): Settings {
  return {
    ...defaultSettings,
    ...settings,
    webauthnPolicy: normalizeWebAuthnPolicy(settings.webauthnPolicy, defaultWebAuthnPolicy),
    webauthnPasswordlessPolicy: normalizeWebAuthnPolicy(
      settings.webauthnPasswordlessPolicy,
      defaultPasswordlessWebAuthnPolicy,
    ),
  };
}

function normalizeWebAuthnPolicy(
  policy: Partial<WebAuthnPolicy> | null | undefined,
  fallback: WebAuthnPolicy,
): WebAuthnPolicy {
  return {
    ...fallback,
    ...policy,
    rpName: policy?.rpName ?? fallback.rpName,
    rpId: policy?.rpId ?? fallback.rpId,
    signatureAlgorithms: policy?.signatureAlgorithms ?? fallback.signatureAlgorithms,
    acceptableAaguids: policy?.acceptableAaguids ?? fallback.acceptableAaguids,
  };
}
