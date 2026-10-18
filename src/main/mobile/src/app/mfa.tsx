import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import {
  AccountApiError,
  generateRecoveryCodes,
  getMfaStatus,
  getRecoveryCodesStatus,
  mutateMfa,
  startMfaSetup,
  type MfaSetup,
  type MfaStatus,
} from "@/api/account-api";
import { apiErrorMessage } from "@/api/public-error-message";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function MfaScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, signOut, status, refreshSession } = useMobileAuth();
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const loadInFlight = useRef(false);
  const mfaActionInFlight = useRef(false);
  const recoveryActionInFlight = useRef(false);

  const load = useCallback(
    async (retry = false) => {
      if (!session || loadInFlight.current) return;
      loadInFlight.current = true;
      setLoading(true);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error("No active session");
        const options = {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        const nextStatus = await getMfaStatus(
          currentSession.accessToken,
          options,
        );
        setError(null);
        setMfaStatus(nextStatus);
        if (nextStatus.enabled) {
          const recovery = await getRecoveryCodesStatus(
            currentSession.accessToken,
            options,
          );
          setRecoveryRemaining(recovery.remaining);
        } else {
          setRecoveryRemaining(null);
        }
      } catch (cause) {
        setError(getMfaErrorMessage(cause, dictionary.mfaError, dictionary));
      } finally {
        setLoading(false);
        loadInFlight.current = false;
      }
    },
    [dictionary, refreshSession, session],
  );

  useEffect(() => {
    if (status !== "loading" && !session) router.replace("/sign-in");
  }, [session, status]);

  useEffect(() => {
    if (session) queueMicrotask(() => void load());
  }, [load, session]);

  const setupMfa = useCallback(async () => {
    if (!session || loading || mfaActionInFlight.current) return;
    mfaActionInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("No active session");
      setSetup(
        await startMfaSetup(currentSession.accessToken, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        }),
      );
    } catch (cause) {
      setError(getMfaErrorMessage(cause, dictionary.mfaSetupError, dictionary));
    } finally {
      setLoading(false);
      mfaActionInFlight.current = false;
    }
  }, [dictionary, loading, refreshSession, session]);

  const mutate = useCallback(
    async (action: "enable" | "disable") => {
      const expectedDigits = setup?.digits ?? mfaStatus?.digits ?? 6;
      if (!session || loading || mfaActionInFlight.current) return;
      if (!new RegExp(String.raw`^\d{${expectedDigits}}$`).test(code)) {
        setCodeError(dictionary.mfaInvalidCode);
        return;
      }
      mfaActionInFlight.current = true;
      setLoading(true);
      setError(null);
      setCodeError(null);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error("No active session");
        await mutateMfa(currentSession.accessToken, action, code, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        await signOut();
      } catch (cause) {
        if (cause instanceof AccountApiError && cause.status === 400) {
          setCodeError(
            cause.problem?.violations?.find(({ field }) => field === "code")
              ?.message ?? dictionary.mfaInvalidCode,
          );
        } else {
          setError(getMfaErrorMessage(cause, dictionary.mfaError, dictionary));
        }
      } finally {
        setLoading(false);
        mfaActionInFlight.current = false;
      }
    },
    [
      code,
      dictionary,
      loading,
      mfaStatus?.digits,
      refreshSession,
      session,
      setup?.digits,
      signOut,
    ],
  );

  const createRecoveryCodes = useCallback(async () => {
    if (
      !session ||
      recoveryLoading ||
      recoveryActionInFlight.current ||
      !mfaStatus?.enabled
    ) {
      return;
    }
    recoveryActionInFlight.current = true;
    setRecoveryLoading(true);
    setError(null);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("No active session");
      const generated = await generateRecoveryCodes(
        currentSession.accessToken,
        {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        },
      );
      setRecoveryCodes(generated.codes);
      setRecoveryRemaining(generated.remaining);
    } catch (cause) {
      setError(
        getMfaErrorMessage(cause, dictionary.recoveryCodesError, dictionary),
      );
    } finally {
      setRecoveryLoading(false);
      recoveryActionInFlight.current = false;
    }
  }, [
    dictionary,
    mfaStatus?.enabled,
    recoveryLoading,
    refreshSession,
    session,
  ]);

  if (status === "loading") {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <ActivityIndicator
          color={palette.primary}
          accessibilityLabel={dictionary.loading}
        />
      </SafeAreaView>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <MobileFormScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dictionary.back}
            onPress={() => router.back()}
            style={styles.back}
          >
            <AppIcon name="arrowLeft" size={18} color={palette.primary} />
            <Text style={{ color: palette.primary }}>{dictionary.back}</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>
            {dictionary.mfaTitle}
          </Text>
          <Text style={[styles.help, { color: palette.textMuted }]}>
            {dictionary.mfaHelp}
          </Text>
        </View>

        {(() => {
          if (error) {
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                onPress={() => void load(true)}
                style={[styles.error, { borderColor: palette.danger }]}
              >
                <Text style={{ color: palette.danger }}>{error}</Text>
                <View style={styles.retry}>
                  {loading ? (
                    <ActivityIndicator
                      color={palette.primary}
                      accessibilityLabel={dictionary.sessionsRetry}
                    />
                  ) : null}
                  <Text style={{ color: palette.primary }}>
                    {dictionary.sessionsRetry}
                  </Text>
                </View>
              </Pressable>
            );
          }
          if (loading && !mfaStatus) {
            return (
              <ActivityIndicator
                color={palette.primary}
                accessibilityLabel={dictionary.loading}
              />
            );
          }
          if (!mfaStatus?.available) {
            return (
              <Text style={[styles.help, { color: palette.textMuted }]}>
                {dictionary.mfaUnavailable}
              </Text>
            );
          }
          return (
            <>
              <View style={[styles.card, { borderColor: palette.border }]}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {mfaStatus.enabled ? dictionary.mfaEnabled : dictionary.mfa}
                </Text>
                {(() => {
                  if (mfaStatus.enabled) {
                    return (
                      <>
                        <CodeField
                          code={code}
                          error={codeError}
                          label={dictionary.mfaCode}
                          onChange={(value) => {
                            setCode(value.replace(/\D/g, ""));
                            setCodeError(null);
                          }}
                          palette={palette}
                        />
                        <ActionButton
                          label={dictionary.mfaDisable}
                          loading={loading}
                          disabled={loading}
                          onPress={() => void mutate("disable")}
                          palette={palette}
                        />
                      </>
                    );
                  } else {
                    if (setup) {
                      return (
                        <>
                          <Image
                            accessibilityLabel={dictionary.mfaSetup}
                            source={{ uri: setup.qrCode }}
                            style={styles.qr}
                          />
                          <Text
                            style={[styles.meta, { color: palette.textMuted }]}
                          >
                            {dictionary.mfaSecret}: {setup.secret}
                          </Text>
                          <Text
                            style={[styles.meta, { color: palette.textMuted }]}
                          >
                            {dictionary.mfaAlgorithm}: {setup.algorithm} ·{" "}
                            {dictionary.mfaDigits}: {setup.digits} ·{" "}
                            {dictionary.mfaPeriod}: {setup.periodSeconds}s
                          </Text>
                          <CodeField
                            code={code}
                            error={codeError}
                            label={dictionary.mfaCode}
                            onChange={(value) => {
                              setCode(value.replace(/\D/g, ""));
                              setCodeError(null);
                            }}
                            palette={palette}
                          />
                          <ActionButton
                            label={dictionary.mfaEnable}
                            loading={loading}
                            disabled={loading}
                            onPress={() => void mutate("enable")}
                            palette={palette}
                          />
                        </>
                      );
                    } else {
                      return (
                        <ActionButton
                          label={dictionary.mfaSetup}
                          loading={loading}
                          disabled={loading}
                          onPress={() => void setupMfa()}
                          palette={palette}
                        />
                      );
                    }
                  }
                })()}
              </View>

              {mfaStatus.enabled ? (
                <View style={[styles.card, { borderColor: palette.border }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {dictionary.recoveryCodes}
                  </Text>
                  <Text style={[styles.help, { color: palette.textMuted }]}>
                    {dictionary.recoveryCodesHelp}
                  </Text>
                  {recoveryRemaining !== null ? (
                    <Text style={[styles.meta, { color: palette.textMuted }]}>
                      {dictionary.recoveryCodesRemaining}: {recoveryRemaining}
                    </Text>
                  ) : null}
                  {recoveryCodes ? (
                    <View
                      style={[
                        styles.codes,
                        { backgroundColor: palette.surfaceMuted },
                      ]}
                    >
                      {recoveryCodes.map((recoveryCode) => (
                        <Text
                          key={recoveryCode}
                          accessibilityLabel={dictionary.recoveryCodesGenerated}
                          style={[styles.code, { color: palette.text }]}
                          selectable
                        >
                          {recoveryCode}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <ActionButton
                    label={dictionary.recoveryCodesGenerate}
                    loading={recoveryLoading}
                    disabled={recoveryLoading}
                    onPress={() => void createRecoveryCodes()}
                    palette={palette}
                  />
                </View>
              ) : null}
            </>
          );
        })()}
      </MobileFormScrollView>
    </SafeAreaView>
  );
}

function CodeField({
  code,
  error,
  label,
  onChange,
  palette,
}: {
  readonly code: string;
  readonly error: string | null;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={8}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          {
            borderColor: error ? palette.danger : palette.border,
            color: palette.text,
          },
        ]}
        value={code}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.errorText, { color: palette.danger }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function getMfaErrorMessage(
  cause: unknown,
  fallback: string,
  dictionary: ReturnType<typeof useLocale>["dictionary"],
) {
  if (!(cause instanceof AccountApiError)) return fallback;
  return apiErrorMessage(cause.kind, dictionary, fallback);
}

function ActionButton({
  disabled,
  label,
  loading,
  onPress,
  palette,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly loading: boolean;
  readonly onPress: () => void;
  readonly palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        { backgroundColor: palette.primary, opacity: disabled ? 0.65 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={palette.onPrimary}
          accessibilityLabel={label}
        />
      ) : null}
      <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.xl },
  header: { gap: spacing.sm },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.md },
  help: { fontSize: 14, lineHeight: 21 },
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg },
  cardTitle: { fontSize: 20, fontWeight: "800" },
  qr: { alignSelf: "center", height: 220, marginTop: spacing.lg, width: 220 },
  meta: { fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  field: { marginTop: spacing.lg },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  input: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  errorText: { fontSize: 13, marginTop: spacing.xs },
  action: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  error: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  retry: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  codes: { borderRadius: radii.sm, marginTop: spacing.md, padding: spacing.md },
  code: { fontFamily: "monospace", fontSize: 15, marginTop: spacing.xs },
});
