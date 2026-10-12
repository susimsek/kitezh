import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  decideCibaRequest,
  listAccountApplications,
  listCibaRequests,
  listOfflineSessions,
  revokeAccountApplication,
  revokeOfflineSession,
  type AccountApplication,
  type AccountOfflineSession,
  type CibaPendingRequest,
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
  const [cibaRequests, setCibaRequests] = useState<CibaPendingRequest[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [cibaLoading, setCibaLoading] = useState(false);
  const [cibaError, setCibaError] = useState(false);
  const [cibaBusy, setCibaBusy] = useState<{
    authReqId: string;
    decision: "approve" | "deny";
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const mutationInFlight = useRef(false);

  const loadData = useCallback(
    async (retry = false) => {
      if (!session) return;
      setApplicationsLoading(true);
      setOfflineLoading(true);
      setCibaLoading(true);
      setApplicationsError(false);
      setOfflineError(false);
      setCibaError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) {
          setApplicationsError(true);
          setOfflineError(true);
          setCibaError(true);
          return;
        }
        const tokenOptions = {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        const [applicationResult, offlineResult, cibaResult] =
          await Promise.allSettled([
            listAccountApplications(currentSession.accessToken, tokenOptions),
            listOfflineSessions(currentSession.accessToken, tokenOptions),
            listCibaRequests(currentSession.accessToken, tokenOptions),
          ]);
        if (applicationResult.status === "fulfilled") {
          setApplications(applicationResult.value.content ?? []);
        } else {
          setApplicationsError(true);
        }
        if (offlineResult.status === "fulfilled") {
          setOfflineSessions(offlineResult.value.content ?? []);
        } else {
          setOfflineError(true);
        }
        if (cibaResult.status === "fulfilled") {
          setCibaRequests(cibaResult.value.content ?? []);
        } else {
          setCibaError(true);
        }
      } catch {
        setApplicationsError(true);
        setOfflineError(true);
        setCibaError(true);
      } finally {
        setApplicationsLoading(false);
        setOfflineLoading(false);
        setCibaLoading(false);
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
      if (!session || busyKey || mutationInFlight.current) return;
      mutationInFlight.current = true;
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
        mutationInFlight.current = false;
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
      if (!session || busyKey || mutationInFlight.current) return;
      mutationInFlight.current = true;
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
        mutationInFlight.current = false;
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

  const decideCiba = useCallback(
    async (request: CibaPendingRequest, decision: "approve" | "deny") => {
      if (!session || busyKey || mutationInFlight.current) return;
      if (
        decision === "approve" &&
        (request.mfaRequired || request.stepUpRequired)
      ) {
        return;
      }
      mutationInFlight.current = true;
      const key = `ciba:${request.authReqId}`;
      setBusyKey(key);
      setCibaBusy({ authReqId: request.authReqId, decision });
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await decideCibaRequest(currentSession.accessToken, request, decision, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        setCibaRequests((current) =>
          current.filter((item) => item.authReqId !== request.authReqId),
        );
        showNotice({
          kind: "success",
          message:
            decision === "approve"
              ? dictionary.cibaApproved
              : dictionary.cibaDenied,
        });
      } catch {
        showNotice({ kind: "error", message: dictionary.cibaDecisionError });
      } finally {
        setCibaBusy(null);
        setBusyKey(null);
        mutationInFlight.current = false;
      }
    },
    [busyKey, dictionary, refreshSession, session, showNotice],
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

          <SectionHeader
            palette={palette}
            title={dictionary.cibaTitle}
            help={dictionary.cibaHelp}
          />
          {cibaLoading ? (
            <ActivityIndicator
              color={palette.primary}
              accessibilityLabel={dictionary.loading}
            />
          ) : cibaError ? (
            <RetryRow
              label={dictionary.cibaLoadError}
              retry={dictionary.sessionsRetry}
              onPress={() => void loadData(true)}
              palette={palette}
            />
          ) : cibaRequests.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              {dictionary.cibaEmpty}
            </Text>
          ) : (
            cibaRequests.map((request) => {
              const requiresStepUp =
                request.mfaRequired || request.stepUpRequired;
              return (
                <View
                  key={request.authReqId}
                  style={[styles.card, { borderColor: palette.border }]}
                >
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {request.bindingMessage || dictionary.cibaRequestTitle}
                  </Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {dictionary.cibaCode}: {request.userCode}
                  </Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {dictionary.cibaScopes}: {request.authorizedScopes}
                  </Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {dictionary.cibaExpires}:{" "}
                    {formatDate(request.expiresAt, resolvedLocale, "—")}
                  </Text>
                  {requiresStepUp ? (
                    <Text style={[styles.meta, { color: palette.danger }]}>
                      {request.mfaRequired && request.stepUpRequired
                        ? dictionary.cibaMfaAndStepUpRequired
                        : request.mfaRequired
                          ? dictionary.cibaMfaRequired
                          : dictionary.cibaStepUpRequired}
                    </Text>
                  ) : null}
                  <View style={styles.cibaActions}>
                    <ActionButton
                      label={dictionary.cibaApprove}
                      loading={
                        cibaBusy?.authReqId === request.authReqId &&
                        cibaBusy.decision === "approve"
                      }
                      disabled={Boolean(busyKey) || requiresStepUp}
                      onPress={() => void decideCiba(request, "approve")}
                      palette={palette}
                    />
                    <ActionButton
                      label={dictionary.cibaDeny}
                      loading={
                        cibaBusy?.authReqId === request.authReqId &&
                        cibaBusy.decision === "deny"
                      }
                      disabled={Boolean(busyKey)}
                      onPress={() => void decideCiba(request, "deny")}
                      palette={palette}
                    />
                  </View>
                </View>
              );
            })
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
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  cibaActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
