"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { DetailLoadingState, ErrorState } from "@/components/admin/AsyncState";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ReadOnlyMetadata } from "@/components/admin/ReadOnlyMetadata";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { useLocale } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { persistLocale } from "@/i18n/locale-cookie";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { applyProblemToForm } from "@/lib/problem-detail";
import {
  requestAccount,
  type AccountApiError,
  type AccountAvatar,
  type AccountProfile,
} from "@/lib/account-api";
import { apiUrl } from "@/lib/desktop-api";

import { useAccountAuth } from "./AccountAuthProvider";
import { PasswordField } from "../auth/PasswordField";
import { useTranslation } from "react-i18next";

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  preferredLocale: Locale;
  currentPassword: string;
  profile: Record<string, string[]>;
};
type ProfileDefinition = {
  id?: number;
  name: string;
  displayName: string;
  description: string | null;
  type: "STRING" | "EMAIL" | "INTEGER" | "BOOLEAN";
  required: boolean;
  multivalued: boolean;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  enabled?: boolean;
  displayOrder?: number;
  builtIn?: boolean;
};
type ProfileAttributes = {
  definitions: ProfileDefinition[];
  attributes: Record<string, string[]>;
};

const PROFILE_BUILT_IN_NAMES = new Set(["username", "email", "firstName", "lastName"]);

