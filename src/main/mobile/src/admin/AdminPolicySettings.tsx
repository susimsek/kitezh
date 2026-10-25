import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AdminApiError,
  getAdminCibaPolicy,
  getAdminOfflineAccessPolicy,
  revokeAllAdminOfflineAccess,
  updateAdminCibaPolicy,
  updateAdminOfflineAccessPolicy,
  type AdminCibaPolicy,
  type AdminOfflineAccessPolicy,
  type AdminOfflineAccessPolicyRequest,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type LoadError = "forbidden" | "offline" | "timeout" | "other";
type PolicyLoadState<T> = {
  value: T | null;
  loading: boolean;
  error: LoadError | null;
};

function loadErrorKind(cause: unknown): LoadError {
  if (!(cause instanceof AdminApiError)) return "other";
  if (cause.status === 403) return "forbidden";
  if (cause.kind === "offline" || cause.kind === "timeout") return cause.kind;
  return "other";
}

function durationSeconds(value: string): number | null {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value,
    );
  if (!match || !/[1-9]/.test(value)) return null;
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

function isPositiveIsoDuration(value: string) {
  const seconds = durationSeconds(value);
  return seconds !== null && seconds > 0;
}

export function AdminPolicySettings({
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
  const [ciba, setCiba] = useState<PolicyLoadState<AdminCibaPolicy>>({
    value: null,
    loading: true,
    error: null,
  });
  const [offline, setOffline] = useState<
    PolicyLoadState<AdminOfflineAccessPolicy>
  >({ value: null, loading: true, error: null });
  const [cibaDraft, setCibaDraft] = useState<AdminCibaPolicy | null>(null);
  const [idleTimeout, setIdleTimeout] = useState("");
  const [maxLifespan, setMaxLifespan] = useState("");
  const [maxLimited, setMaxLimited] = useState(false);
  const [cibaSaving, setCibaSaving] = useState(false);
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [cibaSubmitted, setCibaSubmitted] = useState(false);
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);
  const cibaBusy = useRef(false);
  const offlineBusy = useRef(false);
  const revokeBusy = useRef(false);

  const requestOptions = useCallback(
    () => ({ refreshAccessToken }),
    [refreshAccessToken],
  );

  const loadCiba = useCallback(async () => {
    setCiba((current) => ({ ...current, loading: true, error: null }));
    try {
      const value = await getAdminCibaPolicy(accessToken, requestOptions());
      setCiba({ value, loading: false, error: null });
      setCibaDraft(value);
    } catch (cause) {
      setCiba((current) => ({
        ...current,
        loading: false,
        error: loadErrorKind(cause),
      }));
    }
  }, [accessToken, requestOptions]);

  const loadOffline = useCallback(async () => {
    setOffline((current) => ({ ...current, loading: true, error: null }));
    try {
      const value = await getAdminOfflineAccessPolicy(
        accessToken,
        requestOptions(),
      );
      setOffline({ value, loading: false, error: null });
      setIdleTimeout(value.idleTimeout);
      setMaxLifespan(value.maxLifespan ?? "");
      setMaxLimited(value.maxLimited);
    } catch (cause) {
      setOffline((current) => ({
        ...current,
        loading: false,
        error: loadErrorKind(cause),
      }));
    }
  }, [accessToken, requestOptions]);

  useEffect(() => {
    void loadCiba();
    void loadOffline();
  }, [loadCiba, loadOffline]);

  const saveCiba = async () => {
    if (!cibaDraft || !canManage || cibaBusy.current) return;
    setCibaSubmitted(true);
    if (
      !Number.isInteger(cibaDraft.requestLifespanSeconds) ||
      cibaDraft.requestLifespanSeconds < 30 ||
      cibaDraft.requestLifespanSeconds > 3600 ||
      !Number.isInteger(cibaDraft.pollingIntervalSeconds) ||
      cibaDraft.pollingIntervalSeconds < 1 ||
      cibaDraft.pollingIntervalSeconds > 300 ||
      (cibaDraft.stepUpAcr?.length ?? 0) > 100
    ) {
      return;
    }
    cibaBusy.current = true;
    setCibaSaving(true);
    try {
      const saved = await updateAdminCibaPolicy(
        accessToken,
        { ...cibaDraft, stepUpAcr: cibaDraft.stepUpAcr?.trim() || null },
        requestOptions(),
      );
      setCiba({ value: saved, loading: false, error: null });
      setCibaDraft(saved);
      setCibaSubmitted(false);
      showNotice({ kind: "success", message: dictionary.adminPolicySaved });
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError && cause.status === 403
            ? dictionary.adminForbidden
            : cause instanceof AdminApiError && cause.kind === "offline"
              ? dictionary.adminEventSettingsOfflineError
              : cause instanceof AdminApiError && cause.kind === "timeout"
                ? dictionary.adminEventSettingsTimeoutError
                : dictionary.adminCibaSaveError,
      });
    } finally {
      cibaBusy.current = false;
      setCibaSaving(false);
    }
  };

  const saveOffline = async () => {
    if (!canManage || offlineBusy.current) return;
    setOfflineSubmitted(true);
    const normalizedIdle = idleTimeout.trim();
    const normalizedMax = maxLifespan.trim();
    const idleSeconds = durationSeconds(normalizedIdle);
    const maxSeconds = durationSeconds(normalizedMax);
    if (
      idleSeconds === null ||
      idleSeconds <= 0 ||
      (maxLimited && (maxSeconds === null || maxSeconds < idleSeconds))
    ) {
      return;
    }
    const request: AdminOfflineAccessPolicyRequest = {
      idleTimeout: normalizedIdle,
      maxLifespan: maxLimited ? normalizedMax : null,
      maxLimited,
    };
    offlineBusy.current = true;
    setOfflineSaving(true);
    try {
      const saved = await updateAdminOfflineAccessPolicy(
        accessToken,
        request,
        requestOptions(),
      );
      setOffline({ value: saved, loading: false, error: null });
      setIdleTimeout(saved.idleTimeout);
      setMaxLifespan(saved.maxLifespan ?? "");
      setMaxLimited(saved.maxLimited);
      setOfflineSubmitted(false);
      showNotice({ kind: "success", message: dictionary.adminPolicySaved });
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError && cause.status === 403
            ? dictionary.adminForbidden
            : cause instanceof AdminApiError && cause.kind === "offline"
              ? dictionary.adminEventSettingsOfflineError
              : cause instanceof AdminApiError && cause.kind === "timeout"
                ? dictionary.adminEventSettingsTimeoutError
                : dictionary.adminOfflinePolicySaveError,
      });
    } finally {
      offlineBusy.current = false;
      setOfflineSaving(false);
    }
  };

  const revokeAllOffline = () => {
    if (!canManage || revokeBusy.current) return;
    Alert.alert(
      dictionary.adminRevokeAllOfflineTitle,
      dictionary.adminRevokeAllOfflinePrompt,
      [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.adminRevokeAllOfflineAction,
          style: "destructive",
          onPress: () => void performRevokeAll(),
        },
      ],
    );
  };

  const performRevokeAll = async () => {
    if (!canManage || revokeBusy.current) return;
    revokeBusy.current = true;
    setRevoking(true);
    try {
      const value = await revokeAllAdminOfflineAccess(
        accessToken,
        requestOptions(),
      );
      setOffline({ value, loading: false, error: null });
      showNotice({
        kind: "success",
        message: dictionary.adminRevokeAllOfflineSuccess,
      });
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError && cause.status === 403
            ? dictionary.adminForbidden
            : dictionary.adminActionError,
      });
    } finally {
      revokeBusy.current = false;
      setRevoking(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <PolicyCard
        title={dictionary.adminCibaPolicy}
        description={dictionary.adminCibaPolicyDescription}
        loading={ciba.loading && !ciba.value}
        error={ciba.error}
        errorMessage={policyErrorText(ciba.error, dictionary)}
        onRetry={() => void loadCiba()}
        palette={palette}
        dictionary={dictionary}
      >
        {cibaDraft ? (
          <>
            <NumberField
              label={dictionary.adminRequestLifespan}
              testID="admin-ciba-request-lifetime"
              value={String(cibaDraft.requestLifespanSeconds)}
              min={30}
              max={3600}
              editable={canManage && !cibaSaving}
              invalid={
                cibaSubmitted &&
                (!Number.isInteger(cibaDraft.requestLifespanSeconds) ||
                  cibaDraft.requestLifespanSeconds < 30 ||
                  cibaDraft.requestLifespanSeconds > 3600)
              }
              onChange={(value) =>
                setCibaDraft({
                  ...cibaDraft,
                  requestLifespanSeconds: value === "" ? 0 : Number(value),
                })
              }
              error={dictionary.adminPolicyValidationError}
              palette={palette}
            />
            <NumberField
              label={dictionary.adminPollingInterval}
              value={String(cibaDraft.pollingIntervalSeconds)}
              min={1}
              max={300}
              editable={canManage && !cibaSaving}
              invalid={
                cibaSubmitted &&
                (!Number.isInteger(cibaDraft.pollingIntervalSeconds) ||
                  cibaDraft.pollingIntervalSeconds < 1 ||
                  cibaDraft.pollingIntervalSeconds > 300)
              }
              onChange={(value) =>
                setCibaDraft({
                  ...cibaDraft,
                  pollingIntervalSeconds: value === "" ? 0 : Number(value),
                })
              }
              error={dictionary.adminPolicyValidationError}
              palette={palette}
            />
            <ChoiceField
              label={dictionary.adminDeliveryMode}
              selected={cibaDraft.deliveryMode}
              options={[
                ["all", dictionary.adminCibaDeliveryAll],
                ["poll", dictionary.adminCibaDeliveryPoll],
                ["ping", dictionary.adminCibaDeliveryPing],
                ["push", dictionary.adminCibaDeliveryPush],
              ]}
              disabled={!canManage || cibaSaving}
              onSelect={(value) =>
                setCibaDraft({
                  ...cibaDraft,
                  deliveryMode: value as AdminCibaPolicy["deliveryMode"],
                })
              }
              palette={palette}
            />
            <ChoiceField
              label={dictionary.adminUserVerification}
              selected={cibaDraft.userVerification}
              options={[
                ["required", dictionary.adminCibaVerificationRequired],
                ["preferred", dictionary.adminCibaVerificationPreferred],
                ["discouraged", dictionary.adminCibaVerificationDiscouraged],
              ]}
              disabled={!canManage || cibaSaving}
              onSelect={(value) =>
                setCibaDraft({
                  ...cibaDraft,
                  userVerification:
                    value as AdminCibaPolicy["userVerification"],
                })
              }
              palette={palette}
            />
            <ToggleField
              label={dictionary.adminMfaRequired}
              value={cibaDraft.mfaRequired}
              disabled={!canManage || cibaSaving}
              onChange={(value) =>
                setCibaDraft({ ...cibaDraft, mfaRequired: value })
              }
              palette={palette}
            />
            <ToggleField
              label={dictionary.adminStepUpRequired}
              value={cibaDraft.stepUpRequired}
              disabled={!canManage || cibaSaving}
              onChange={(value) =>
                setCibaDraft({ ...cibaDraft, stepUpRequired: value })
              }
              palette={palette}
            />
            <TextField
              label={dictionary.adminStepUpAcr}
              value={cibaDraft.stepUpAcr ?? ""}
              editable={canManage && !cibaSaving}
              maxLength={100}
              onChange={(value) =>
                setCibaDraft({ ...cibaDraft, stepUpAcr: value })
              }
              palette={palette}
              error={
                cibaSubmitted && (cibaDraft.stepUpAcr?.length ?? 0) > 100
                  ? dictionary.adminPolicyValidationError
                  : undefined
              }
            />
            {canManage ? (
              <ActionButton
                label={dictionary.adminSave}
                busy={cibaSaving}
                onPress={() => void saveCiba()}
                palette={palette}
                testID="admin-ciba-policy-save"
              />
            ) : null}
          </>
        ) : null}
      </PolicyCard>

      <PolicyCard
        title={dictionary.adminOfflineAccessPolicy}
        description={dictionary.adminOfflinePolicyDescription}
        loading={offline.loading && !offline.value}
        error={offline.error}
        errorMessage={policyErrorText(offline.error, dictionary, true)}
        onRetry={() => void loadOffline()}
        palette={palette}
        dictionary={dictionary}
      >
        {offline.value ? (
          <>
            <TextField
              label={dictionary.adminIdleTimeout}
              testID="admin-offline-idle-timeout"
              value={idleTimeout}
              editable={canManage && !offlineSaving}
              onChange={(value) => setIdleTimeout(value)}
              palette={palette}
              hint={dictionary.adminPolicyDurationHint}
              error={
                offlineSubmitted && !isPositiveIsoDuration(idleTimeout.trim())
                  ? dictionary.adminPolicyValidationError
                  : undefined
              }
            />
            <ToggleField
              label={dictionary.adminMaxLimited}
              value={maxLimited}
              disabled={!canManage || offlineSaving}
              onChange={setMaxLimited}
              palette={palette}
            />
            <TextField
              label={dictionary.adminMaxLifespan}
              value={maxLifespan}
              editable={canManage && maxLimited && !offlineSaving}
              onChange={(value) => setMaxLifespan(value)}
              palette={palette}
              hint={dictionary.adminPolicyDurationHint}
              error={
                offlineSubmitted &&
                maxLimited &&
                !isPositiveIsoDuration(maxLifespan.trim())
                  ? dictionary.adminPolicyValidationError
                  : undefined
              }
            />
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                {dictionary.adminRevokedBefore}:{" "}
                {offline.value.revokedBefore ?? dictionary.adminNotConfigured}
              </Text>
            </View>
            {canManage ? (
              <>
                <ActionButton
                  label={dictionary.adminSave}
                  busy={offlineSaving}
                  onPress={() => void saveOffline()}
                  palette={palette}
                  testID="admin-offline-policy-save"
                />
                <ActionButton
                  label={dictionary.adminRevokeAllOfflineAction}
                  busy={revoking}
                  destructive
                  onPress={revokeAllOffline}
                  palette={palette}
                  testID="admin-offline-revoke-all"
                />
              </>
            ) : null}
          </>
        ) : null}
      </PolicyCard>
    </View>
  );
}

