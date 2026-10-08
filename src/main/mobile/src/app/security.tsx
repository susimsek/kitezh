import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { AccountTabBar } from "@/components/AccountTabBar";
import {
  AccountApiError,
  changeAccountPassword,
  deleteAccount,
  listAccountSessions,
  signOutAccountSession,
  signOutOtherAccountSessions,
  type AccountSession,
} from "@/api/account-api";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";
import type { ProblemViolation } from "../../../shared/src/api.ts";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
type PasswordErrors = Partial<Record<PasswordField, string>>;

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function apiFieldErrors(data: unknown): PasswordErrors {
  if (!data || typeof data !== "object") return {};
  const violations = "violations" in data ? data.violations : undefined;
  if (!Array.isArray(violations)) return {};
  return violations.reduce<PasswordErrors>((errors, violation) => {
    if (!violation || typeof violation !== "object") return errors;
    const field: unknown = "field" in violation ? violation.field : undefined;
    const message: unknown =
      "message" in violation ? violation.message : undefined;
    if (
      (field === "currentPassword" ||
        field === "newPassword" ||
        field === "confirmPassword") &&
      typeof message === "string"
    ) {
      errors[field as PasswordField] = message;
    }
    return errors;
  }, {});
}

function problemFieldErrors(
  violations: ProblemViolation[] | undefined,
): PasswordErrors {
  return (violations ?? []).reduce<PasswordErrors>((errors, violation) => {
    if (
      (violation.field === "currentPassword" ||
        violation.field === "newPassword" ||
        violation.field === "confirmPassword") &&
      violation.message
    ) {
      errors[violation.field as PasswordField] = violation.message;
    }
    return errors;
  }, {});
}