export function AccountProfileForm({ dictionary }: { dictionary: Dictionary }) {
  const formatDateTime = useDateTimeFormatter();
  const activeLocale = useLocale();
  const { i18n } = useTranslation("common");
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.account;
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileAttributes, setProfileAttributes] = useState<ProfileAttributes | null>(null);
  const [profileAttributesLoading, setProfileAttributesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [emailReauthRequired, setEmailReauthRequired] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showAvatarDeleteConfirm, setShowAvatarDeleteConfirm] = useState(false);
  const [supportedLocales, setSupportedLocales] = useState<Locale[]>([...locales]);
  const profileSchema = z
    .record(z.string(), z.array(z.string()))
    .superRefine((attributes, context) => {
      for (const definition of profileAttributes?.definitions ?? []) {
        if (PROFILE_BUILT_IN_NAMES.has(definition.name)) continue;
        const values = (attributes[definition.name] ?? [])
          .map((value) => value.trim())
          .filter(Boolean);
        if (definition.required && values.length === 0) {
          context.addIssue({
            code: "custom",
            path: [definition.name],
            message: copy.validation.required,
          });
          continue;
        }
        if (!definition.multivalued && values.length > 1) {
          context.addIssue({
            code: "custom",
            path: [definition.name],
            message: copy.validation.invalid,
          });
        }
        for (const value of values) {
          if (
            (definition.minLength !== null && value.length < definition.minLength) ||
            (definition.maxLength !== null && value.length > definition.maxLength) ||
            (definition.type === "EMAIL" && !z.email().safeParse(value).success) ||
            (definition.type === "INTEGER" && !/^-?\d+$/.test(value)) ||
            (definition.type === "BOOLEAN" && !["true", "false"].includes(value)) ||
            (definition.pattern !== null &&
              (() => {
                try {
                  return !new RegExp(definition.pattern).test(value);
                } catch {
                  return true;
                }
              })())
          ) {
            context.addIssue({
              code: "custom",
              path: [definition.name],
              message: copy.validation.invalid,
            });
            break;
          }
        }
      }
    });
  const schema = z.object({
    firstName: z.string().trim().max(100, copy.validation.max100),
    lastName: z.string().trim().max(100, copy.validation.max100),
    email: z
      .string()
      .trim()
      .max(200, copy.validation.max200)
      .refine((value) => value === "" || z.email().safeParse(value).success, copy.validation.email),
    preferredLocale: z.enum(locales),
    currentPassword: z.string().max(200, copy.validation.max200),
    profile: profileSchema,
  });
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    setFocus,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      preferredLocale: activeLocale,
      currentPassword: "",
      profile: {},
    },
  });
  const profileAttributeValues = useWatch({ control, name: "profile", defaultValue: {} });

  useEffect(() => {
    if (typeof fetch !== "function") return;
    void fetch("/api/auth/localization", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then(
        (settings: {
          internationalizationEnabled: boolean;
          defaultLocale: string;
          supportedLocales: string[];
        }) => {
          const enabled = settings.internationalizationEnabled
            ? settings.supportedLocales.filter((value): value is Locale =>
                locales.includes(value as Locale),
              )
            : locales.filter((value) => value === settings.defaultLocale);
          setSupportedLocales(enabled.length > 0 ? enabled : ["en"]);
        },
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<AccountProfile>(accessToken, { url: "/api/account/profile" })
      .then((value) => {
        setProfile(value);
        setIsError(false);
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<ProfileAttributes>(accessToken, { url: "/api/account/profile/attributes" })
      .then((value) => {
        const safeValue =
          value && Array.isArray(value.definitions)
            ? { definitions: value.definitions, attributes: value.attributes ?? {} }
            : { definitions: [], attributes: {} };
        setProfileAttributes(safeValue);
        setValue("profile", safeValue.attributes ?? {}, { shouldDirty: false });
      })
      .catch(() => setIsError(true))
      .finally(() => setProfileAttributesLoading(false));
  }, [accessToken, setValue]);

  useEffect(() => {
    if (!accessToken) return;
    void requestAccount<AccountAvatar>(accessToken, { url: "/api/account/profile/avatar" })
      .then((value) => setAvatarUrl(value?.avatarUrl ?? null))
      .catch(() => setAvatarUrl(null));
  }, [accessToken]);

  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        email: profile.email ?? "",
        preferredLocale:
          profile.preferredLocale && locales.includes(profile.preferredLocale as Locale)
            ? (profile.preferredLocale as Locale)
            : activeLocale,
        currentPassword: "",
        profile: getValues("profile"),
      });
    }
  }, [activeLocale, getValues, profile, reset]);

  const submit = handleSubmit(async (values) => {
    if (!accessToken) return;
    try {
      setProfileUpdating(true);
      const updated = await requestAccount<AccountProfile>(accessToken, {
        method: "PUT",
        url: "/api/account/profile",
        data: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          currentPassword: values.currentPassword.trim() || undefined,
        },
      });
      await requestAccount<{ locale: Locale }>(accessToken, {
        method: "PUT",
        url: "/api/auth/localization/me",
        data: { locale: values.preferredLocale },
      });
      const attributesResponse = await requestAccount<ProfileAttributes>(accessToken, {
        method: "PUT",
        url: "/api/account/profile/attributes",
        data: { attributes: values.profile },
      });
      persistLocale(values.preferredLocale);
      await i18n.changeLanguage(values.preferredLocale);
      setProfile({ ...updated, preferredLocale: values.preferredLocale });
      const safeAttributesResponse = attributesResponse ?? { definitions: [], attributes: {} };
      setProfileAttributes(safeAttributesResponse);
      reset({
        firstName: updated.firstName ?? "",
        lastName: updated.lastName ?? "",
        email: updated.email ?? "",
        preferredLocale: values.preferredLocale,
        currentPassword: "",
        profile: safeAttributesResponse.attributes ?? {},
      });
      setEmailReauthRequired(false);
      alerts.addAlert(copy.profile.saved);
    } catch (error) {
      const data = (error as AccountApiError).data;
      if (
        typeof data === "object" &&
        data !== null &&
        "errorCode" in data &&
        data.errorCode === "reauthentication_required"
      ) {
        setEmailReauthRequired(true);
        return;
      }
      const result = applyProblemToForm((error as AccountApiError).data, setError, {
        fields: ["firstName", "lastName", "email", "preferredLocale", "currentPassword"],
        fallbackMessage: copy.validation.invalid,
      });
      if (result.firstField) setFocus(result.firstField as keyof Values);
      alerts.addError(copy.common.operationError);
    } finally {
      setProfileUpdating(false);
    }
  });

  const requestVerification = async () => {
    if (!accessToken) return;
    setVerificationSending(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "POST",
        url: "/api/account/send-verify-email",
      });
      alerts.addAlert(copy.profile.verificationSent);
    } catch {
      alerts.addError(copy.common.operationError);
    } finally {
      setVerificationSending(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    setAvatarError(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError(copy.profile.avatarInvalid);
      return;
    }
    if (!accessToken) return;
    setAvatarSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const value = await requestAccount<AccountAvatar>(accessToken, {
        method: "PUT",
        url: "/api/account/profile/avatar",
        data: formData,
      });
      setAvatarUrl(value.avatarUrl);
      alerts.addAlert(copy.profile.avatarUpdated);
    } catch {
      setAvatarError(copy.profile.avatarUploadError);
      alerts.addError(copy.common.operationError);
    } finally {
      setAvatarSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (!accessToken) return;
    setAvatarSaving(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: "/api/account/profile/avatar",
      });
      setAvatarUrl(null);
      alerts.addAlert(copy.profile.avatarDeleted);
    } catch {
      alerts.addError(copy.common.operationError);
    } finally {
      setAvatarSaving(false);
    }
  };

  if (isLoading || profileAttributesLoading) return <DetailLoadingState />;
  if (isError && !profile) return <ErrorState message={copy.common.operationError} />;
  if (!profile) return null;

  const renderedProfileDefinitions = (
    profileAttributes?.definitions.length
      ? profileAttributes.definitions
      : [
          {
            name: "username",
            displayName: copy.profile.username,
            description: copy.profile.usernameHelp,
            type: "STRING" as const,
            required: true,
            multivalued: false,
            minLength: null,
            maxLength: 100,
            pattern: null,
            displayOrder: 10,
            builtIn: true,
          },
          {
            name: "email",
            displayName: copy.profile.email,
            description: null,
            type: "EMAIL" as const,
            required: false,
            multivalued: false,
            minLength: null,
            maxLength: 200,
            pattern: null,
            displayOrder: 20,
            builtIn: true,
          },
          {
            name: "firstName",
            displayName: copy.profile.firstName,
            description: null,
            type: "STRING" as const,
            required: false,
            multivalued: false,
            minLength: null,
            maxLength: 100,
            pattern: null,
            displayOrder: 30,
            builtIn: true,
          },
          {
            name: "lastName",
            displayName: copy.profile.lastName,
            description: null,
            type: "STRING" as const,
            required: false,
            multivalued: false,
            minLength: null,
            maxLength: 100,
            pattern: null,
            displayOrder: 40,
            builtIn: true,
          },
        ]
  ).toSorted((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));

  return (
    <Card className="admin-panel-card account-panel-card">
      <Card.Header className="bg-body p-4 border-bottom">
        <h2 className="h5 mb-1">{copy.profile.sectionTitle}</h2>
        <div className="small text-body-secondary">{copy.profile.sectionHelp}</div>
      </Card.Header>
      <Card.Body className="p-4">
        <Form onSubmit={submit} noValidate>
          <Row className="g-4">
            <Col xs={12}>
              <div className="account-avatar-row d-flex align-items-center gap-3 pb-3 border-bottom">
                {avatarUrl ? (
                  <Image
                    alt=""
                    className="rounded-circle object-fit-cover admin-user-avatar"
                    height={72}
                    src={apiUrl(avatarUrl)}
                    unoptimized
                    width={72}
                  />
                ) : (
                  <span className="avatar-placeholder admin-user-avatar">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold">{copy.profile.avatar}</div>
                  <div className="small text-body-secondary">{copy.profile.avatarHelp}</div>
                </div>
                <label className="btn btn-sm btn-primary mb-0">
                  {avatarSaving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <ActionIcon action="upload" />
                  )}
                  {copy.profile.uploadAvatar}
                  <input
                    className="visually-hidden"
                    accept="image/jpeg,image/png"
                    disabled={avatarSaving}
                    onChange={(event) => void uploadAvatar(event.target.files?.[0])}
                    type="file"
                  />
                </label>
                {avatarUrl && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={avatarSaving}
                    onClick={() => setShowAvatarDeleteConfirm(true)}
                    type="button"
                  >
                    <ActionIcon action="delete" />
                    {copy.profile.removeAvatar}
                  </Button>
                )}
              </div>
              {avatarError && (
                <Alert variant="danger" className="mt-3 mb-0">
                  {avatarError}
                </Alert>
              )}
            </Col>
            <Col xs={12}>
              <Form.Group controlId="account-profile-locale">
                <Form.Label>{copy.profile.locale}</Form.Label>
                <Form.Select {...register("preferredLocale")}>
                  {supportedLocales.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale === "tr" ? "Türkçe" : "English"}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text>{copy.profile.localeHelp}</Form.Text>
              </Form.Group>
            </Col>
            {renderedProfileDefinitions.map((definition) => {
              const values = profileAttributeValues[definition.name] ?? [];
              const value = definition.multivalued ? values.join("\n") : (values[0] ?? "");
              const profileError =
                errors.profile && typeof errors.profile === "object"
                  ? (errors.profile as Record<string, { message?: string }>)[definition.name]
                      ?.message
                  : undefined;
              const builtInError =
                definition.name === "firstName"
                  ? errors.firstName
                  : definition.name === "lastName"
                    ? errors.lastName
                    : undefined;
              return (
                <Col xs={12} key={definition.name}>
                  <Form.Group controlId={`account-profile-${definition.name}`}>
                    <Form.Label>
                      {definition.displayName}
                      {definition.required ? " *" : ""}
                    </Form.Label>
                    {definition.name === "username" ? (
                      <Form.Control value={profile.username} readOnly aria-readonly="true" />
                    ) : definition.name === "firstName" || definition.name === "lastName" ? (
                      <Form.Control
                        {...register(definition.name)}
                        isInvalid={Boolean(errors[definition.name])}
                        aria-describedby={
                          errors[definition.name] ? `${definition.name}-error` : undefined
                        }
                      />
                    ) : definition.name === "email" ? (
                      <>
                        <Form.Control
                          type="email"
                          autoComplete="email"
                          {...register("email")}
                          isInvalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? "email-error" : undefined}
                        />
                        <Form.Control.Feedback id="email-error" type="invalid">
                          {errors.email?.message}
                        </Form.Control.Feedback>
                        {profile.email && (
                          <div className="d-flex align-items-center gap-2 mt-2">
                            <Badge bg={profile.emailVerified ? "success" : "warning"}>
                              {profile.emailVerified
                                ? copy.profile.emailVerified
                                : copy.profile.emailUnverified}
                            </Badge>
                            {!profile.emailVerified && (
                              <Button
                                type="button"
                                size="sm"
                                variant="link"
                                className="p-0"
                                disabled={verificationSending}
                                onClick={() => void requestVerification()}
                              >
                                {verificationSending ? (
                                  <Spinner
                                    animation="border"
                                    aria-hidden="true"
                                    className="me-2"
                                    size="sm"
                                  />
                                ) : (
                                  <ActionIcon action="verify" />
                                )}
                                {copy.profile.sendVerification}
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    ) : definition.type === "BOOLEAN" ? (
                      <Form.Select
                        value={value}
                        isInvalid={Boolean(profileError)}
                        required={definition.required}
                        onChange={(event) => {
                          setValue(
                            "profile",
                            {
                              ...profileAttributeValues,
                              [definition.name]: event.target.value ? [event.target.value] : [],
                            },
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      >
                        <option value="">—</option>
                        <option value="true">{copy.common.yes}</option>
                        <option value="false">{copy.common.no}</option>
                      </Form.Select>
                    ) : (
                      <Form.Control
                        as={definition.multivalued ? "textarea" : undefined}
                        rows={definition.multivalued ? 3 : undefined}
                        type={
                          definition.type === "EMAIL"
                            ? "email"
                            : definition.type === "INTEGER"
                              ? "number"
                              : "text"
                        }
                        value={value}
                        isInvalid={Boolean(profileError)}
                        required={definition.required}
                        minLength={definition.minLength ?? undefined}
                        maxLength={definition.maxLength ?? undefined}
                        onChange={(event) => {
                          setValue(
                            "profile",
                            {
                              ...profileAttributeValues,
                              [definition.name]: definition.multivalued
                                ? event.target.value.split("\n")
                                : [event.target.value],
                            },
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      />
                    )}
                    {builtInError && (
                      <Form.Control.Feedback id={`${definition.name}-error`} type="invalid">
                        {builtInError.message}
                      </Form.Control.Feedback>
                    )}
                    {profileError && (
                      <Form.Control.Feedback type="invalid">{profileError}</Form.Control.Feedback>
                    )}
                    {definition.description && <Form.Text>{definition.description}</Form.Text>}
                  </Form.Group>
                </Col>
              );
            })}
            {emailReauthRequired && (
              <Col xs={12}>
                <Alert variant="info">{copy.profile.reauthenticationRequired}</Alert>
                <PasswordField
                  controlId="account-profile-current-password"
                  label={copy.profile.currentPassword}
                  placeholder={copy.profile.currentPassword}
                  showLabel={dictionary.login.showPassword}
                  hideLabel={dictionary.login.hidePassword}
                  autoComplete="current-password"
                  error={errors.currentPassword?.message}
                  inputProps={{
                    isInvalid: Boolean(errors.currentPassword),
                    ...register("currentPassword"),
                  }}
                />
              </Col>
            )}
            <Col xs={12}>
              <div className="account-metadata-panel">
                <div className="small fw-semibold mb-3">{copy.profile.metadata}</div>
                <ReadOnlyMetadata
                  items={[
                    {
                      label: copy.profile.createdAt,
                      value: formatDateTime(profile.createdAt),
                    },
                    {
                      label: copy.profile.updatedAt,
                      value: formatDateTime(profile.updatedAt),
                    },
                  ]}
                />
              </div>
            </Col>
          </Row>
          <div className="account-form-actions mt-4 pt-4 border-top">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting || profileUpdating}
              data-testid="save-profile"
            >
              {isSubmitting || profileUpdating ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <ActionIcon action="save" />
              )}
              {copy.common.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!isDirty || isSubmitting || profileUpdating}
              onClick={() => {
                reset({
                  firstName: profile.firstName ?? "",
                  lastName: profile.lastName ?? "",
                  email: profile.email ?? "",
                  preferredLocale:
                    profile.preferredLocale && locales.includes(profile.preferredLocale as Locale)
                      ? (profile.preferredLocale as Locale)
                      : activeLocale,
                  currentPassword: "",
                  profile: profileAttributes?.attributes ?? {},
                });
              }}
            >
              <ActionIcon action="cancel" />
              {copy.common.cancel}
            </Button>
          </div>
        </Form>
      </Card.Body>
      <ConfirmModal
        busy={avatarSaving}
        cancelLabel={copy.common.cancel}
        confirmLabel={copy.profile.removeAvatar}
        message={copy.profile.removeAvatarConfirm}
        onCancel={() => setShowAvatarDeleteConfirm(false)}
        onConfirm={() => {
          setShowAvatarDeleteConfirm(false);
          void removeAvatar();
        }}
        show={showAvatarDeleteConfirm}
      />
    </Card>
  );
}
