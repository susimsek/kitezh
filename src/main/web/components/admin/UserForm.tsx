"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useRouter } from "@/routing/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@/lib/form";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { adminRequest } from "@/lib/admin-api";
import type { PageResponse } from "@/lib/api-types";
import { applyProblemToForm, problemViolations } from "@/lib/problem-detail";
import { apiUrl } from "@/lib/desktop-api";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminActionIcon } from "./AdminActionIcon";
import { ErrorState, LoadingState } from "./AsyncState";
import { ConfirmModal } from "./ConfirmModal";
import { DetailTabs } from "./DetailTabs";
import { EntityRelatedData } from "./EntityRelatedData";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { ReadOnlyMetadata } from "./ReadOnlyMetadata";
import { UserGroups } from "./UserGroups";

type User = {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerified: boolean;
  enabled: boolean;
  locked: boolean;
  lockedUntil: string | null;
  failedLoginCount: number;
  mustChangePassword: boolean;
  temporaryPassword: boolean;
  totpEnabled: boolean;
  avatarUrl: string | null;
  authorities: string[];
  assignedRoles?: string[];
  groupMappings?: { groupId: number | null; groupPath: string; roles: string[] }[];
  inheritedRoles?: string[];
  effectiveRoles?: string[];
  createdAt: string;
  updatedAt: string;
};
type Role = { name: string };
type UserFormValues = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  password: string;
  enabled: boolean;
  roles: string[];
  temporaryPassword?: boolean;
  profile: Record<string, string[]>;
};
type RequiredAction = {
  key: string;
  displayName: string;
  enabled: boolean;
  globalPolicy: boolean;
  assigned: boolean;
};
type AdminPasskey = {
  credentialId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  transports: string[];
  backupEligible: boolean;
  backupState: boolean;
  credentialType?: string;
  signatureCount?: number;
  uvInitialized?: boolean;
  attestationPresent?: boolean;
};
type ProfileDefinition = {
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
type ProfileAttributes = {
  definitions: ProfileDefinition[];
  attributes: Record<string, string[]>;
};

const DEFAULT_PROFILE_DEFINITIONS: ProfileDefinition[] = [
  {
    id: -1,
    name: "username",
    displayName: "Username",
    description: null,
    type: "STRING",
    required: true,
    multivalued: false,
    minLength: null,
    maxLength: 100,
    pattern: null,
    enabled: true,
    displayOrder: 10,
    builtIn: true,
  },
  {
    id: -2,
    name: "email",
    displayName: "Email",
    description: null,
    type: "EMAIL",
    required: false,
    multivalued: false,
    minLength: null,
    maxLength: 200,
    pattern: null,
    enabled: true,
    displayOrder: 20,
    builtIn: true,
  },
  {
    id: -3,
    name: "firstName",
    displayName: "First name",
    description: null,
    type: "STRING",
    required: false,
    multivalued: false,
    minLength: null,
    maxLength: 100,
    pattern: null,
    enabled: true,
    displayOrder: 30,
    builtIn: true,
  },
  {
    id: -4,
    name: "lastName",
    displayName: "Last name",
    description: null,
    type: "STRING",
    required: false,
    multivalued: false,
    minLength: null,
    maxLength: 100,
    pattern: null,
    enabled: true,
    displayOrder: 40,
    builtIn: true,
  },
];

const USER_DETAIL_TABS = [
  "details",
  "credentials",
  "roles",
  "groups",
  "sessions",
  "consents",
  "events",
] as const;

export function UserForm({
  locale,
  dictionary,
  id,
  tab = "details",
}: {
  locale: Locale;
  dictionary: Dictionary;
  id?: string | null;
  tab?: string;
}) {
  const router = useRouter();
  const { access, accessToken } = useAdminAuth();
  const canManageUsers = Boolean(access?.manageUsers);
  const canImpersonateUsers = Boolean(access?.impersonateUsers);
  const copy = dictionary.admin.resources;
  const editing = Boolean(id);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [securityState, setSecurityState] = useState({
    locked: false,
    lockedUntil: null as string | null,
    failedLoginCount: 0,
    mustChangePassword: false,
    temporaryPassword: false,
  });
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showAvatarDeleteConfirm, setShowAvatarDeleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTotpResetConfirm, setShowTotpResetConfirm] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpResetting, setTotpResetting] = useState(false);
  const [totpResetError, setTotpResetError] = useState(false);
  const [requiredActions, setRequiredActions] = useState<RequiredAction[]>([]);
  const [requiredActionBusy, setRequiredActionBusy] = useState<string | null>(null);
  const [requiredActionError, setRequiredActionError] = useState(false);
  const [roleView, setRoleView] = useState<{
    assignedRoles: string[];
    groupMappings: { groupId: number | null; groupPath: string; roles: string[] }[];
    inheritedRoles: string[];
    effectiveRoles: string[];
  }>({ assignedRoles: [], groupMappings: [], inheritedRoles: [], effectiveRoles: [] });
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const actionForm = useForm<{
    action: "VERIFY_EMAIL" | "UPDATE_PASSWORD";
    lifespan: "1800" | "3600" | "43200" | "86400";
  }>({
    resolver: zodResolver(
      z.object({
        action: z.enum(["VERIFY_EMAIL", "UPDATE_PASSWORD"]),
        lifespan: z.enum(["1800", "3600", "43200", "86400"]),
      }),
    ),
    defaultValues: { action: "UPDATE_PASSWORD", lifespan: "43200" },
  });
  const [actionError, setActionError] = useState(false);
  const [actionSent, setActionSent] = useState(false);
  const [impersonationBusy, setImpersonationBusy] = useState(false);
  const [error, setError] = useState(false);
  const [profileDefinitions, setProfileDefinitions] = useState<ProfileDefinition[]>([]);
  const [profileAttributesError, setProfileAttributesError] = useState(false);
  const activeTab = USER_DETAIL_TABS.includes(tab as (typeof USER_DETAIL_TABS)[number])
    ? tab
    : "details";
  const validation = dictionary.admin.common.validation;
  const profileSchema = z
    .record(z.string(), z.array(z.string()))
    .superRefine((attributes, context) => {
      for (const definition of profileDefinitions) {
        // Built-in fields are registered as top-level form values below. They
        // must not be validated a second time as profile attributes because
        // that would always see an empty profile.username/profile.email value
        // and block a valid user creation request.
        if (definition.builtIn) continue;
        const values = (attributes[definition.name] ?? [])
          .map((value) => value.trim())
          .filter(Boolean);
        if (definition.required && values.length === 0) {
          context.addIssue({
            code: "custom",
            path: [definition.name],
            message: validation.required,
          });
          continue;
        }
        if (!definition.multivalued && values.length > 1) {
          context.addIssue({
            code: "custom",
            path: [definition.name],
            message: validation.invalid,
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
              message: validation.invalid,
            });
            break;
          }
        }
      }
    });
  const schema = z.object({
    username: z.string().trim().min(1, validation.required).max(100, validation.max100),
    firstName: z.string().trim().max(100, validation.max100),
    lastName: z.string().trim().max(100, validation.max100),
    email: z
      .string()
      .trim()
      .max(200, validation.max200)
      .refine((value) => value === "" || z.email().safeParse(value).success, validation.email),
    emailVerified: z.boolean(),
    password: editing
      ? z
          .string()
          .max(200, validation.max200)
          .refine((value) => value === "" || value.length >= 12, validation.password)
      : z.string().min(12, validation.password).max(128, validation.max200),
    enabled: z.boolean(),
    roles: z.array(z.string()).min(1, validation.roles),
    temporaryPassword: z.boolean().optional(),
    profile: profileSchema,
  });
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    setError: setFieldError,
    control,
    formState: { errors, dirtyFields },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      emailVerified: false,
      password: "",
      enabled: true,
      roles: ["ROLE_USER"],
      temporaryPassword: true,
      profile: {},
    },
  });
  const enabled = useWatch({ control, name: "enabled", defaultValue: true });
  const roles = useWatch({ control, name: "roles", defaultValue: ["ROLE_USER"] });
  const profileValues = useWatch({ control, name: "profile", defaultValue: {} });
  const renderedProfileDefinitions =
    profileDefinitions.length > 0 ? profileDefinitions : DEFAULT_PROFILE_DEFINITIONS;

  useEffect(() => {
    if (!editing || !id || !accessToken) return;
    adminRequest<User>(accessToken, { url: `/api/admin/users/${encodeURIComponent(id)}` })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset({
          username: response.data.username,
          firstName: response.data.firstName ?? "",
          lastName: response.data.lastName ?? "",
          email: response.data.email ?? "",
          emailVerified: response.data.emailVerified ?? false,
          password: "",
          enabled: response.data.enabled,
          roles: response.data.assignedRoles ?? response.data.authorities,
          temporaryPassword: true,
          profile: {},
        });
        setAvatarUrl(response.data.avatarUrl);
        setRoleView({
          assignedRoles: response.data.assignedRoles ?? response.data.authorities,
          groupMappings: response.data.groupMappings ?? [],
          inheritedRoles: response.data.inheritedRoles ?? [],
          effectiveRoles: response.data.effectiveRoles ?? response.data.authorities,
        });
        setTotpEnabled(response.data.totpEnabled);
        setCreatedAt(response.data.createdAt);
        setUpdatedAt(response.data.updatedAt);
        setSecurityState({
          locked: response.data.locked,
          lockedUntil: response.data.lockedUntil,
          failedLoginCount: response.data.failedLoginCount,
          mustChangePassword: response.data.mustChangePassword,
          temporaryPassword: response.data.temporaryPassword,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken, editing, id, reset]);

  useEffect(() => {
    if (!accessToken) return;
    const url =
      editing && id
        ? `/api/admin/users/${encodeURIComponent(id)}/profile-attributes`
        : "/api/admin/profile-attributes";
    adminRequest<ProfileAttributes | ProfileDefinition[]>(accessToken, { url })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        if (Array.isArray(response.data)) {
          setProfileDefinitions(response.data);
          setValue("profile", {}, { shouldDirty: false });
        } else if (response.data && Array.isArray(response.data.definitions)) {
          setProfileDefinitions(response.data.definitions);
          setValue("profile", response.data.attributes ?? {}, { shouldDirty: false });
        } else {
          setProfileDefinitions([]);
          setValue("profile", {}, { shouldDirty: false });
        }
        setProfileAttributesError(false);
      })
      .catch(() => setProfileAttributesError(true));
  }, [accessToken, editing, id, setValue]);

  useEffect(() => {
    if (!editing || !id || !accessToken || activeTab !== "credentials") return;
    adminRequest<RequiredAction[]>(accessToken, {
      url: `/api/admin/required-actions/users/${encodeURIComponent(id)}`,
    })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setRequiredActions(Array.isArray(response.data) ? response.data : []);
        setRequiredActionError(false);
      })
      .catch(() => setRequiredActionError(true));
  }, [accessToken, activeTab, editing, id]);

  const toggleRequiredAction = async (action: RequiredAction) => {
    if (!canManageUsers || !accessToken || !id) return;
    setRequiredActionBusy(action.key);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/required-actions/users/${encodeURIComponent(id)}/${encodeURIComponent(action.key)}`,
        method: action.assigned ? "DELETE" : "POST",
      });
      if (response.status >= 300) throw new Error();
      setRequiredActions((current) =>
        current.map((value) =>
          value.key === action.key ? { ...value, assigned: !value.assigned } : value,
        ),
      );
    } catch {
      setRequiredActionError(true);
    } finally {
      setRequiredActionBusy(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!canManageUsers || !accessToken || !id) return;
    setLoggingOutAll(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(getValues("username"))}/sessions`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setSessionsVersion((value) => value + 1);
    } catch {
      setError(true);
    } finally {
      setLoggingOutAll(false);
      setShowLogoutAllConfirm(false);
    }
  };

  const unlockUser = async () => {
    if (!canManageUsers || !accessToken || !id) return;
    setUnlocking(true);
    setError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/unlock`,
        method: "POST",
      });
      if (response.status >= 300) throw new Error();
      setSecurityState((state) => ({
        ...state,
        locked: false,
        lockedUntil: null,
        failedLoginCount: 0,
      }));
    } catch {
      setError(true);
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<PageResponse<Role>>(accessToken, { url: "/api/admin/roles?page=0&size=100" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setAvailableRoles(response.data.content);
      })
      .catch(() => setError(true));
  }, [accessToken]);

  const toggleRole = (role: string) => {
    if (!canManageUsers) return;
    const roles = getValues("roles");
    setValue(
      "roles",
      roles.includes(role) ? roles.filter((value) => value !== role) : [...roles, role],
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!canManageUsers || !file || !accessToken || !id) return;
    setAvatarError(null);
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setAvatarError(copy.avatarHelp);
      return;
    }
    try {
      const image = await createImageBitmap(file);
      const tooLarge =
        image.width > 4096 || image.height > 4096 || image.width * image.height > 4_000_000;
      image.close();
      if (tooLarge) {
        setAvatarError(copy.avatarHelp);
        return;
      }
    } catch {
      setAvatarError(copy.avatarHelp);
      return;
    }
    setAvatarSaving(true);
    setError(false);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await adminRequest<User>(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/avatar`,
        method: "PUT",
        data,
      });
      if (response.status >= 300) {
        if (problemViolations(response.data).some(({ field }) => field === "avatar")) {
          setAvatarError(copy.avatarHelp);
          return;
        }
        throw new Error();
      }
      setAvatarUrl(response.data.avatarUrl);
    } catch {
      setError(true);
    } finally {
      setAvatarSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (!canManageUsers || !accessToken || !id) return;
    setAvatarSaving(true);
    setError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/avatar`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setAvatarUrl(null);
    } catch {
      setError(true);
    } finally {
      setAvatarSaving(false);
    }
  };

  const sendActionEmail = actionForm.handleSubmit(async ({ action, lifespan }) => {
    if (!canManageUsers || !accessToken || !id) return;
    setActionSent(false);
    setActionError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/execute-actions-email?lifespan=${encodeURIComponent(lifespan)}`,
        method: "PUT",
        data: [action],
      });
      if (response.status >= 300) throw new Error();
      setActionSent(true);
    } catch {
      setActionError(true);
    }
  });

  const resetTotp = async () => {
    if (!canManageUsers || !accessToken || !id) return;
    setTotpResetting(true);
    setTotpResetError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/totp`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setTotpEnabled(false);
    } catch {
      setTotpResetError(true);
    } finally {
      setTotpResetting(false);
      setShowTotpResetConfirm(false);
    }
  };

  const impersonate = async () => {
    if (!canImpersonateUsers || !accessToken || !id || impersonationBusy) return;
    setImpersonationBusy(true);
    try {
      const response = await adminRequest<{ url: string }>(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/impersonation`,
        method: "POST",
      });
      if (response.status >= 300) throw new Error();
      window.location.assign(response.data.url);
    } catch {
      setError(true);
      setImpersonationBusy(false);
    }
  };

  const submit = async (values: UserFormValues) => {
    if (!canManageUsers || !accessToken) return;
    setSaving(true);
    setError(false);
    try {
      const response = await adminRequest<User>(accessToken, {
        url: editing ? `/api/admin/users/${encodeURIComponent(id ?? "")}` : "/api/admin/users",
        method: editing ? "PUT" : "POST",
        data: {
          username: values.username,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim() || null,
          emailVerified: values.emailVerified,
          password: editing ? undefined : values.password,
          ...(!editing && values.temporaryPassword !== undefined
            ? { temporary: values.temporaryPassword }
            : {}),
          enabled: values.enabled,
          roles: values.roles,
        },
      });
      if (response.status >= 300) {
        applyProblemToForm(response.data, setFieldError, {
          fields: ["username", "firstName", "lastName", "email", "password", "roles"],
          fallbackMessage: ({ field }, problem) =>
            problem.errorCode === "user_duplicate_username"
              ? validation.usernameDuplicate
              : problem.errorCode === "user_duplicate_email"
                ? validation.emailDuplicate
                : field === "password"
                  ? validation.password
                  : field === "roles"
                    ? validation.roles
                    : validation.required,
        });
        throw new Error();
      }
      const savedUser = response.data;
      if (editing && values.password) {
        const passwordResponse = await adminRequest(accessToken, {
          url: `/api/admin/users/${encodeURIComponent(id ?? "")}/password`,
          method: "PUT",
          data: {
            password: values.password,
            ...(!dirtyFields.temporaryPassword ? {} : { temporary: values.temporaryPassword }),
          },
        });
        if (passwordResponse.status >= 300) {
          applyProblemToForm(passwordResponse.data, setFieldError, {
            fields: ["password"],
            fallbackMessage: validation.password,
          });
          throw new Error();
        }
      }
      if (profileDefinitions.length > 0) {
        const profileResponse = await adminRequest<ProfileAttributes>(accessToken, {
          url: `/api/admin/users/${encodeURIComponent(String(savedUser.id))}/profile-attributes`,
          method: "PUT",
          data: { attributes: values.profile },
        });
        if (profileResponse.status >= 300) {
          setProfileAttributesError(true);
          throw new Error();
        }
        setValue("profile", profileResponse.data.attributes ?? {}, { shouldDirty: false });
      }
      if (editing && typeof response.data.enabled === "boolean") {
        setValue("enabled", response.data.enabled, { shouldDirty: false });
        setSecurityState((state) => ({
          ...state,
          locked: response.data.locked ?? state.locked,
          lockedUntil: response.data.lockedUntil ?? state.lockedUntil,
          failedLoginCount: response.data.failedLoginCount ?? state.failedLoginCount,
          mustChangePassword: response.data.mustChangePassword ?? state.mustChangePassword,
          temporaryPassword: response.data.temporaryPassword ?? state.temporaryPassword,
        }));
      }
      router.push(editing && id ? `/admin/users/${encodeURIComponent(id)}/${tab}` : `/admin/users`);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!editing || !accessToken || !id || !access?.manageUsers || saving) return;
    const nextEnabled = !enabled;
    setSaving(true);
    setError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}/enabled`,
        method: "PUT",
        data: { enabled: nextEnabled },
      });
      if (response.status >= 300) throw new Error();
      setValue("enabled", nextEnabled, { shouldDirty: false });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!canManageUsers || !accessToken || !id) return;
    setSaving(true);
    setError(false);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(id)}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      router.push("/admin/users");
    } catch {
      setError(true);
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const updateProfileValue = (name: string, value: string, multivalued: boolean) => {
    setValue(
      "profile",
      {
        ...profileValues,
        [name]: multivalued ? value.split("\n") : [value],
      },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const profileFields = renderedProfileDefinitions.length > 0 && (
    <Card className="admin-panel-card">
      <Card.Body className="d-grid gap-3">
        <div>
          <h2 className="h5 mb-1">{dictionary.admin.userProfileSettings.title}</h2>
          <p className="text-body-secondary mb-0">
            {dictionary.admin.userProfileSettings.subtitle}
          </p>
        </div>
        {renderedProfileDefinitions.map((definition) => {
          const values = profileValues[definition.name] ?? [];
          const value = definition.multivalued ? values.join("\n") : (values[0] ?? "");
          const profileError =
            errors.profile && typeof errors.profile === "object"
              ? (errors.profile as Record<string, { message?: string }>)[definition.name]?.message
              : undefined;
          const controlId = `user-profile-${definition.name}`;
          const isBuiltIn = definition.builtIn;
          const baseField = ["username", "firstName", "lastName", "email"].includes(
            definition.name,
          );
          if (isBuiltIn && !baseField) return null;
          if (baseField) {
            const fieldName = definition.name as "username" | "firstName" | "lastName" | "email";
            return (
              <Form.Group controlId={controlId} key={definition.name}>
                <Form.Label>
                  {definition.displayName}
                  {definition.required ? " *" : ""}
                </Form.Label>
                <Form.Control
                  type={definition.type === "EMAIL" ? "email" : "text"}
                  disabled={!canManageUsers}
                  required={definition.required}
                  isInvalid={Boolean(errors[fieldName])}
                  {...register(fieldName)}
                />
                <Form.Control.Feedback type="invalid">
                  {errors[fieldName]?.message}
                </Form.Control.Feedback>
                {definition.description && <Form.Text>{definition.description}</Form.Text>}
              </Form.Group>
            );
          }
          return (
            <Form.Group controlId={controlId} key={definition.name}>
              <Form.Label>
                {definition.displayName}
                {definition.required ? " *" : ""}
              </Form.Label>
              {definition.type === "BOOLEAN" ? (
                <Form.Select
                  value={value}
                  isInvalid={Boolean(profileError)}
                  disabled={!canManageUsers}
                  required={definition.required}
                  onChange={(event) =>
                    updateProfileValue(definition.name, event.target.value, false)
                  }
                >
                  <option value="">—</option>
                  <option value="true">{dictionary.admin.common.yes}</option>
                  <option value="false">{dictionary.admin.common.no}</option>
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
                  disabled={!canManageUsers}
                  required={definition.required}
                  minLength={definition.minLength ?? undefined}
                  maxLength={definition.maxLength ?? undefined}
                  onChange={(event) =>
                    updateProfileValue(definition.name, event.target.value, definition.multivalued)
                  }
                />
              )}
              {profileError && (
                <Form.Control.Feedback type="invalid">{profileError}</Form.Control.Feedback>
              )}
              {definition.description && <Form.Text>{definition.description}</Form.Text>}
              {definition.multivalued && (
                <Form.Text>{dictionary.admin.userProfileSettings.multivaluedHelp}</Form.Text>
              )}
            </Form.Group>
          );
        })}
      </Card.Body>
    </Card>
  );

  if (loading) return <LoadingState />;
  if (editing && error) return <ErrorState message={copy.notFound} />;
  const userBaseUrl = `/admin/users/${encodeURIComponent(id ?? "")}`;
  const userTabs = [
    { key: "details", label: copy.details, href: `${userBaseUrl}/details` },
    {
      key: "credentials",
      label: copy.credentials,
      href: `${userBaseUrl}/credentials`,
    },
    { key: "roles", label: copy.roleMappings, href: `${userBaseUrl}/roles` },
    { key: "groups", label: dictionary.admin.nav.groups, href: `${userBaseUrl}/groups` },
    { key: "sessions", label: copy.sessions, href: `${userBaseUrl}/sessions` },
    { key: "consents", label: copy.consents, href: `${userBaseUrl}/consents` },
    ...(access?.viewEvents
      ? [{ key: "events", label: dictionary.admin.events.title, href: `${userBaseUrl}/events` }]
      : []),
  ];
  return (
    <>
      {editing && (
        <div className="admin-user-detail-header">
          <AdminBreadcrumb
            items={[{ label: copy.users, href: `/admin/users` }, { label: getValues("username") }]}
          />
          <div className="admin-detail-heading">
            <div>
              <h1 className="h3 mb-1">{getValues("username")}</h1>
              <div className="text-body-secondary">{copy.user}</div>
            </div>
            {(canManageUsers || canImpersonateUsers) && (
              <div className="d-flex flex-wrap gap-2">
                {canImpersonateUsers && (
                  <Button
                    type="button"
                    variant="info"
                    disabled={impersonationBusy}
                    onClick={() => void impersonate()}
                  >
                    {impersonationBusy ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="impersonate" />
                    )}
                    {copy.impersonate}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={enabled ? "warning" : "success"}
                  disabled={saving}
                  onClick={() => void toggleEnabled()}
                >
                  {saving ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action={enabled ? "disable" : "enable"} />
                  )}
                  {enabled ? copy.disable : copy.enable}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={saving}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <AdminActionIcon action="delete" />
                  {copy.delete}
                </Button>
              </div>
            )}
          </div>
          <DetailTabs tabs={userTabs} active={activeTab} />
        </div>
      )}
      <Form
        className={editing ? undefined : "admin-create-form"}
        noValidate
        onSubmit={handleSubmit(submit)}
      >
        {error && <Alert variant="danger">{copy.saveError}</Alert>}
        {profileAttributesError && (
          <Alert variant="danger">{dictionary.admin.userProfileSettings.error}</Alert>
        )}

        {!editing && (
          <Card className="admin-panel-card admin-create-card">
            <Card.Body className="d-grid gap-4">
              <Form.Check
                type="switch"
                label={copy.enabled}
                checked={enabled}
                disabled={!canManageUsers}
                onChange={(e) => setValue("enabled", e.target.checked, { shouldDirty: true })}
              />
              <Form.Group>
                <Form.Label>{copy.password}</Form.Label>
                <Form.Control
                  type="password"
                  disabled={!canManageUsers}
                  isInvalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.password?.message}
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group>
                <Form.Label>{copy.roles}</Form.Label>
                <div className="admin-role-grid">
                  {availableRoles.map((role) => (
                    <label
                      className={`admin-role-option ${roles.includes(role.name) ? "selected" : ""}`}
                      key={role.name}
                    >
                      <Form.Check
                        type="checkbox"
                        checked={roles.includes(role.name)}
                        disabled={!canManageUsers}
                        onChange={() => toggleRole(role.name)}
                      />
                      <span className="font-monospace">{role.name}</span>
                    </label>
                  ))}
                </div>
                <Form.Text>{copy.rolesHelp}</Form.Text>
                {errors.roles && (
                  <div className="invalid-feedback d-block">{errors.roles.message}</div>
                )}
              </Form.Group>
              <div>
                <Form.Check
                  type="switch"
                  label={copy.temporaryPassword}
                  disabled={!canManageUsers}
                  {...register("temporaryPassword")}
                />
                <Form.Text>{copy.temporaryPasswordHelp}</Form.Text>
              </div>
            </Card.Body>
          </Card>
        )}

        {!editing && profileFields}

        {editing && activeTab === "details" && (
          <Card className="admin-panel-card">
            <Card.Body className="d-grid gap-4">
              {editing && (
                <div className="d-flex align-items-center gap-3 pb-3 border-bottom">
                  {avatarUrl ? (
                    <Image
                      alt=""
                      className="rounded-circle object-fit-cover admin-user-avatar"
                      height={64}
                      src={apiUrl(avatarUrl)}
                      unoptimized
                      width={64}
                    />
                  ) : (
                    <span className="avatar-placeholder admin-user-avatar">
                      {getValues("username").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold">{getValues("username")}</div>
                    <div className="small text-body-secondary">{copy.avatarHelp}</div>
                  </div>
                  <label className="btn btn-sm btn-primary mb-0">
                    <AdminActionIcon action="upload" />
                    {copy.uploadAvatar}
                    <input
                      className="visually-hidden"
                      accept="image/jpeg,image/png"
                      disabled={!canManageUsers || avatarSaving}
                      onChange={(e) => uploadAvatar(e.target.files?.[0])}
                      type="file"
                    />
                  </label>
                  {avatarUrl && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!canManageUsers || avatarSaving}
                      onClick={() => setShowAvatarDeleteConfirm(true)}
                      type="button"
                    >
                      <AdminActionIcon action="delete" />
                      {copy.removeAvatar}
                    </Button>
                  )}
                </div>
              )}
              {avatarError && (
                <Alert variant="danger" className="mb-0">
                  {avatarError}
                </Alert>
              )}
              <div className="account-metadata-panel d-flex flex-wrap align-items-center gap-3">
                <div>
                  <div className="fw-semibold">{copy.securityStatus}</div>
                  <div className="small text-body-secondary">
                    {securityState.locked ? copy.locked : copy.unlocked} · {copy.failedLogins}:{" "}
                    {securityState.failedLoginCount}
                    {securityState.lockedUntil &&
                      ` · ${new Date(securityState.lockedUntil).toLocaleString(locale)}`}
                  </div>
                  {(securityState.mustChangePassword || securityState.temporaryPassword) && (
                    <div className="small text-warning">{copy.passwordChangeRequired}</div>
                  )}
                </div>
                {securityState.locked && access?.manageUsers && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={unlocking}
                    onClick={() => void unlockUser()}
                  >
                    {unlocking ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="unlock" />
                    )}
                    {copy.unlock}
                  </Button>
                )}
              </div>
              <Form.Check
                type="switch"
                label={copy.emailVerified}
                disabled={!canManageUsers}
                {...register("emailVerified")}
              />
              <Form.Check
                type="switch"
                label={copy.enabled}
                checked={enabled}
                disabled={!canManageUsers}
                onChange={(e) => setValue("enabled", e.target.checked, { shouldDirty: true })}
              />
              {editing && createdAt && updatedAt && (
                <div className="account-metadata-panel">
                  <ReadOnlyMetadata
                    items={[
                      { label: copy.createdAt, value: new Date(createdAt).toLocaleString(locale) },
                      { label: copy.updatedAt, value: new Date(updatedAt).toLocaleString(locale) },
                    ]}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {editing && activeTab === "details" && profileFields}

        {editing && activeTab === "credentials" && (
          <div className="d-grid gap-3">
            <Card className="admin-panel-card">
              <Card.Body>
                <h2 className="h5 mb-1">{editing ? copy.resetPassword : copy.password}</h2>
                <p className="small text-body-secondary mb-3">
                  {editing ? copy.resetPasswordHelp : ""}
                </p>
                <Form.Group>
                  <Form.Label>{editing ? copy.newPassword : copy.password}</Form.Label>
                  <Form.Control
                    type="password"
                    disabled={!canManageUsers}
                    isInvalid={Boolean(errors.password)}
                    {...register("password")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Check
                  type="switch"
                  label={copy.temporaryPassword}
                  disabled={!canManageUsers}
                  {...register("temporaryPassword")}
                />
                <Form.Text>{copy.temporaryPasswordHelp}</Form.Text>
              </Card.Body>
            </Card>
            <AdminPasskeyInventory
              accessToken={accessToken}
              userId={id ?? undefined}
              canManage={canManageUsers}
              copy={copy}
              validation={validation}
            />
            <Card className="admin-panel-card">
              <Card.Body className="d-grid gap-3">
                <div>
                  <h2 className="h5 mb-1">{copy.requiredActions}</h2>
                  <p className="small text-body-secondary mb-0">{copy.requiredActionsHelp}</p>
                </div>
                {requiredActionError && <Alert variant="danger">{copy.operationError}</Alert>}
                {requiredActions.map((action) => (
                  <Form.Check
                    key={action.key}
                    type="switch"
                    label={action.displayName}
                    checked={action.assigned}
                    disabled={
                      !canManageUsers ||
                      !action.enabled ||
                      action.globalPolicy ||
                      requiredActionBusy !== null
                    }
                    onChange={() => void toggleRequiredAction(action)}
                  />
                ))}
              </Card.Body>
            </Card>
            <Card className="admin-panel-card">
              <Card.Body className="d-grid gap-3">
                <div>
                  <h2 className="h5 mb-1">{copy.credentialReset}</h2>
                  <p className="small text-body-secondary mb-0">{copy.credentialResetHelp}</p>
                </div>
                {actionSent && <Alert variant="success">{copy.actionEmailSent}</Alert>}
                {actionError && <Alert variant="danger">{copy.operationError}</Alert>}
                <Form.Group>
                  <Form.Label>{copy.requiredAction}</Form.Label>
                  <Form.Select disabled={!canManageUsers} {...actionForm.register("action")}>
                    <option value="UPDATE_PASSWORD">{copy.updatePasswordAction}</option>
                    <option value="VERIFY_EMAIL">{copy.verifyEmailAction}</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>{copy.actionLifespan}</Form.Label>
                  <Form.Select disabled={!canManageUsers} {...actionForm.register("lifespan")}>
                    <option value="1800">{copy.thirtyMinutes}</option>
                    <option value="3600">{copy.oneHour}</option>
                    <option value="43200">{copy.twelveHours}</option>
                    <option value="86400">{copy.oneDay}</option>
                  </Form.Select>
                </Form.Group>
                <div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canManageUsers || actionForm.formState.isSubmitting}
                    onClick={() => void sendActionEmail()}
                  >
                    {actionForm.formState.isSubmitting ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <AdminActionIcon action="send" />
                    )}
                    {copy.sendActionEmail}
                  </Button>
                </div>
              </Card.Body>
            </Card>
            <Card className="admin-panel-card">
              <Card.Body className="d-grid gap-3">
                <div>
                  <h2 className="h5 mb-1">{copy.resetAuthenticator}</h2>
                  <p className="small text-body-secondary mb-0">{copy.resetAuthenticatorHelp}</p>
                </div>
                {totpResetError && (
                  <Alert variant="danger" className="mb-0">
                    {copy.operationError}
                  </Alert>
                )}
                <div>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!canManageUsers || !totpEnabled || totpResetting}
                    onClick={() => setShowTotpResetConfirm(true)}
                  >
                    <AdminActionIcon action="delete" />
                    {copy.resetAuthenticator}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {editing && activeTab === "roles" && (
          <Card className="admin-panel-card">
            <Card.Body>
              <h2 className="h5 mb-3">{copy.roles}</h2>
              <p className="small text-body-secondary mb-3">{copy.assignedRolesHelp}</p>
              <div className="admin-role-grid">
                {availableRoles.map((role) => (
                  <label
                    className={`admin-role-option ${roles.includes(role.name) ? "selected" : ""}`}
                    key={role.name}
                  >
                    <Form.Check
                      type="checkbox"
                      checked={roles.includes(role.name)}
                      disabled={!canManageUsers}
                      onChange={() => toggleRole(role.name)}
                    />
                    <span className="font-monospace">{role.name}</span>
                  </label>
                ))}
              </div>
              <Form.Text>{copy.rolesHelp}</Form.Text>
              {errors.roles && (
                <div className="invalid-feedback d-block">{errors.roles.message}</div>
              )}
              <div className="mt-4">
                <h3 className="h6">{copy.groupRoles}</h3>
                {roleView.groupMappings.length === 0 ? (
                  <p className="small text-body-secondary mb-0">{copy.noGroupRoles}</p>
                ) : (
                  <div className="d-grid gap-2">
                    {roleView.groupMappings.map((mapping) => (
                      <div
                        className="border rounded p-2"
                        key={`${mapping.groupId}-${mapping.groupPath}`}
                      >
                        <div className="small fw-semibold">{mapping.groupPath}</div>
                        <div>
                          {mapping.roles.map((role) => (
                            <span className="badge text-bg-secondary me-1" key={role}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="h6">{copy.inheritedRoles}</h3>
                {roleView.inheritedRoles.length === 0 ? (
                  <p className="small text-body-secondary mb-0">{copy.noInheritedRoles}</p>
                ) : (
                  <div>
                    {roleView.inheritedRoles.map((role) => (
                      <span className="badge text-bg-secondary me-1" key={role}>
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="h6">{copy.effectiveRoles}</h3>
                <div>
                  {roleView.effectiveRoles.map((role) => (
                    <span className="badge text-bg-primary me-1" key={role}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>
        )}

        {editing && id && activeTab === "groups" && (
          <UserGroups dictionary={dictionary} userId={id} />
        )}

        {editing && id && activeTab === "sessions" && (
          <div className="d-grid gap-3">
            {access?.manageUsers && (
              <div className="d-flex justify-content-end">
                <Button
                  variant="danger"
                  type="button"
                  disabled={loggingOutAll}
                  onClick={() => setShowLogoutAllConfirm(true)}
                >
                  {loggingOutAll ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="logout" />
                  )}
                  {copy.signOutAllUser}
                </Button>
              </div>
            )}
            <EntityRelatedData
              resource="sessions"
              url={`/api/admin/users/${encodeURIComponent(id)}/sessions`}
              locale={locale}
              dictionary={dictionary}
              canManage={access?.manageUsers ?? false}
              refreshKey={sessionsVersion}
            />
          </div>
        )}
        {editing && id && activeTab === "consents" && (
          <EntityRelatedData
            resource="consents"
            url={`/api/admin/users/${encodeURIComponent(id)}/consents`}
            locale={locale}
            dictionary={dictionary}
            canManage={access?.manageConsents ?? false}
          />
        )}
        {editing && id && activeTab === "events" && (
          <EntityRelatedData
            resource="events"
            url={`/api/admin/users/${encodeURIComponent(id)}/events`}
            locale={locale}
            dictionary={dictionary}
          />
        )}

        {(!editing || ["details", "credentials", "roles"].includes(activeTab)) && (
          <div className={`admin-create-actions${editing ? " mt-3" : ""}`}>
            <Button type="button" variant="secondary" onClick={() => router.push(`/admin/users`)}>
              <AdminActionIcon action="cancel" />
              {dictionary.admin.common.cancel}
            </Button>
            <Button type="submit" disabled={!canManageUsers || saving}>
              {saving ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <AdminActionIcon action="save" />
              )}
              {dictionary.admin.common.save}
            </Button>
          </div>
        )}
      </Form>
      <ConfirmModal
        busy={avatarSaving}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.removeAvatar}
        message={copy.removeAvatarConfirm}
        onCancel={() => setShowAvatarDeleteConfirm(false)}
        onConfirm={() => {
          setShowAvatarDeleteConfirm(false);
          void removeAvatar();
        }}
        show={showAvatarDeleteConfirm}
      />
      <ConfirmModal
        busy={saving}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.delete}
        message={copy.deleteUserConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void deleteUser()}
        show={showDeleteConfirm}
      />
      <ConfirmModal
        busy={totpResetting}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.resetAuthenticator}
        message={copy.resetAuthenticatorConfirm}
        onCancel={() => setShowTotpResetConfirm(false)}
        onConfirm={() => void resetTotp()}
        show={showTotpResetConfirm}
      />
      <ConfirmModal
        busy={loggingOutAll}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.signOutAllUser}
        message={copy.signOutAllConfirm}
        onCancel={() => setShowLogoutAllConfirm(false)}
        onConfirm={() => void logoutAllSessions()}
        show={showLogoutAllConfirm}
      />
    </>
  );
}

function AdminPasskeyInventory({
  accessToken,
  userId,
  canManage,
  copy,
  validation,
}: {
  accessToken: string | null;
  userId?: string;
  canManage: boolean;
  copy: Dictionary["admin"]["resources"];
  validation: Dictionary["admin"]["common"]["validation"];
}) {
  const [items, setItems] = useState<AdminPasskey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<AdminPasskey | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    setLoading(true);
    try {
      const response = await adminRequest<{ content?: AdminPasskey[] }>(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(userId)}/webauthn/credentials?page=0&size=20`,
      });
      if (response.status >= 300) throw new Error();
      setItems(response.data.content ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rename = async (credential: AdminPasskey, label: string) => {
    if (!accessToken || !userId) return;
    setBusy(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(userId)}/webauthn/credentials/${encodeURIComponent(credential.credentialId)}`,
        method: "PUT",
        data: { label },
      });
      if (response.status >= 300) throw new Error();
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!accessToken || !userId || !pending) return;
    setBusy(true);
    try {
      const response = await adminRequest(accessToken, {
        url: `/api/admin/users/${encodeURIComponent(userId)}/webauthn/credentials/${encodeURIComponent(pending.credentialId)}`,
        method: "DELETE",
      });
      if (response.status >= 300) throw new Error();
      setPending(null);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="admin-panel-card">
        <Card.Body className="d-grid gap-3">
          <div>
            <h2 className="h5 mb-1">{copy.passkeys}</h2>
            <p className="small text-body-secondary mb-0">{copy.passkeysHelp}</p>
          </div>
          {error && <Alert variant="danger">{copy.operationError}</Alert>}
          {loading ? (
            <div role="status">{copy.loading}</div>
          ) : items.length === 0 ? (
            <div className="small text-body-secondary">{copy.noPasskeys}</div>
          ) : (
            items.map((credential) => (
              <AdminPasskeyRow
                key={credential.credentialId}
                credential={credential}
                copy={copy}
                validation={validation}
                canManage={canManage}
                busy={busy}
                onRename={rename}
                onRemove={setPending}
              />
            ))
          )}
        </Card.Body>
      </Card>
      <ConfirmModal
        show={pending !== null}
        message={copy.passkeyDeleteConfirm}
        cancelLabel={copy.cancel}
        confirmLabel={copy.delete}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function AdminPasskeyRow({
  credential,
  copy,
  validation,
  canManage,
  busy,
  onRename,
  onRemove,
}: {
  credential: AdminPasskey;
  copy: Dictionary["admin"]["resources"];
  validation: Dictionary["admin"]["common"]["validation"];
  canManage: boolean;
  busy: boolean;
  onRename: (credential: AdminPasskey, label: string) => Promise<void>;
  onRemove: (credential: AdminPasskey) => void;
}) {
  const form = useForm<{ label: string }>({
    resolver: zodResolver(
      z.object({
        label: z.string().trim().min(1, validation.required).max(100, validation.max100),
      }),
    ),
    defaultValues: { label: credential.label || copy.unnamedPasskey },
  });
  const submit = form.handleSubmit(({ label }) => onRename(credential, label));
  return (
    <div className="border rounded p-3">
      <div className="d-flex justify-content-between gap-3 flex-wrap">
        <div>
          <strong>{credential.label || copy.unnamedPasskey}</strong>
          <div className="small text-body-secondary mt-1">
            {copy.passkeyCreated}: {new Date(credential.createdAt).toLocaleString()}
          </div>
          <div className="small text-body-secondary">
            {copy.passkeyLastUsed}: {new Date(credential.lastUsedAt).toLocaleString()}
          </div>
          {credential.signatureCount !== undefined && (
            <div className="small text-body-secondary">
              {credential.credentialType} · {copy.passkeySignatureCount}:{" "}
              {credential.signatureCount} · {copy.passkeyUserVerification}:{" "}
              {credential.uvInitialized ? copy.yes : copy.no}
            </div>
          )}
        </div>
        {canManage && (
          <Form onSubmit={submit} noValidate className="d-flex gap-2 align-items-start">
            <div>
              <Form.Control
                aria-label={copy.passkeyLabel}
                isInvalid={Boolean(form.formState.errors.label)}
                {...form.register("label")}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.label?.message}
              </Form.Control.Feedback>
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner animation="border" className="me-2" size="sm" aria-hidden="true" />}
              {copy.save}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => onRemove(credential)}
            >
              {busy && <Spinner animation="border" className="me-2" size="sm" aria-hidden="true" />}
              {copy.delete}
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}