export default function SecurityScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const { session, signOut, status, refreshSession } = useMobileAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [signOutOthersError, setSignOutOthersError] = useState(false);
  const [signingOutSessionId, setSigningOutSessionId] = useState<string | null>(
    null,
  );
  const [signOutSessionError, setSignOutSessionError] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(false);

  const loadSessions = useCallback(
    async (retry = false) => {
      if (!session) return;
      setSessionsLoading(true);
      setSessionsError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) {
          setSessionsError(true);
          return;
        }
        const page = await listAccountSessions(currentSession.accessToken, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        setSessions(page.content ?? []);
      } catch {
        setSessionsError(true);
      } finally {
        setSessionsLoading(false);
      }
    },
    [refreshSession, session],
  );

  useEffect(() => {
    if (status !== "loading" && !session) router.replace("/sign-in");
  }, [session, status]);

  useEffect(() => {
    if (session) queueMicrotask(() => void loadSessions());
  }, [loadSessions, session]);

  const validatePassword = useCallback(() => {
    const errors: PasswordErrors = {};
    if (!currentPassword) errors.currentPassword = dictionary.passwordRequired;
    if (!newPassword) errors.newPassword = dictionary.passwordRequired;
    else if (newPassword.length < 12)
      errors.newPassword = dictionary.passwordMinLength;
    if (!confirmPassword) errors.confirmPassword = dictionary.passwordRequired;
    else if (newPassword !== confirmPassword)
      errors.confirmPassword = dictionary.passwordMismatch;
    if (currentPassword && newPassword && currentPassword === newPassword)
      errors.newPassword = dictionary.passwordDifferent;
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }, [
    confirmPassword,
    currentPassword,
    dictionary.passwordDifferent,
    dictionary.passwordMinLength,
    dictionary.passwordMismatch,
    dictionary.passwordRequired,
    newPassword,
  ]);

  const savePassword = useCallback(async () => {
    if (!session || passwordSaving || !validatePassword()) return;
    setPasswordSaving(true);
    setPasswordSaved(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) {
        setPasswordErrors({ currentPassword: dictionary.passwordSaveError });
        return;
      }
      await changeAccountPassword(
        currentSession.accessToken,
        { currentPassword, newPassword },
        {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordErrors({});
      setPasswordSaved(true);
    } catch (cause) {
      setPasswordErrors(
        cause instanceof AccountApiError
          ? {
              ...problemFieldErrors(cause.problem?.violations),
              ...((cause.problem?.violations?.length ?? 0) === 0 &&
              Object.keys(apiFieldErrors(cause.data)).length === 0
                ? { currentPassword: dictionary.passwordSaveError }
                : {}),
            }
          : { currentPassword: dictionary.passwordSaveError },
      );
    } finally {
      setPasswordSaving(false);
    }
  }, [
    currentPassword,
    dictionary.passwordSaveError,
    newPassword,
    passwordSaving,
    refreshSession,
    session,
    validatePassword,
  ]);

  const signOutOthers = useCallback(async () => {
    if (!session || signingOutOthers) return;
    setSigningOutOthers(true);
    setSignOutOthersError(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) {
        setSignOutOthersError(true);
        return;
      }
      await signOutOtherAccountSessions(currentSession.accessToken, {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      });
      await loadSessions(true);
    } catch {
      setSignOutOthersError(true);
    } finally {
      setSigningOutOthers(false);
    }
  }, [loadSessions, refreshSession, session, signingOutOthers]);

  const revokeSession = useCallback(
    async (sessionId: string) => {
      if (!session || signingOutSessionId) return;
      setSigningOutSessionId(sessionId);
      setSignOutSessionError(false);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) {
          setSignOutSessionError(true);
          return;
        }
        await signOutAccountSession(currentSession.accessToken, sessionId, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        await loadSessions(true);
      } catch {
        setSignOutSessionError(true);
      } finally {
        setSigningOutSessionId(null);
      }
    },
    [loadSessions, refreshSession, session, signingOutSessionId],
  );

  const confirmRevokeSession = (accountSession: AccountSession) => {
    Alert.alert(dictionary.signOutSession, dictionary.signOutSessionConfirm, [
      { text: dictionary.cancel, style: "cancel" },
      {
        onPress: () => void revokeSession(accountSession.id),
        text: dictionary.signOutSession,
        style: "destructive",
      },
    ]);
  };

  const removeAccount = useCallback(async () => {
    if (!session || deletingAccount || !deletePassword) {
      setDeleteAccountError(true);
      return;
    }
    setDeletingAccount(true);
    setDeleteAccountError(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error();
      await deleteAccount(currentSession.accessToken, deletePassword, {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      });
      await signOut();
    } catch {
      setDeleteAccountError(true);
    } finally {
      setDeletingAccount(false);
    }
  }, [deletePassword, deletingAccount, refreshSession, session, signOut]);

  const confirmDeleteAccount = () => {
    Alert.alert(dictionary.deleteAccount, dictionary.deleteAccountConfirm, [
      { text: dictionary.cancel, style: "cancel" },
      {
        text: dictionary.deleteAccount,
        style: "destructive",
        onPress: () => void removeAccount(),
      },
    ]);
  };

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
      <View style={styles.screen}>
        <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        >
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
            {dictionary.securityTitle}
          </Text>
        </View>

        <View
          style={[styles.section, { borderColor: palette.border }]}
          accessible
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {dictionary.newPassword}
          </Text>
          <Text style={[styles.help, { color: palette.textMuted }]}>
            {dictionary.passwordPolicy}
          </Text>
          {(
            [
              ["currentPassword", currentPassword, setCurrentPassword],
              ["newPassword", newPassword, setNewPassword],
              ["confirmPassword", confirmPassword, setConfirmPassword],
            ] as const
          ).map(([field, value, setter]) => (
            <View key={field} style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>
                {dictionary[field]}
              </Text>
              <TextInput
                accessibilityLabel={dictionary[field]}
                editable={!passwordSaving}
                onChangeText={(nextValue) => {
                  setter(nextValue);
                  setPasswordSaved(false);
                  setPasswordErrors((current) => ({
                    ...current,
                    [field]: undefined,
                  }));
                }}
                placeholder={dictionary[field]}
                placeholderTextColor={palette.textMuted}
                secureTextEntry
                style={[
                  styles.input,
                  {
                    borderColor: passwordErrors[field]
                      ? palette.danger
                      : palette.border,
                    color: palette.text,
                  },
                ]}
                value={value}
              />
              {passwordErrors[field] ? (
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {passwordErrors[field]}
                </Text>
              ) : null}
            </View>
          ))}
          {passwordSaved ? (
            <Text style={[styles.successText, { color: palette.success }]}>
              {dictionary.passwordSaved}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: passwordSaving }}
            disabled={passwordSaving}
            onPress={() => void savePassword()}
            style={[
              styles.primaryAction,
              {
                backgroundColor: palette.primary,
                opacity: passwordSaving ? 0.65 : 1,
              },
            ]}
          >
            {passwordSaving ? (
              <ActivityIndicator
                color={palette.onPrimary}
                accessibilityLabel={dictionary.loading}
              />
            ) : null}
            <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
              {dictionary.save}
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.section, { borderColor: palette.border }]}
          accessible
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {dictionary.sessionsTitle}
          </Text>
          {sessionsLoading ? (
            <ActivityIndicator
              color={palette.primary}
              accessibilityLabel={dictionary.loading}
              style={styles.loading}
            />
          ) : sessionsError ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadSessions(true)}
              style={[styles.errorAction, { borderColor: palette.danger }]}
            >
              <Text style={{ color: palette.danger }}>
                {dictionary.sessionsError}
              </Text>
              <Text style={{ color: palette.primary }}>
                {dictionary.sessionsRetry}
              </Text>
            </Pressable>
          ) : sessions.length === 0 ? (
            <Text style={[styles.help, { color: palette.textMuted }]}>
              {dictionary.sessionsEmpty}
            </Text>
          ) : (
            sessions.map((accountSession) => (
              <View
                key={accountSession.id}
                style={[styles.session, { borderColor: palette.border }]}
              >
                <View style={styles.sessionTitleRow}>
                  <Text style={[styles.sessionTitle, { color: palette.text }]}>
                    {accountSession.current
                      ? dictionary.currentSession
                      : (accountSession.clients[0]?.clientName ??
                        dictionary.sessions)}
                  </Text>
                  {accountSession.current ? (
                    <AppIcon name="check" size={16} color={palette.success} />
                  ) : null}
                </View>
                <Text
                  style={[styles.sessionMeta, { color: palette.textMuted }]}
                >
                  {dictionary.sessionCreated}:{" "}
                  {formatDate(accountSession.createdAt, resolvedLocale)}
                </Text>
                <Text
                  style={[styles.sessionMeta, { color: palette.textMuted }]}
                >
                  {dictionary.sessionLastUsed}:{" "}
                  {formatDate(accountSession.lastAccessedAt, resolvedLocale)}
                </Text>
                <Text
                  style={[styles.sessionMeta, { color: palette.textMuted }]}
                >
                  {dictionary.sessionExpires}:{" "}
                  {formatDate(accountSession.expiresAt, resolvedLocale)}
                </Text>
                {!accountSession.current ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: Boolean(signingOutSessionId),
                    }}
                    disabled={Boolean(signingOutSessionId)}
                    onPress={() => confirmRevokeSession(accountSession)}
                    style={[
                      styles.sessionAction,
                      {
                        borderColor: palette.border,
                        opacity: signingOutSessionId ? 0.65 : 1,
                      },
                    ]}
                  >
                    {signingOutSessionId === accountSession.id ? (
                      <ActivityIndicator
                        color={palette.text}
                        accessibilityLabel={dictionary.loading}
                      />
                    ) : null}
                    <Text style={{ color: palette.text, fontWeight: "700" }}>
                      {dictionary.signOutSession}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          {signOutOthersError ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {dictionary.signOutOthersError}
            </Text>
          ) : null}
          {signOutSessionError ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {dictionary.signOutSessionError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: signingOutOthers || sessionsLoading,
            }}
            disabled={signingOutOthers || sessionsLoading}
            onPress={() => void signOutOthers()}
            style={[
              styles.secondaryAction,
              {
                borderColor: palette.border,
                opacity: signingOutOthers || sessionsLoading ? 0.65 : 1,
              },
            ]}
          >
            {signingOutOthers ? (
              <ActivityIndicator
                color={palette.text}
                accessibilityLabel={dictionary.loading}
              />
            ) : null}
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              {dictionary.signOutOthers}
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.section, { borderColor: palette.danger }]}
          accessible
        >
          <Text style={[styles.sectionTitle, { color: palette.danger }]}>
            {dictionary.deleteAccount}
          </Text>
          <Text style={[styles.help, { color: palette.textMuted }]}>
            {dictionary.deleteAccountWarning}
          </Text>
          <TextInput
            accessibilityLabel={dictionary.currentPassword}
            editable={!deletingAccount}
            onChangeText={(value) => {
              setDeletePassword(value);
              setDeleteAccountError(false);
            }}
            placeholder={dictionary.currentPassword}
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            style={[
              styles.input,
              {
                borderColor: deleteAccountError
                  ? palette.danger
                  : palette.border,
                color: palette.text,
                marginTop: spacing.md,
              },
            ]}
            value={deletePassword}
          />
          {deleteAccountError ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {dictionary.deleteAccountError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deletingAccount }}
            disabled={deletingAccount}
            onPress={confirmDeleteAccount}
            style={[
              styles.dangerAction,
              {
                borderColor: palette.danger,
                opacity: deletingAccount ? 0.65 : 1,
              },
            ]}
          >
            {deletingAccount ? (
              <ActivityIndicator
                color={palette.danger}
                accessibilityLabel={dictionary.loading}
              />
            ) : null}
            <Text style={{ color: palette.danger, fontWeight: "700" }}>
              {dictionary.deleteAccount}
            </Text>
          </Pressable>
        </View>
        </ScrollView>
        <AccountTabBar active="security" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.xl },
  header: { alignSelf: "stretch", gap: spacing.md },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  title: { fontSize: 28, fontWeight: "800" },
  section: {
    alignSelf: "stretch",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  help: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  field: { marginTop: spacing.md },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  input: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  errorText: { fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  successText: { fontSize: 14, marginTop: spacing.md },
  primaryAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  loading: { marginTop: spacing.lg },
  errorAction: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  session: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  sessionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sessionTitle: { fontSize: 16, fontWeight: "700" },
  sessionMeta: { fontSize: 13, marginTop: spacing.xs },
  sessionAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  dangerAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
});
