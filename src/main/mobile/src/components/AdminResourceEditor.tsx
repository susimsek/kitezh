import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

function ActionButton({
  label,
  busy,
  disabled = false,
  onPress,
  palette,
  secondary = false,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: secondary ? palette.surfaceMuted : palette.primary,
        borderColor: secondary ? palette.border : palette.primary,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.xs,
        justifyContent: "center",
        minHeight: 46,
        opacity: busy || disabled ? 0.7 : 1,
        paddingHorizontal: spacing.md,
      }}
    >
      {busy ? <ActivityIndicator color={secondary ? palette.primary : palette.onPrimary} /> : null}
      <Text style={{ color: secondary ? palette.text : palette.onPrimary, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export type AdminEditorResource =
  | "users"
  | "clients"
  | "scopes"
  | "roles"
  | "groups"
  | "identity-providers";

export type AdminEditorState = {
  resource: AdminEditorResource;
  id?: string;
  values: Record<string, string>;
};

type Field = {
  key: string;
  label: string;
  multiline?: boolean;
  secure?: boolean;
  required?: boolean;
};

const fieldSets: Record<AdminEditorResource, Field[]> = {
  users: [
    { key: "username", label: "Username", required: true },
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "password", label: "Initial password", secure: true },
    { key: "roles", label: "Roles (comma separated)" },
  ],
  clients: [
    { key: "clientId", label: "Client ID", required: true },
    { key: "clientName", label: "Client name", required: true },
    { key: "scopes", label: "Scopes (comma separated)", required: true },
    { key: "redirectUris", label: "Redirect URIs (one per line)", multiline: true },
    { key: "postLogoutRedirectUris", label: "Post-logout URIs (one per line)", multiline: true },
  ],
  scopes: [
    { key: "name", label: "Name", required: true },
    { key: "displayName", label: "Display name" },
    { key: "description", label: "Description", multiline: true },
  ],
  roles: [
    { key: "name", label: "Name (ROLE_...)", required: true },
    { key: "description", label: "Description", multiline: true },
  ],
  groups: [
    { key: "name", label: "Name", required: true },
    { key: "parentId", label: "Parent group ID" },
  ],
  "identity-providers": [
    { key: "registrationId", label: "Registration ID", required: true },
    { key: "providerType", label: "Provider type (oidc, saml, google...)", required: true },
    { key: "displayName", label: "Display name", required: true },
    { key: "alias", label: "Alias", required: true },
    { key: "iconKey", label: "Icon key", required: true },
    { key: "clientId", label: "Provider client ID" },
    { key: "clientSecret", label: "Provider client secret", secure: true },
    { key: "authorizationUri", label: "Authorization URI" },
    { key: "tokenUri", label: "Token URI" },
    { key: "userInfoUri", label: "User-info URI" },
    { key: "jwkSetUri", label: "JWK set URI" },
    { key: "issuerUri", label: "Issuer URI" },
    { key: "userNameAttribute", label: "User-name claim" },
    { key: "scopes", label: "Provider scopes" },
  ],
};

const defaultLabels: Record<AdminEditorResource, string> = {
  users: "User",
  clients: "Client",
  scopes: "Client scope",
  roles: "Role",
  groups: "Group",
  "identity-providers": "Identity provider",
};

export function AdminResourceEditor({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: AdminEditorState;
  onCancel: () => void;
  onSave: (values: Record<string, string>) => void;
  saving: boolean;
}) {
  const { palette } = useTheme();
  const { dictionary } = useLocale();
  const [values, setValues] = useState(initial.values);
  const fields = fieldSets[initial.resource];
  const localizedLabel = (field: Field) => {
    const labels: Record<string, string> = {
      name: dictionary.adminName,
      username: dictionary.adminUsername,
      firstName: dictionary.adminFirstName,
      lastName: dictionary.adminLastName,
      email: dictionary.adminEmail,
      description: dictionary.adminDescription,
      displayName: dictionary.adminDisplayName,
      clientId: dictionary.adminClientId,
      clientName: dictionary.adminClientName,
      scopes: dictionary.adminScopes,
      redirectUris: dictionary.adminRedirectUris,
      postLogoutRedirectUris: dictionary.adminPostLogoutRedirectUris,
      registrationId: dictionary.adminProviderRegistrationId,
      providerType: dictionary.adminProviderType,
      alias: dictionary.adminProviderAlias,
      iconKey: dictionary.adminProviderIcon,
      clientSecret: dictionary.adminProviderClientSecret,
      authorizationUri: dictionary.adminProviderAuthorizationUri,
      tokenUri: dictionary.adminProviderTokenUri,
      userInfoUri: dictionary.adminProviderUserInfoUri,
      jwkSetUri: dictionary.adminProviderJwkSetUri,
      issuerUri: dictionary.adminProviderIssuerUri,
      userNameAttribute: dictionary.adminProviderUserNameAttribute,
      password: dictionary.adminPassword,
      roles: dictionary.adminRolesInput,
      parentId: dictionary.adminParentId,
    };
    return labels[field.key] ?? field.label;
  };
  const invalid = useMemo(
    () =>
      fields.some((field) => field.required && !values[field.key]?.trim()) ||
      (initial.resource === "users" && !initial.id && (values.password?.length ?? 0) < 12),
    [fields, initial.id, initial.resource, values],
  );
  return (
    <View style={{ borderColor: palette.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
        {initial.id ? dictionary.adminEdit : dictionary.adminCreate} {defaultLabels[initial.resource]}
      </Text>
      {fields.map((field) => (
        <View key={field.key} style={{ gap: spacing.xs }}>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>{localizedLabel(field)}</Text>
          <TextInput
            autoCapitalize={field.key === "email" ? "none" : "sentences"}
            editable={!saving}
            multiline={field.multiline}
            onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
            placeholder={localizedLabel(field)}
            placeholderTextColor={palette.textMuted}
            secureTextEntry={field.secure}
            style={{
              borderColor: palette.border,
              borderRadius: radii.sm,
              borderWidth: 1,
              color: palette.text,
              minHeight: field.multiline ? 72 : 46,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.sm,
              textAlignVertical: field.multiline ? "top" : "center",
            }}
            value={values[field.key] ?? ""}
          />
        </View>
      ))}
      {invalid ? (
        <Text style={{ color: palette.danger }}>
          {initial.resource === "users" && !initial.id && (values.password?.length ?? 0) < 12
            ? dictionary.adminPasswordValidation
            : dictionary.adminRequired}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <ActionButton label={dictionary.cancel} busy={false} onPress={onCancel} palette={palette} secondary />
        <ActionButton
          label={dictionary.adminSave}
          busy={saving}
          disabled={invalid}
          onPress={() => onSave(values)}
          palette={palette}
        />
      </View>
    </View>
  );
}
