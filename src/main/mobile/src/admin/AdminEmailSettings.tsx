import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AdminApiError,
  getAdminEmailSettings,
  testAdminEmailConnection,
  updateAdminEmailSettings,
  type AdminEmailSettings as EmailSettingsResponse,
  type AdminEmailSettingsRequest,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type LoadError = "forbidden" | "offline" | "timeout" | "unauthorized" | "other";
type EmailField = "fromAddress" | "baseUrl" | "host" | "port" | "username" | "password";
type EmailValidation = Partial<Record<EmailField, string>>;

function errorKind(cause: unknown): LoadError {
  if (!(cause instanceof AdminApiError)) return "other";
  if (cause.status === 401) return "unauthorized";
  if (cause.status === 403) return "forbidden";
  if (cause.kind === "offline" || cause.kind === "timeout") return cause.kind;
  return "other";
}

function messageForError(
  kind: LoadError,
  dictionary: ReturnType<typeof useLocale>["dictionary"],
) {
  switch (kind) {
    case "forbidden":
      return dictionary.adminForbidden;
    case "offline":
      return dictionary.adminApiOfflineError;
    case "timeout":
      return dictionary.adminApiTimeoutError;
    case "unauthorized":
      return dictionary.apiUnauthorized;
    case "other":
      return dictionary.adminEmailSettingsError;
    default:
      return dictionary.apiFailure;
  }
}

function requestFromSettings(
  settings: EmailSettingsResponse,
): AdminEmailSettingsRequest {
  return {
    enabled: settings.enabled,
    fromAddress: settings.fromAddress ?? "",
    baseUrl: settings.baseUrl ?? "",
    host: settings.host ?? "",
    port: settings.port,
    username: settings.username ?? "",
    password: "",
    smtpAuth: settings.smtpAuth,
    starttls: settings.starttls,
    ssl: settings.ssl,
  };
}

function validate(settings: AdminEmailSettingsRequest, dictionary: ReturnType<typeof useLocale>["dictionary"]): EmailValidation {
  const errors: EmailValidation = {};
  const fromAddress = settings.fromAddress.trim();
  if (!fromAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress) || fromAddress.length > 255) {
    errors.fromAddress = dictionary.adminEmailValidationFrom;
  }
  const baseUrl = settings.baseUrl.trim();
  try {
    const parsed = new URL(baseUrl);
    if (!parsed.protocol || parsed.hash || baseUrl.length > 255) {
      errors.baseUrl = dictionary.adminEmailValidationBaseUrl;
    }
  } catch {
    errors.baseUrl = dictionary.adminEmailValidationBaseUrl;
  }
  if (!settings.host.trim() || settings.host.trim().length > 255) {
    errors.host = dictionary.adminEmailValidationHost;
  }
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
    errors.port = dictionary.adminEmailValidationPort;
  }
  if (settings.username.length > 255) {
    errors.username = dictionary.adminEmailValidationUsername;
  }
  if (settings.password.length > 1000) {
    errors.password = dictionary.adminEmailValidationPassword;
  }
  return errors;
}

