import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
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
  const [codeError, setCodeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const load = useCallback(
    async (retry = false) => {
      if (!session) return;
      setLoading(true);
      setError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error();
        const options = {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        const nextStatus = await getMfaStatus(
          currentSession.accessToken,
          options,
        );
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
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [refreshSession, session],
  );

  useEffect(() => {
    if (status !== "loading" && !session) router.replace("/sign-in");
  }, [session, status]);

  useEffect(() => {
    if (session) queueMicrotask(() => void load());
  }, [load, session]);

  const setupMfa = useCallback(async () => {
    if (!session || loading) return;
    setLoading(true);
    setError(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error();
      setSetup(
        await startMfaSetup(currentSession.accessToken, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        }),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, refreshSession, session]);

  const mutate = useCallback(
    async (action: "enable" | "disable") => {
      const expectedDigits = setup?.digits ?? mfaStatus?.digits ?? 6;
      if (!session || loading) return;
      if (!new RegExp(`^\\d{${expectedDigits}}$`).test(code)) {
        setCodeError(true);
        return;
      }
      setLoading(true);
      setError(false);
      setCodeError(false);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await mutateMfa(currentSession.accessToken, action, code, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        await signOut();
      } catch (cause) {
        if (cause instanceof AccountApiError && cause.status === 400) {
          setCodeError(true);
        } else {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      code,
      loading,
      mfaStatus?.digits,
      refreshSession,
      session,
      setup?.digits,
      signOut,
    ],
  );

  const createRecoveryCodes = useCallback(async () => {
    if (!session || recoveryLoading || !mfaStatus?.enabled) return;
    setRecoveryLoading(true);
    setError(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error();
      const generated = await generateRecoveryCodes(
        currentSession.accessToken,
        {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        },
      );
      setRecoveryCodes(generated.codes);
      setRecoveryRemaining(generated.remaining);
    } catch {
      setError(true);
    } finally {
      setRecoveryLoading(false);
    }
  }, [mfaStatus?.enabled, recoveryLoading, refreshSession, session]);

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
      <ScrollView contentContainerStyle={styles.content}>
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

        {loading && !mfaStatus ? (
          <ActivityIndicator
            color={palette.primary}
            accessibilityLabel={dictionary.loading}
          />
        ) : error ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(true)}
            style={[styles.error, { borderColor: palette.danger }]}
          >
            <Text style={{ color: palette.danger }}>{dictionary.mfaError}</Text>
            <Text style={{ color: palette.primary }}>
              {dictionary.sessionsRetry}
            </Text>
          </Pressable>
        ) : !mfaStatus?.available ? (
          <Text style={[styles.help, { color: palette.textMuted }]}>
            {dictionary.mfaUnavailable}
          </Text>
        ) : (
          <>
            <View style={[styles.card, { borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {mfaStatus.enabled ? dictionary.mfaEnabled : dictionary.mfa}
              </Text>
              {mfaStatus.enabled ? (
                <>
                  <CodeField
                    code={code}
                    error={codeError}
                    label={dictionary.mfaCode}
                    onChange={(value) => {
                      setCode(value.replace(/\D/g, ""));
                      setCodeError(false);
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
              ) : setup ? (
                <>
                  <Image
                    accessibilityLabel={dictionary.mfaSetup}
                    source={{ uri: setup.qrCode }}
                    style={styles.qr}
                  />
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {dictionary.mfaSecret}: {setup.secret}
                  </Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
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
                      setCodeError(false);
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
              ) : (
                <ActionButton
                  label={dictionary.mfaSetup}
                  loading={loading}
                  disabled={loading}
                  onPress={() => void setupMfa()}
                  palette={palette}
                />
              )}
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
                        style={[styles.code, { color: palette.text }]}
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
        )}
      </ScrollView>
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
  code: string;
  error: boolean;
  label: string;
  onChange: (value: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
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
        <Text style={[styles.errorText, { color: palette.danger }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  loading,
  onPress,
  palette,
}: {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
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
  codes: { borderRadius: radii.sm, marginTop: spacing.md, padding: spacing.md },
  code: { fontFamily: "monospace", fontSize: 15, marginTop: spacing.xs },
});
