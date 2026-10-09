import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { AccountTabBar } from "@/components/AccountTabBar";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import {
  listAccountApplications,
  listOfflineSessions,
  revokeAccountApplication,
  revokeOfflineSession,
  type AccountApplication,
  type AccountOfflineSession,
} from "@/api/account-api";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function ApplicationsScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const { session, status, refreshSession } = useMobileAuth();
  const { showNotice } = useMobileNotice();
  const [applications, setApplications] = useState<AccountApplication[]>([]);
  const [offlineSessions, setOfflineSessions] = useState<
    AccountOfflineSession[]
  >([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadData = useCallback(
    async (retry = false) => {
      if (!session) return;
      setApplicationsLoading(true);
      setOfflineLoading(true);
      setApplicationsError(false);
      setOfflineError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) {
          setApplicationsError(true);
          setOfflineError(true);
          return;
        }
        const tokenOptions = {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        const [applicationPage, offlinePage] = await Promise.all([
          listAccountApplications(currentSession.accessToken, tokenOptions),
          listOfflineSessions(currentSession.accessToken, tokenOptions),
        ]);
        setApplications(applicationPage.content ?? []);
        setOfflineSessions(offlinePage.content ?? []);
      } catch {
        setApplicationsError(true);
        setOfflineError(true);
      } finally {
        setApplicationsLoading(false);
        setOfflineLoading(false);
      }
    },
    [refreshSession, session],
  );

  useEffect(() => {
    if (status !== "loading" && !session) router.replace("/sign-in");
  }, [session, status]);

  useEffect(() => {
    if (session) queueMicrotask(() => void loadData());
  }, [loadData, session]);

  const revokeApplication = useCallback(
    async (application: AccountApplication) => {
      if (!session || busyKey) return;
      const key = `application:${application.clientId}`;
      setBusyKey(key);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await revokeAccountApplication(
          currentSession.accessToken,
          application.clientId,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        await loadData(true);
        showNotice({
          kind: "success",
          message: dictionary.revokeApplicationSuccess,
        });
      } catch {
        showNotice({
          kind: "error",
          message: dictionary.revokeApplicationError,
        });
      } finally {
        setBusyKey(null);
      }
    },
    [
      busyKey,
      dictionary.revokeApplicationError,
      dictionary.revokeApplicationSuccess,
      loadData,
      refreshSession,
      showNotice,
      session,
    ],
  );

  const revokeOffline = useCallback(
    async (offlineSession: AccountOfflineSession) => {
      if (!session || busyKey) return;
      const key = `offline:${offlineSession.id}`;
      setBusyKey(key);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await revokeOfflineSession(
          currentSession.accessToken,
          offlineSession.id,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        await loadData(true);
        showNotice({
          kind: "success",
          message: dictionary.revokeOfflineSessionSuccess,
        });
      } catch {
        showNotice({
          kind: "error",
          message: dictionary.revokeOfflineSessionError,
        });
      } finally {
        setBusyKey(null);
      }
    },
    [
      busyKey,
      dictionary.revokeOfflineSessionError,
      dictionary.revokeOfflineSessionSuccess,
      loadData,
      refreshSession,
      showNotice,
      session,
    ],
  );

  const confirmApplication = (application: AccountApplication) => {
    Alert.alert(
      dictionary.revokeApplication,
      dictionary.revokeApplicationConfirm,
      [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.revokeApplication,
          style: "destructive",
          onPress: () => void revokeApplication(application),
        },
      ],
    );
  };

  const confirmOffline = (offlineSession: AccountOfflineSession) => {
    Alert.alert(
      dictionary.revokeOfflineSession,
      dictionary.revokeOfflineSessionConfirm,
      [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.revokeOfflineSession,
          style: "destructive",
          onPress: () => void revokeOffline(offlineSession),
        },
      ],
    );
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
              {dictionary.applications}
            </Text>
          </View>

          <SectionHeader
            palette={palette}
            title={dictionary.applicationsTitle}
          />
          {applicationsLoading ? (
            <ActivityIndicator
              color={palette.primary}
              accessibilityLabel={dictionary.loading}
            />
          ) : applicationsError ? (
            <RetryRow
              label={dictionary.applicationsError}
              retry={dictionary.sessionsRetry}
              onPress={() => void loadData(true)}
              palette={palette}
            />
          ) : applications.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              {dictionary.applicationsEmpty}
            </Text>
          ) : (
            applications.map((application) => (
              <View
                key={application.clientId}
                style={[styles.card, { borderColor: palette.border }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {application.clientName}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {application.clientId}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {application.scopes.join(", ")}
                </Text>
                <ActionButton
                  label={dictionary.revokeApplication}
                  loading={busyKey === `application:${application.clientId}`}
                  disabled={Boolean(busyKey)}
                  onPress={() => confirmApplication(application)}
                  palette={palette}
                />
              </View>
            ))
          )}

          <SectionHeader
            palette={palette}
            title={dictionary.offlineSessionsTitle}
            help={dictionary.offlineSessionsHelp}
          />
          {offlineLoading ? (
            <ActivityIndicator
              color={palette.primary}
              accessibilityLabel={dictionary.loading}
            />
          ) : offlineError ? (
            <RetryRow
              label={dictionary.offlineSessionsError}
              retry={dictionary.sessionsRetry}
              onPress={() => void loadData(true)}
              palette={palette}
            />
          ) : offlineSessions.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              {dictionary.offlineSessionsEmpty}
            </Text>
          ) : (
            offlineSessions.map((offlineSession) => (
              <View
                key={offlineSession.id}
                style={[styles.card, { borderColor: palette.border }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {offlineSession.clientName}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {offlineSession.clientId}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {dictionary.offlineIssued}:{" "}
                  {formatDate(offlineSession.issuedAt, resolvedLocale, "—")}
                </Text>
                <Text style={[styles.meta, { color: palette.textMuted }]}>
                  {dictionary.offlineExpires}:{" "}
                  {formatDate(
                    offlineSession.expiresAt,
                    resolvedLocale,
                    dictionary.offlineNoExpiry,
                  )}
                </Text>
                <ActionButton
                  label={dictionary.revokeOfflineSession}
                  loading={busyKey === `offline:${offlineSession.id}`}
                  disabled={Boolean(busyKey)}
                  onPress={() => confirmOffline(offlineSession)}
                  palette={palette}
                />
              </View>
            ))
          )}
        </ScrollView>
        <AccountTabBar active="applications" />
      </View>
    </SafeAreaView>
  );
}

function SectionHeader({
  help,
  palette,
  title,
}: {
  help?: string;
  palette: ReturnType<typeof useTheme>["palette"];
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {title}
      </Text>
      {help ? (
        <Text style={[styles.help, { color: palette.textMuted }]}>{help}</Text>
      ) : null}
    </View>
  );
}

function RetryRow({
  label,
  onPress,
  palette,
  retry,
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  retry: string;
}) {
  return (
    <View style={[styles.retry, { borderColor: palette.danger }]}>
      <Text style={{ color: palette.danger }}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>
          {retry}
        </Text>
      </Pressable>
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
        { borderColor: palette.border, opacity: disabled ? 0.65 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} accessibilityLabel={label} />
      ) : null}
      <Text style={{ color: palette.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.xl },
  header: { alignSelf: "stretch", gap: spacing.md },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  title: { fontSize: 28, fontWeight: "800" },
  sectionHeader: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  help: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  empty: { fontSize: 14, marginTop: spacing.sm },
  retry: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: spacing.xs },
  action: {
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
});
