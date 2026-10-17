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
  getNativeAdminLoginSettings,
  updateNativeAdminLoginSettings,
  type NativeAdminLoginSettings,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type LoadError = "forbidden" | "offline" | "timeout" | "unauthorized" | "other";

function errorKind(cause: unknown): LoadError {
  if (!(cause instanceof AdminApiError)) return "other";
  if (cause.status === 401) return "unauthorized";
  if (cause.status === 403) return "forbidden";
  if (cause.kind === "offline" || cause.kind === "timeout") return cause.kind;
  return "other";
}

function messageForError(
  error: LoadError,
  dictionary: ReturnType<typeof useLocale>["dictionary"],
) {
  switch (error) {
    case "forbidden":
      return dictionary.adminForbidden;
    case "offline":
      return dictionary.apiOffline;
    case "timeout":
      return dictionary.apiTimeout;
    case "unauthorized":
      return dictionary.apiUnauthorized;
    case "other":
      return dictionary.adminLoadError;
    default:
      return dictionary.apiFailure;
  }
}

export function AdminLoginPolicySettings({
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
  const [settings, setSettings] = useState<NativeAdminLoginSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState("");
  const [passwordLength, setPasswordLength] = useState("");
  const [failureLimit, setFailureLimit] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);

  const requestOptions = useCallback(
    () => ({ refreshAccessToken }),
    [refreshAccessToken],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getNativeAdminLoginSettings(
        accessToken,
        requestOptions(),
      );
      setSettings(result);
      setSessionTimeout(String(result.sessionTimeoutMinutes));
      setPasswordLength(String(result.passwordMinimumLength));
      setFailureLimit(String(result.bruteForceMaxFailures));
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

  const update = (changes: Partial<NativeAdminLoginSettings>) => {
    setSettings((current) => (current ? { ...current, ...changes } : current));
  };

  const parsedSessionTimeout = Number(sessionTimeout);
  const parsedPasswordLength = Number(passwordLength);
  const parsedFailureLimit = Number(failureLimit);
  const isValidInteger = (value: number, minimum: number, maximum: number) =>
    Number.isInteger(value) && value >= minimum && value <= maximum;
  const validSessionTimeout = isValidInteger(parsedSessionTimeout, 1, 1440);
  const validPasswordLength = isValidInteger(parsedPasswordLength, 8, 128);
  const validFailureLimit = isValidInteger(parsedFailureLimit, 1, 100);
  const otpRequirementValid = !settings?.otpRequired || settings.otpEnabled;
  const validationMessage = !otpRequirementValid
    ? dictionary.adminOtpRequiredNeedsEnabled
    : dictionary.apiValidation;

  const save = async () => {
    if (!settings || !canManage || saveInProgress.current) return;
    setSubmitted(true);
    if (
      !validSessionTimeout ||
      !validPasswordLength ||
      !validFailureLimit ||
      !otpRequirementValid
    ) {
      return;
    }

    saveInProgress.current = true;
    setSaving(true);
    const payload: NativeAdminLoginSettings = {
      ...settings,
      sessionTimeoutMinutes: parsedSessionTimeout,
      passwordMinimumLength: parsedPasswordLength,
      bruteForceMaxFailures: parsedFailureLimit,
    };
    try {
      const saved = await updateNativeAdminLoginSettings(
        accessToken,
        payload,
        requestOptions(),
      );
      setSettings(saved);
      setSessionTimeout(String(saved.sessionTimeoutMinutes));
      setPasswordLength(String(saved.passwordMinimumLength));
      setFailureLimit(String(saved.bruteForceMaxFailures));
      setSubmitted(false);
      showNotice({ kind: "success", message: dictionary.adminLoginPolicySaved });
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError
            ? messageForError(errorKind(cause), dictionary)
            : dictionary.apiFailure,
      });
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const fieldStyle = {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  } as const;

  const numericField = (
    label: string,
    value: string,
    onChangeText: (next: string) => void,
    valid: boolean,
    testID: string,
  ) => (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: "600" }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        editable={!saving && canManage}
        keyboardType="number-pad"
        onChangeText={onChangeText}
        style={fieldStyle}
        testID={testID}
        value={value}
      />
      {submitted && !valid ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {dictionary.apiValidation}
        </Text>
      ) : null}
    </View>
  );

  const toggle = (
    label: string,
    value: boolean,
    key: keyof NativeAdminLoginSettings,
  ) => (
    <View
      key={key}
      style={{
        alignItems: "center",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        justifyContent: "space-between",
        minHeight: 58,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: palette.text, flex: 1, fontSize: 15 }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: saving || !canManage }}
        disabled={saving || !canManage}
        onValueChange={(next) => update({ [key]: next })}
        trackColor={{ false: palette.border, true: palette.primary }}
        value={value}
      />
    </View>
  );

  const cardStyle = {
    alignSelf: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.lg,
    maxWidth: 720,
    padding: spacing.lg,
    width: "100%",
  } as const;

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
          style={{
            alignItems: "center",
            backgroundColor: palette.surfaceMuted,
            borderColor: palette.border,
            borderRadius: radii.sm,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
            minHeight: 48,
          }}
          testID="admin-login-policy-retry"
        >
          {loading ? <ActivityIndicator color={palette.primary} /> : null}
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {dictionary.adminRetry}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!settings) return null;

  return (
    <View style={cardStyle}>
      <View style={{ gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}
        >
          {dictionary.adminLoginPolicy}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}>
          {dictionary.adminLoginEmailDescription}
        </Text>
      </View>
      {loadError ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {messageForError(loadError, dictionary)}
        </Text>
      ) : null}
      {toggle(dictionary.adminRegistrationEnabled, settings.userRegistration, "userRegistration")}
      {toggle(dictionary.adminForgotPasswordEnabled, settings.forgotPassword, "forgotPassword")}
      {toggle(dictionary.adminRememberMeEnabled, settings.rememberMe, "rememberMe")}
      {toggle(dictionary.adminLoginWithEmail, settings.loginWithEmail, "loginWithEmail")}
      {toggle(dictionary.adminVerifyEmail, settings.verifyEmail, "verifyEmail")}
      {toggle(dictionary.adminBruteForceProtection, settings.bruteForceEnabled, "bruteForceEnabled")}
      {toggle(dictionary.adminOtpEnabled, settings.otpEnabled, "otpEnabled")}
      {toggle(dictionary.adminOtpRequired, settings.otpRequired, "otpRequired")}
      {toggle(dictionary.adminPasskeysEnabled, settings.passkeys, "passkeys")}
      {numericField(dictionary.adminSessionTimeout, sessionTimeout, setSessionTimeout, validSessionTimeout, "admin-login-session-timeout")}
      {numericField(dictionary.adminPasswordLength, passwordLength, setPasswordLength, validPasswordLength, "admin-login-password-length")}
      {numericField(dictionary.adminLoginFailureLimit, failureLimit, setFailureLimit, validFailureLimit, "admin-login-failure-limit")}
      {submitted && !otpRequirementValid ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {validationMessage}
        </Text>
      ) : null}
      {canManage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void save()}
          style={{
            alignItems: "center",
            backgroundColor: palette.primary,
            borderRadius: radii.sm,
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
          testID="admin-login-policy-save"
        >
          {saving ? <ActivityIndicator color={palette.onPrimary} /> : null}
          <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
            {dictionary.adminSave}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
