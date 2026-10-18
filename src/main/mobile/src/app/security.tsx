import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { AppIcon } from "@/components/AppIcon";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { AccountTabBar } from "@/components/AccountTabBar";
import { AccountPagination } from "@/components/AccountPagination";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import {
  AccountApiError,
  beginAccountPasskeyEnrollment,
  changeAccountPassword,
  createPersonalAccessToken,
  deleteAccount,
  listPersonalAccessTokens,
  listAccountPasskeys,
  completeAccountPasskeyEnrollment,
  listAccountSessions,
  revokePersonalAccessToken,
  signOutAccountSession,
  signOutOtherAccountSessions,
  type AccountSession,
  type AccountPasskey,
  type CreatedPersonalAccessToken,
  type PersonalAccessToken,
} from "@/api/account-api";
import { createNativePasskey } from "@/auth/native-passkey";
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

function isValidCustomExpirationDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  const earliest = new Date(`${today}T00:00:00.000Z`);
  earliest.setUTCDate(earliest.getUTCDate() + 1);
  const latest = new Date(`${today}T00:00:00.000Z`);
  latest.setUTCFullYear(latest.getUTCFullYear() + 1);
  return value >= earliest.toISOString().slice(0, 10) && value <= latest.toISOString().slice(0, 10);
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
  const { showNotice } = useMobileNotice();
  const { palette } = useTheme();
  const { session, signOut, status, refreshSession } = useMobileAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [passkeys, setPasskeys] = useState<AccountPasskey[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeysError, setPasskeysError] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [personalAccessTokens, setPersonalAccessTokens] = useState<PersonalAccessToken[]>([]);
  const [personalAccessTokensLoading, setPersonalAccessTokensLoading] = useState(true);
  const [personalAccessTokensError, setPersonalAccessTokensError] = useState(false);
  const [personalAccessTokenName, setPersonalAccessTokenName] = useState("");
  const [personalAccessTokenDescription, setPersonalAccessTokenDescription] = useState("");
  const [personalAccessTokenExpiration, setPersonalAccessTokenExpiration] = useState<"7" | "30" | "60" | "90" | "custom" | "never">("90");
  const [personalAccessTokenCustomDate, setPersonalAccessTokenCustomDate] = useState("");
  const [personalAccessTokenFormError, setPersonalAccessTokenFormError] = useState("");
  const [creatingPersonalAccessToken, setCreatingPersonalAccessToken] = useState(false);
  const [createdPersonalAccessToken, setCreatedPersonalAccessToken] = useState<CreatedPersonalAccessToken | null>(null);
  const [createdPersonalAccessTokenVisible, setCreatedPersonalAccessTokenVisible] = useState(true);
  const [copyingPersonalAccessToken, setCopyingPersonalAccessToken] = useState(false);
  const [revokingPersonalAccessTokenId, setRevokingPersonalAccessTokenId] = useState<string | null>(null);
  const [personalAccessTokenActionError, setPersonalAccessTokenActionError] = useState("");
  const [sessionsPage, setSessionsPage] = useState<{
    number: number;
    totalPages: number;
  } | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsPageDirection, setSessionsPageDirection] = useState<
    "next" | "previous" | null
  >(null);
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
  const sessionsLoadInFlight = useRef(false);
  const sessionsPageRef = useRef(0);

  const loadPersonalAccessTokens = useCallback(async (retry = false) => {
    if (!session) return;
    setPersonalAccessTokensLoading(true);
    setPersonalAccessTokensError(false);
    try {
      const currentSession = retry
        ? await refreshSession(true)
        : await refreshSession();
      if (!currentSession) {
        setPersonalAccessTokensError(true);
        return;
      }
      const tokens = await listPersonalAccessTokens(currentSession.accessToken, {
        refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null,
      });
      setPersonalAccessTokens(tokens);
    } catch {
      setPersonalAccessTokensError(true);
    } finally {
      setPersonalAccessTokensLoading(false);
    }
  }, [refreshSession, session]);

  const loadPasskeys = useCallback(async (retry = false) => {
    if (!session) return;
    setPasskeysLoading(true);
    setPasskeysError(false);
    try {
      const currentSession = retry ? await refreshSession(true) : await refreshSession();
      if (!currentSession) throw new Error("Session unavailable");
      const result = await listAccountPasskeys(currentSession.accessToken, {
        refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null,
      });
      setPasskeys(result.content ?? []);
    } catch {
      setPasskeysError(true);
    } finally {
      setPasskeysLoading(false);
    }
  }, [refreshSession, session]);

  const loadSessions = useCallback(
    async (
      retry = false,
      requestedPage = 0,
      direction: "next" | "previous" | null = null,
    ) => {
      if (!session || sessionsLoadInFlight.current) return;
      sessionsLoadInFlight.current = true;
      setSessionsLoading(true);
      setSessionsPageDirection(direction);
      setSessionsError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) {
          setSessionsError(true);
          return;
        }
        let page = await listAccountSessions(currentSession.accessToken, {
          page: requestedPage,
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        if (requestedPage > 0 && requestedPage >= page.totalPages) {
          const fallbackPage = Math.max(0, page.totalPages - 1);
          page = await listAccountSessions(currentSession.accessToken, {
            page: fallbackPage,
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          });
        }
        setSessions(page.content ?? []);
        sessionsPageRef.current = page.number;
        setSessionsPage({ number: page.number, totalPages: page.totalPages });
      } catch {
        setSessionsError(true);
      } finally {
        setSessionsLoading(false);
        setSessionsPageDirection(null);
        sessionsLoadInFlight.current = false;
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

  useEffect(() => {
    if (session) queueMicrotask(() => void loadPersonalAccessTokens());
  }, [loadPersonalAccessTokens, session]);

  useEffect(() => {
    if (session) queueMicrotask(() => void loadPasskeys());
  }, [loadPasskeys, session]);

  const addPasskey = useCallback(async () => {
    if (!session || addingPasskey) return;
    setAddingPasskey(true);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("Session unavailable");
      const registration = await beginAccountPasskeyEnrollment(currentSession.accessToken, {
        refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null,
      });
      const credential = await createNativePasskey(registration.publicKey);
      await completeAccountPasskeyEnrollment(
        currentSession.accessToken,
        registration.challengeId,
        credential,
        passkeyLabel.trim() || `${dictionary.accountPasskeysTitle} ${passkeys.length + 1}`,
        { refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null },
      );
      setPasskeyLabel("");
      await loadPasskeys(true);
      showNotice({ kind: "success", message: dictionary.accountPasskeyAdded });
    } catch {
      setPasskeysError(true);
      showNotice({ kind: "error", message: dictionary.accountPasskeyAddError });
    } finally {
      setAddingPasskey(false);
    }
  }, [addingPasskey, dictionary.accountPasskeyAddError, dictionary.accountPasskeyAdded, dictionary.accountPasskeysTitle, loadPasskeys, passkeyLabel, passkeys.length, refreshSession, session, showNotice]);

  const createPersonalToken = useCallback(async () => {
    if (!session || creatingPersonalAccessToken) return;
    const name = personalAccessTokenName.trim();
    const description = personalAccessTokenDescription.trim();
    if (!name) {
      setPersonalAccessTokenFormError(dictionary.personalAccessTokenNameRequired);
      return;
    }
    if (name.length > 100) {
      setPersonalAccessTokenFormError(dictionary.personalAccessTokenNameTooLong);
      return;
    }
    if (description.length > 500) {
      setPersonalAccessTokenFormError(dictionary.personalAccessTokenDescriptionTooLong);
      return;
    }
    if (personalAccessTokenExpiration === "custom" && !personalAccessTokenCustomDate) {
      setPersonalAccessTokenFormError(dictionary.personalAccessTokenCustomDateRequired);
      return;
    }
    if (personalAccessTokenExpiration === "custom" && !isValidCustomExpirationDate(personalAccessTokenCustomDate)) {
      setPersonalAccessTokenFormError(dictionary.personalAccessTokenCustomDateInvalid);
      return;
    }
    setCreatingPersonalAccessToken(true);
    setPersonalAccessTokenFormError("");
    setPersonalAccessTokenActionError("");
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("Session unavailable");
      const result = await createPersonalAccessToken(
        currentSession.accessToken,
        {
          name,
          description: description || null,
          expiration: personalAccessTokenExpiration,
          ...(personalAccessTokenExpiration === "custom"
            ? { customExpirationDate: personalAccessTokenCustomDate }
            : {}),
        },
        { refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null },
      );
      setCreatedPersonalAccessToken(result);
      setCreatedPersonalAccessTokenVisible(true);
      setPersonalAccessTokenName("");
      setPersonalAccessTokenDescription("");
      setPersonalAccessTokenCustomDate("");
      await loadPersonalAccessTokens(true);
      showNotice({ kind: "success", message: dictionary.personalAccessTokenCreated });
    } catch {
      setPersonalAccessTokenActionError(dictionary.personalAccessTokenCreateError);
      showNotice({ kind: "error", message: dictionary.personalAccessTokenCreateError });
    } finally {
      setCreatingPersonalAccessToken(false);
    }
  }, [creatingPersonalAccessToken, dictionary.personalAccessTokenCreateError, dictionary.personalAccessTokenCreated, dictionary.personalAccessTokenCustomDateInvalid, dictionary.personalAccessTokenCustomDateRequired, dictionary.personalAccessTokenDescriptionTooLong, dictionary.personalAccessTokenNameRequired, dictionary.personalAccessTokenNameTooLong, loadPersonalAccessTokens, personalAccessTokenCustomDate, personalAccessTokenDescription, personalAccessTokenExpiration, personalAccessTokenName, refreshSession, session, showNotice]);

  const copyPersonalAccessToken = useCallback(async () => {
    if (!createdPersonalAccessToken || copyingPersonalAccessToken) return;
    setCopyingPersonalAccessToken(true);
    setPersonalAccessTokenActionError("");
    try {
      await Clipboard.setStringAsync(createdPersonalAccessToken.token);
      showNotice({ kind: "success", message: dictionary.personalAccessTokenCopied });
    } catch {
      setPersonalAccessTokenActionError(dictionary.personalAccessTokenCopyError);
      showNotice({ kind: "error", message: dictionary.personalAccessTokenCopyError });
    } finally {
      setCopyingPersonalAccessToken(false);
    }
  }, [copyingPersonalAccessToken, createdPersonalAccessToken, dictionary.personalAccessTokenCopied, dictionary.personalAccessTokenCopyError, showNotice]);

  const revokePersonalToken = useCallback(async (token: PersonalAccessToken) => {
    if (!session || revokingPersonalAccessTokenId) return;
    setRevokingPersonalAccessTokenId(token.id);
    setPersonalAccessTokenActionError("");
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("Session unavailable");
      await revokePersonalAccessToken(currentSession.accessToken, token.id, {
        refreshAccessToken: async () => (await refreshSession(true))?.accessToken ?? null,
      });
      if (createdPersonalAccessToken?.id === token.id) setCreatedPersonalAccessToken(null);
      await loadPersonalAccessTokens(true);
      showNotice({ kind: "success", message: dictionary.personalAccessTokenRevoked });
    } catch {
      setPersonalAccessTokenActionError(dictionary.personalAccessTokenRevokeError);
      showNotice({ kind: "error", message: dictionary.personalAccessTokenRevokeError });
    } finally {
      setRevokingPersonalAccessTokenId(null);
    }
  }, [createdPersonalAccessToken, dictionary.personalAccessTokenRevokeError, dictionary.personalAccessTokenRevoked, loadPersonalAccessTokens, refreshSession, revokingPersonalAccessTokenId, session, showNotice]);

  const confirmRevokePersonalToken = (token: PersonalAccessToken) => {
    Alert.alert(dictionary.personalAccessTokenRevoke, dictionary.personalAccessTokenRevokeConfirm, [
      { text: dictionary.cancel, style: "cancel" },
      {
        onPress: () => void revokePersonalToken(token),
        text: dictionary.personalAccessTokenRevoke,
        style: "destructive",
      },
    ]);
  };

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
      if (cause instanceof AccountApiError) {
        const fieldErrors = {
          ...apiFieldErrors(cause.data),
          ...problemFieldErrors(cause.problem?.violations),
        };
        setPasswordErrors(
          Object.keys(fieldErrors).length > 0
            ? fieldErrors
            : { currentPassword: dictionary.passwordSaveError },
        );
      } else {
        setPasswordErrors({ currentPassword: dictionary.passwordSaveError });
      }
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
      await loadSessions(true, sessionsPageRef.current);
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
        await loadSessions(true, sessionsPageRef.current);
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
        <MobileFormScrollView
          testID="security-content"
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
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {dictionary.personalAccessTokensTitle}
            </Text>
            <Text style={[styles.help, { color: palette.textMuted }]}>
              {dictionary.personalAccessTokensHelp}
            </Text>
            {personalAccessTokensLoading ? (
              <ActivityIndicator
                color={palette.primary}
                accessibilityLabel={dictionary.loading}
                style={styles.loading}
              />
            ) : personalAccessTokensError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadPersonalAccessTokens(true)}
                style={[styles.errorAction, { borderColor: palette.danger }]}
              >
                <Text style={{ color: palette.danger }}>
                  {dictionary.personalAccessTokensError}
                </Text>
                <Text style={{ color: palette.primary }}>
                  {dictionary.sessionsRetry}
                </Text>
              </Pressable>
            ) : personalAccessTokens.length === 0 ? (
              <Text style={[styles.help, { color: palette.textMuted }]}>
                {dictionary.personalAccessTokensEmpty}
              </Text>
            ) : (
              personalAccessTokens.map((token) => (
                <View
                  key={token.id}
                  style={[styles.session, { borderColor: palette.border }]}
                >
                  <Text style={[styles.sessionTitle, { color: palette.text }]}>
                    {token.name}
                  </Text>
                  {token.description ? (
                    <Text style={[styles.sessionMeta, { color: palette.textMuted }]}>
                      {token.description}
                    </Text>
                  ) : null}
                  <Text style={[styles.sessionMeta, { color: palette.textMuted }]}>
                    mcp.read · {dictionary.personalAccessTokenExpiresAt}: {token.expiresAt ? formatDate(token.expiresAt, resolvedLocale) : dictionary.personalAccessTokenNever}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    testID="pat-revoke"
                    accessibilityState={{ disabled: Boolean(revokingPersonalAccessTokenId) }}
                    disabled={Boolean(revokingPersonalAccessTokenId)}
                    onPress={() => confirmRevokePersonalToken(token)}
                    style={[styles.sessionAction, { borderColor: palette.danger, opacity: revokingPersonalAccessTokenId ? 0.65 : 1 }]}
                  >
                    {revokingPersonalAccessTokenId === token.id ? (
                      <ActivityIndicator color={palette.danger} accessibilityLabel={dictionary.loading} />
                    ) : null}
                    <Text style={{ color: palette.danger, fontWeight: "700" }}>
                      {dictionary.personalAccessTokenRevoke}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
            {createdPersonalAccessToken ? (
              <View style={[styles.tokenReveal, { borderColor: palette.danger, backgroundColor: palette.surface }]}>
                <Text style={[styles.sessionTitle, { color: palette.text }]}>
                  {dictionary.personalAccessTokenCreatedTitle}
                </Text>
                <Text style={[styles.help, { color: palette.textMuted }]}>
                  {dictionary.personalAccessTokenCreatedHelp}
                </Text>
                <Text selectable style={[styles.tokenValue, { color: palette.text, borderColor: palette.border }]}>
                  {createdPersonalAccessTokenVisible ? createdPersonalAccessToken.token : "••••••••••••••••••••••••••••••••"}
                </Text>
                <View style={styles.tokenActions}>
                  <Pressable
                    accessibilityRole="button"
                    testID="pat-copy"
                    accessibilityState={{ disabled: copyingPersonalAccessToken }}
                    disabled={copyingPersonalAccessToken}
                    onPress={() => void copyPersonalAccessToken()}
                    style={[styles.sessionAction, { borderColor: palette.border, opacity: copyingPersonalAccessToken ? 0.65 : 1 }]}
                  >
                    {copyingPersonalAccessToken ? <ActivityIndicator color={palette.text} accessibilityLabel={dictionary.loading} /> : null}
                    <Text style={{ color: palette.text, fontWeight: "700" }}>
                      {dictionary.personalAccessTokenCopy}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID="pat-hide"
                    onPress={() => setCreatedPersonalAccessTokenVisible((visible) => !visible)}
                    style={[styles.sessionAction, { borderColor: palette.border }]}
                  >
                    <Text style={{ color: palette.text, fontWeight: "700" }}>
                      {createdPersonalAccessTokenVisible ? dictionary.personalAccessTokenHide : dictionary.personalAccessTokenShow}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID="pat-dismiss"
                    onPress={() => setCreatedPersonalAccessToken(null)}
                    style={[styles.sessionAction, { borderColor: palette.border }]}
                  >
                    <Text style={{ color: palette.text, fontWeight: "700" }}>
                      {dictionary.personalAccessTokenDismiss}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>
                {dictionary.personalAccessTokenName}
              </Text>
              <TextInput
                accessibilityLabel={dictionary.personalAccessTokenName}
                autoCapitalize="sentences"
                editable={!creatingPersonalAccessToken}
                maxLength={100}
                onSubmitEditing={Keyboard.dismiss}
                testID="personalAccessTokenName"
                onChangeText={(value) => {
                  setPersonalAccessTokenName(value);
                  setPersonalAccessTokenFormError("");
                }}
                placeholder={dictionary.personalAccessTokenName}
                placeholderTextColor={palette.textMuted}
                returnKeyType="done"
                style={[styles.input, { borderColor: personalAccessTokenFormError ? palette.danger : palette.border, color: palette.text }]}
                value={personalAccessTokenName}
              />
              {personalAccessTokenFormError === dictionary.personalAccessTokenNameRequired || personalAccessTokenFormError === dictionary.personalAccessTokenNameTooLong ? (
                <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>
                  {personalAccessTokenFormError}
                </Text>
              ) : null}
              <Text style={[styles.label, { color: palette.text, marginTop: spacing.md }]}>
                {dictionary.personalAccessTokenDescription}
              </Text>
              <TextInput
                accessibilityLabel={dictionary.personalAccessTokenDescription}
                editable={!creatingPersonalAccessToken}
                maxLength={500}
                multiline
                onChangeText={(value) => {
                  setPersonalAccessTokenDescription(value);
                  setPersonalAccessTokenFormError("");
                }}
                placeholder={dictionary.personalAccessTokenDescription}
                placeholderTextColor={palette.textMuted}
                testID="personalAccessTokenDescription"
                style={[styles.input, styles.multilineInput, { borderColor: palette.border, color: palette.text }]}
                textAlignVertical="top"
                value={personalAccessTokenDescription}
              />
              {personalAccessTokenFormError === dictionary.personalAccessTokenDescriptionTooLong ? (
                <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>
                  {personalAccessTokenFormError}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.label, { color: palette.text }]}>
              {dictionary.personalAccessTokenExpiry}
            </Text>
            <View style={styles.expiryOptions}>
              {(["7", "30", "60", "90", "custom", "never"] as const).map((choice) => {
                const label = choice === "custom"
                  ? dictionary.personalAccessTokenCustom
                  : choice === "never"
                    ? dictionary.personalAccessTokenNever
                    : dictionary.personalAccessTokenExpiresIn.replace("{{count}}", choice);
                const selected = personalAccessTokenExpiration === choice;
                return (
                  <Pressable
                    key={choice}
                    testID={`pat-expiration-${choice}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: creatingPersonalAccessToken }}
                    disabled={creatingPersonalAccessToken}
                    onPress={() => {
                      setPersonalAccessTokenExpiration(choice);
                      setPersonalAccessTokenFormError("");
                    }}
                    style={[styles.expiryChoice, { backgroundColor: selected ? palette.primary : palette.surface, borderColor: selected ? palette.primary : palette.border }]}
                  >
                    <Text style={{ color: selected ? palette.onPrimary : palette.text, fontWeight: "600" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {personalAccessTokenExpiration === "custom" ? (
              <>
                <TextInput
                  accessibilityLabel={dictionary.personalAccessTokenCustom}
                  editable={!creatingPersonalAccessToken}
                  onChangeText={(value) => {
                    setPersonalAccessTokenCustomDate(value);
                    setPersonalAccessTokenFormError("");
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.textMuted}
                  testID="personalAccessTokenCustomDate"
                  style={[styles.input, { borderColor: personalAccessTokenFormError ? palette.danger : palette.border, color: palette.text }]}
                  value={personalAccessTokenCustomDate}
                />
                {personalAccessTokenFormError === dictionary.personalAccessTokenCustomDateRequired || personalAccessTokenFormError === dictionary.personalAccessTokenCustomDateInvalid ? (
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>
                    {personalAccessTokenFormError}
                  </Text>
                ) : null}
                <Text style={[styles.help, { color: palette.textMuted }]}>
                  {dictionary.personalAccessTokenCustomDateHelp}
                </Text>
              </>
            ) : null}
            {personalAccessTokenExpiration === "never" ? (
              <Text style={[styles.warningText, { color: palette.danger }]}>
                {dictionary.personalAccessTokenNeverWarning}
              </Text>
            ) : null}
            {personalAccessTokenActionError ? (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: palette.danger }]}>
                {personalAccessTokenActionError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: creatingPersonalAccessToken }}
              disabled={creatingPersonalAccessToken}
              onPress={() => void createPersonalToken()}
              testID="pat-create"
              style={[styles.primaryAction, { backgroundColor: palette.primary, opacity: creatingPersonalAccessToken ? 0.65 : 1 }]}
            >
              {creatingPersonalAccessToken ? <ActivityIndicator color={palette.onPrimary} accessibilityLabel={dictionary.loading} /> : null}
              <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
                {dictionary.personalAccessTokenCreate}
              </Text>
            </Pressable>
          </View>

          <View
            style={[styles.section, { borderColor: palette.border }]}
            testID="account-passkeys"
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {dictionary.accountPasskeysTitle}
            </Text>
            <Text style={[styles.help, { color: palette.textMuted }]}>
              {dictionary.accountPasskeysHelp}
            </Text>
            {passkeysLoading ? (
              <ActivityIndicator color={palette.primary} accessibilityLabel={dictionary.loading} />
            ) : passkeysError ? (
              <Pressable accessibilityRole="button" onPress={() => void loadPasskeys(true)} style={styles.errorAction}>
                <Text style={{ color: palette.danger }}>{dictionary.accountPasskeyListError}</Text>
                <Text style={{ color: palette.primary }}>{dictionary.sessionsRetry}</Text>
              </Pressable>
            ) : passkeys.length === 0 ? (
              <Text style={[styles.help, { color: palette.textMuted }]}>{dictionary.accountPasskeysEmpty}</Text>
            ) : passkeys.map((passkey) => (
              <View key={passkey.credentialId} style={[styles.session, { borderColor: palette.border }]}>
                <Text style={[styles.sessionTitle, { color: palette.text }]}>{passkey.label}</Text>
                <Text style={[styles.sessionMeta, { color: palette.textMuted }]}>{formatDate(passkey.createdAt, resolvedLocale)}</Text>
              </View>
            ))}
            <TextInput
              accessibilityLabel={dictionary.accountPasskeyLabel}
              onChangeText={setPasskeyLabel}
              placeholder={dictionary.accountPasskeyLabel}
              placeholderTextColor={palette.textMuted}
              value={passkeyLabel}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
            <Pressable accessibilityRole="button" testID="passkey-add" accessibilityState={{ disabled: addingPasskey }} disabled={addingPasskey} onPress={() => void addPasskey()} style={[styles.primaryAction, { backgroundColor: palette.primary, opacity: addingPasskey ? 0.65 : 1 }]}>
              {addingPasskey ? <ActivityIndicator color={palette.onPrimary} accessibilityLabel={dictionary.loading} /> : null}
              <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>{dictionary.accountPasskeyAdd}</Text>
            </Pressable>
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
            {sessionsLoading && !sessionsPage ? (
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
                    <Text
                      style={[styles.sessionTitle, { color: palette.text }]}
                    >
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
            {sessionsPage && !sessionsError ? (
              <AccountPagination
                loading={sessionsLoading}
                loadingDirection={sessionsPageDirection}
                onNext={() =>
                  void loadSessions(false, sessionsPage.number + 1, "next")
                }
                onPrevious={() =>
                  void loadSessions(
                    false,
                    Math.max(0, sessionsPage.number - 1),
                    "previous",
                  )
                }
                page={sessionsPage}
              />
            ) : null}
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
        </MobileFormScrollView>
        <AccountTabBar active="security" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xl * 4,
  },
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
  tokenReveal: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  tokenValue: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontFamily: "monospace",
    fontSize: 13,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  tokenActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  expiryOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  expiryChoice: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  multilineInput: { minHeight: 88, paddingVertical: spacing.md },
  warningText: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  sessionAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 44,
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