function policyErrorText(
  error: LoadError | null,
  dictionary: ReturnType<typeof useLocale>["dictionary"],
  offline = false,
) {
  if (error === "forbidden") return dictionary.adminForbidden;
  if (error === "offline") return dictionary.adminEventSettingsOfflineError;
  if (error === "timeout") return dictionary.adminEventSettingsTimeoutError;
  return offline
    ? dictionary.adminOfflinePolicyLoadError
    : dictionary.adminCibaLoadError;
}

function PolicyCard({
  title,
  description,
  loading,
  error,
  errorMessage,
  onRetry,
  palette,
  dictionary,
  children,
}: Readonly<{
  title: string;
  description: string;
  loading: boolean;
  error: LoadError | null;
  errorMessage: string;
  onRetry: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  dictionary: ReturnType<typeof useLocale>["dictionary"];
  children: React.ReactNode;
}>) {
  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.md,
        maxWidth: 720,
        padding: spacing.lg,
        width: "100%",
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}
        >
          {title}
        </Text>
        <Text
          style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}
        >
          {description}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      ) : null}
      {error ? (
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>
            {errorMessage}
          </Text>
          <ActionButton
            label={dictionary.adminRetry}
            busy={loading}
            onPress={onRetry}
            palette={palette}
            secondary
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function NumberField({
  label,
  testID,
  value,
  min,
  max,
  editable,
  invalid,
  onChange,
  error,
  palette,
}: Readonly<{
  label: string;
  testID?: string;
  value: string;
  min: number;
  max: number;
  editable: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  error: string;
  palette: ReturnType<typeof useTheme>["palette"];
}>) {
  return (
    <TextField
      label={label}
      testID={testID}
      value={value}
      editable={editable}
      keyboardType="number-pad"
      onChange={onChange}
      palette={palette}
      error={invalid ? error : undefined}
      hint={`${min}–${max}`}
    />
  );
}

function TextField({
  label,
  testID,
  value,
  editable,
  onChange,
  palette,
  hint,
  error,
  maxLength,
  keyboardType = "default",
}: Readonly<{
  label: string;
  testID?: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  hint?: string;
  error?: string;
  maxLength?: number;
  keyboardType?: "default" | "number-pad";
}>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: "600" }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChange}
        placeholderTextColor={palette.textMuted}
        testID={testID}
        style={{
          borderColor: error ? palette.danger : palette.border,
          borderRadius: radii.sm,
          borderWidth: 1,
          color: palette.text,
          fontSize: 16,
          minHeight: 48,
          paddingHorizontal: spacing.md,
        }}
        value={value}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {error}
        </Text>
      ) : null}
      {hint ? (
        <Text
          style={{ color: palette.textMuted, fontSize: 13, lineHeight: 19 }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function ToggleField({
  label,
  value,
  disabled,
  onChange,
  palette,
}: Readonly<{
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  palette: ReturnType<typeof useTheme>["palette"];
}>) {
  return (
    <View
      style={{
        alignItems: "center",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        justifyContent: "space-between",
        minHeight: 64,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: palette.text, flex: 1, fontSize: 16 }}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: palette.border, true: palette.primary }}
        value={value}
      />
    </View>
  );
}

function ChoiceField({
  label,
  selected,
  options,
  disabled,
  onSelect,
  palette,
}: Readonly<{
  label: string;
  selected: string;
  options: readonly (readonly [string, string])[];
  disabled: boolean;
  onSelect: (value: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
}>) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: "600" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {options.map(([value, title]) => {
          const active = selected === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              key={value}
              onPress={() => onSelect(value)}
              style={{
                backgroundColor: active
                  ? palette.primary
                  : palette.surfaceMuted,
                borderColor: active ? palette.primary : palette.border,
                borderRadius: radii.sm,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 44,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={{
                  color: active ? palette.onPrimary : palette.text,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  busy,
  disabled = false,
  onPress,
  palette,
  secondary = false,
  destructive = false,
  testID,
}: Readonly<{
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  secondary?: boolean;
  destructive?: boolean;
  testID?: string;
}>) {
  const unavailable = busy || disabled;
  const backgroundColor = destructive
    ? palette.danger
    : secondary
      ? palette.surfaceMuted
      : palette.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor,
        borderColor: secondary ? palette.border : backgroundColor,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.sm,
        justifyContent: "center",
        minHeight: 48,
        opacity: unavailable ? 0.7 : 1,
        paddingHorizontal: spacing.md,
      }}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator
          accessibilityLabel="Loading"
          color={secondary ? palette.primary : palette.onPrimary}
        />
      ) : null}
      <Text
        style={{
          color: secondary ? palette.text : palette.onPrimary,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
