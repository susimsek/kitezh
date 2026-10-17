import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";

import {
  AdminApiError,
  getAdminLocalizationSettings,
  updateAdminLocalizationSettings,
  type AdminLocalizationSettings as AdminLocalizationSettingsDTO,
  type AdminLocalizationSettingsRequest,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type LoadError = "forbidden" | "offline" | "timeout" | "unauthorized" | "other";
type ValidationErrors = {
  defaultLocale?: string;
  supportedLocales?: string;
};

function getErrorKind(cause: unknown): LoadError {
  if (!(cause instanceof AdminApiError)) return "other";
  if (cause.status === 401) return "unauthorized";
  if (cause.status === 403) return "forbidden";
  if (cause.kind === "offline" || cause.kind === "timeout") return cause.kind;
  return "other";
}

function errorMessage(
  kind: LoadError,
  dictionary: ReturnType<typeof useLocale>["dictionary"],
  loading: boolean,
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
      return loading
        ? dictionary.adminLocalizationSettingsLoadError
        : dictionary.adminLocalizationSettingsSaveError;
    default:
      return dictionary.apiFailure;
  }
}

function validateSettings(
  settings: AdminLocalizationSettingsRequest,
  availableLocales: string[],
  dictionary: ReturnType<typeof useLocale>["dictionary"],
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!settings.defaultLocale.trim() || !availableLocales.includes(settings.defaultLocale)) {
    errors.defaultLocale = dictionary.adminLocalizationDefaultLocaleRequired;
  }
  if (settings.supportedLocales.length === 0) {
    errors.supportedLocales = dictionary.adminLocalizationSupportedRequired;
  } else if (!settings.supportedLocales.includes(settings.defaultLocale)) {
    errors.supportedLocales = dictionary.adminLocalizationDefaultMustBeSupported;
  }
  return errors;
}

export function AdminLocalizationSettings({
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
  const [settings, setSettings] = useState<AdminLocalizationSettingsDTO | null>(null);
  const [draft, setDraft] = useState<AdminLocalizationSettingsRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [validation, setValidation] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const actionInProgress = useRef(false);

  const requestOptions = useCallback(
    () => ({ refreshAccessToken }),
    [refreshAccessToken],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getAdminLocalizationSettings(accessToken, requestOptions());
      setSettings(result);
      setDraft({
        internationalizationEnabled: result.internationalizationEnabled,
        defaultLocale: result.defaultLocale,
        supportedLocales: [...result.supportedLocales],
      });
      setValidation({});
      setSubmitted(false);
    } catch (cause) {
      setLoadError(getErrorKind(cause));
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestOptions]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const save = async () => {
    if (!draft || !canManage || actionInProgress.current) return;
    setSubmitted(true);
    const errors = validateSettings(draft, settings?.availableLocales ?? [], dictionary);
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;

    actionInProgress.current = true;
    setSaving(true);
    try {
      const result = await updateAdminLocalizationSettings(
        accessToken,
        {
          internationalizationEnabled: draft.internationalizationEnabled,
          defaultLocale: draft.defaultLocale,
          supportedLocales: [...draft.supportedLocales],
        },
        requestOptions(),
      );
      setSettings(result);
      setDraft({
        internationalizationEnabled: result.internationalizationEnabled,
        defaultLocale: result.defaultLocale,
        supportedLocales: [...result.supportedLocales],
      });
      setValidation({});
      setSubmitted(false);
      showNotice({ kind: "success", message: dictionary.adminLocalizationSaved });
    } catch (cause) {
      const kind = getErrorKind(cause);
      showNotice({
        kind: "error",
        message:
          kind === "other" && cause instanceof AdminApiError && cause.status === 400
            ? dictionary.apiValidation
            : errorMessage(kind, dictionary, false),
      });
    } finally {
      actionInProgress.current = false;
      setSaving(false);
    }
  };

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

  const buttonStyle = (selected = false) => ({
    alignItems: "center" as const,
    backgroundColor: selected ? palette.primary : palette.surfaceMuted,
    borderColor: selected ? palette.primary : palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center" as const,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  });

  const updateDraft = (changes: Partial<AdminLocalizationSettingsRequest>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
    if (Object.keys(validation).length > 0) setValidation({});
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
          {errorMessage(loadError, dictionary, true)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={() => void load()}
          style={buttonStyle()}
          testID="admin-localization-retry"
        >
          {loading ? <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} /> : null}
          <Text style={{ color: palette.text, fontWeight: "600" }}>{dictionary.adminRetry}</Text>
        </Pressable>
      </View>
    );
  }

  if (!settings || !draft) return null;

  return (
    <View style={cardStyle}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}>
          {dictionary.adminLocalizationSettingsTitle}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}>
          {dictionary.adminLocalizationSettingsSubtitle}
        </Text>
      </View>

      <View style={{ alignItems: "center", borderBottomColor: palette.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 60 }}>
        <Text style={{ color: palette.text, flex: 1, fontSize: 16 }}>{dictionary.adminLocalizationEnabled}</Text>
        <Switch
          accessibilityLabel={dictionary.adminLocalizationEnabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.internationalizationEnabled, disabled: !canManage || saving }}
          disabled={!canManage || saving}
          onValueChange={(value) => updateDraft({ internationalizationEnabled: value })}
          trackColor={{ false: palette.border, true: palette.primary }}
          value={draft.internationalizationEnabled}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text accessibilityRole="header" style={{ color: palette.text, fontWeight: "600" }}>
          {dictionary.adminDefaultLocale}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {settings.availableLocales.map((locale) => {
            const selected = draft.defaultLocale === locale;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: saving || !canManage }}
                disabled={saving || !canManage}
                key={locale}
                onPress={() => updateDraft({ defaultLocale: locale })}
                style={buttonStyle(selected)}
                testID={`admin-localization-default-${locale}`}
              >
                <Text style={{ color: selected ? palette.onPrimary : palette.text, fontWeight: "600" }}>{locale}</Text>
              </Pressable>
            );
          })}
        </View>
        {submitted && validation.defaultLocale ? (
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>{validation.defaultLocale}</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text accessibilityRole="header" style={{ color: palette.text, fontWeight: "600" }}>
          {dictionary.adminSupportedLocales}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {settings.availableLocales.map((locale) => {
            const checked = draft.supportedLocales.includes(locale);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: saving || !canManage }}
                disabled={saving || !canManage}
                key={locale}
                onPress={() => {
                  const supportedLocales = checked
                    ? draft.supportedLocales.filter((value) => value !== locale)
                    : [...new Set([...draft.supportedLocales, locale])];
                  updateDraft({ supportedLocales });
                }}
                style={{ ...buttonStyle(checked), flexDirection: "row", gap: spacing.sm }}
                testID={`admin-localization-supported-${locale}`}
              >
                <Text style={{ color: checked ? palette.onPrimary : palette.text, fontWeight: "700" }}>
                  {checked ? "✓" : "○"}
                </Text>
                <Text style={{ color: checked ? palette.onPrimary : palette.text }}>{locale}</Text>
              </Pressable>
            );
          })}
        </View>
        {submitted && validation.supportedLocales ? (
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>{validation.supportedLocales}</Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !canManage }}
        disabled={saving || !canManage}
        onPress={() => void save()}
        style={{ ...buttonStyle(true), flexDirection: "row", gap: spacing.sm }}
        testID="admin-localization-save"
      >
        {saving ? <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.onPrimary} /> : null}
        <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>{dictionary.adminSave}</Text>
      </Pressable>
    </View>
  );
}