export function AdminEmailSettings({
  accessToken,
  canManage,
  refreshAccessToken,
}: Readonly<{
  accessToken: string;
  canManage: boolean;
  refreshAccessToken?: () => Promise<string | null>;
}>) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { showNotice } = useMobileNotice();
  const [settings, setSettings] = useState<AdminEmailSettingsRequest | null>(null);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [validation, setValidation] = useState<EmailValidation>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const actionInProgress = useRef(false);

  const requestOptions = useCallback(
    () => ({ refreshAccessToken }),
    [refreshAccessToken],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getAdminEmailSettings(accessToken, requestOptions());
      setSettings(requestFromSettings(result));
      setPasswordConfigured(result.passwordConfigured);
      setValidation({});
      setSubmitted(false);
    } catch (cause) {
      setLoadError(errorKind(cause));
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestOptions]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const updateField = <K extends keyof AdminEmailSettingsRequest>(
    field: K,
    value: AdminEmailSettingsRequest[K],
  ) => {
    setSettings((current) => (current ? { ...current, [field]: value } : current));
    if (field in validation) {
      setValidation((current) => ({ ...current, [field]: undefined }));
    }
  };

  const beginAction = (action: "save" | "test") => {
    if (!settings || !canManage || actionInProgress.current) return null;
    setSubmitted(true);
    const nextValidation = validate(settings, dictionary);
    setValidation(nextValidation);
    if (Object.keys(nextValidation).length > 0) return null;
    actionInProgress.current = true;
    if (action === "save") setSaving(true);
    else setTesting(true);
    return settings;
  };

  const save = async () => {
    const current = beginAction("save");
    if (!current) return;
    try {
      const result = await updateAdminEmailSettings(
        accessToken,
        current,
        requestOptions(),
      );
      setSettings(requestFromSettings(result));
      setPasswordConfigured(result.passwordConfigured);
      setValidation({});
      setSubmitted(false);
      showNotice({ kind: "success", message: dictionary.adminEmailSettingsSaved });
    } catch (cause) {
      const kind = errorKind(cause);
      if (kind === "other" && cause instanceof AdminApiError && cause.status === 400) {
        setValidation({ fromAddress: dictionary.apiValidation });
      }
      showNotice({ kind: "error", message: messageForError(kind, dictionary) });
    } finally {
      actionInProgress.current = false;
      setSaving(false);
    }
  };

  const testConnection = async () => {
    const current = beginAction("test");
    if (!current) return;
    try {
      await testAdminEmailConnection(accessToken, current, requestOptions());
      showNotice({ kind: "success", message: dictionary.adminEmailTestSucceeded });
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          errorKind(cause) === "other"
            ? dictionary.adminEmailTestFailed
            : messageForError(errorKind(cause), dictionary),
      });
    } finally {
      actionInProgress.current = false;
      setTesting(false);
    }
  };

  const busy = saving || testing;
  const cardStyle = {
    alignSelf: "center" as const,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.lg,
    maxWidth: 720,
    padding: spacing.lg,
    width: "100%" as const,
  };
  const inputStyle = {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  } as const;

  const field = (
    name: EmailField,
    label: string,
    value: string,
    keyboardType: "default" | "email-address" | "url" | "number-pad" = "default",
    secureTextEntry = false,
  ) => (
    <View key={name} style={{ gap: spacing.xs }}>
      <Text style={{ color: palette.text, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={name === "fromAddress" ? "none" : "sentences"}
        autoComplete={name === "password" ? "off" : "off"}
        editable={canManage && !busy}
        keyboardType={keyboardType}
        onChangeText={(value) => {
          if (name === "port") {
            updateField("port", value === "" ? 0 : Number(value));
          } else {
            updateField(name, value);
          }
        }}
        placeholder={secureTextEntry ? dictionary.adminSmtpPassword : undefined}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={secureTextEntry}
        style={inputStyle}
        testID={`admin-email-${name}`}
        value={value}
      />
      {name === "password" && passwordConfigured ? (
        <Text style={{ color: palette.textMuted, fontSize: 13 }}>
          {dictionary.adminSmtpPasswordConfigured}
        </Text>
      ) : null}
      {submitted && validation[name] ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger, fontSize: 13 }}>
          {validation[name]}
        </Text>
      ) : null}
    </View>
  );

  const toggle = (
    fieldName: "enabled" | "smtpAuth" | "starttls" | "ssl",
    label: string,
  ) => (
    <View
      key={fieldName}
      style={{
        alignItems: "center",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 60,
      }}
    >
      <Text style={{ color: palette.text, flex: 1, fontSize: 16 }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: settings?.[fieldName] ?? false, disabled: !canManage || busy }}
        disabled={!canManage || busy}
        onValueChange={(value) => updateField(fieldName, value)}
        trackColor={{ false: palette.border, true: palette.primary }}
        value={settings?.[fieldName] ?? false}
      />
    </View>
  );

  const actionButton = (label: string, action: "save" | "test") => {
    const actionBusy = action === "save" ? saving : testing;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || !canManage }}
        disabled={busy || !canManage}
        key={action}
        onPress={() => void (action === "save" ? save() : testConnection())}
        style={{
          alignItems: "center",
          backgroundColor: action === "save" ? palette.primary : palette.surfaceMuted,
          borderColor: action === "save" ? palette.primary : palette.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "center",
          minHeight: 48,
          opacity: busy && !actionBusy ? 0.6 : 1,
          paddingHorizontal: spacing.md,
        }}
        testID={`admin-email-${action}`}
      >
        {actionBusy ? (
          <ActivityIndicator accessibilityLabel={dictionary.loading} color={action === "save" ? palette.onPrimary : palette.primary} />
        ) : null}
        <Text style={{ color: action === "save" ? palette.onPrimary : palette.text, fontWeight: "700" }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  if (loading && !settings) {
    return (
      <View style={{ alignItems: "center", padding: spacing.xl }}>
        <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} />
      </View>
    );
  }

  if (loadError && !settings) {
    return (
      <View style={cardStyle}>
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {messageForError(loadError, dictionary)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={() => void load()}
          style={{ ...inputStyle, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
          testID="admin-email-retry"
        >
          {loading ? <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} /> : null}
          <Text style={{ color: palette.text, fontWeight: "600" }}>{dictionary.adminRetry}</Text>
        </Pressable>
      </View>
    );
  }

  if (!settings) return null;

  return (
    <View style={cardStyle}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>
          {dictionary.adminEmailSettingsTitle}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}>
          {dictionary.adminEmailSettingsDescription}
        </Text>
      </View>
      {loadError ? <Text accessibilityRole="alert" style={{ color: palette.danger }}>{messageForError(loadError, dictionary)}</Text> : null}
      {toggle("enabled", dictionary.adminEmailEnabled)}
      {field("fromAddress", dictionary.adminEmailFromAddress, settings.fromAddress, "email-address")}
      {field("baseUrl", dictionary.adminEmailBaseUrl, settings.baseUrl, "url")}
      {field("host", dictionary.adminSmtpHost, settings.host)}
      {field("port", dictionary.adminSmtpPort, String(settings.port), "number-pad")}
      {field("username", dictionary.adminSmtpUsernameField, settings.username)}
      {field("password", dictionary.adminSmtpPassword, settings.password, "default", true)}
      {toggle("smtpAuth", dictionary.adminSmtpAuthentication)}
      {toggle("starttls", dictionary.adminStartTls)}
      {toggle("ssl", dictionary.adminSslTls)}
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {actionButton(dictionary.adminEmailTestConnection, "test")}
        {actionButton(dictionary.adminSave, "save")}
      </View>
    </View>
  );
}
