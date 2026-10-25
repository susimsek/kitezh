import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { AccountPagination } from "@/components/AccountPagination";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import {
  approveCibaRequestWithMfa,
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
  const [applicationsPage, setApplicationsPage] = useState<{
    number: number;
    totalPages: number;
  } | null>(null);
  const [offlineSessions, setOfflineSessions] = useState<
    AccountOfflineSession[]
  >([]);
  const [offlinePage, setOfflinePage] = useState<{
    number: number;
    totalPages: number;
  } | null>(null);
  const [cibaRequests, setCibaRequests] = useState<CibaPendingRequest[]>([]);
  const [cibaPage, setCibaPage] = useState<{
    number: number;
    totalPages: number;
  } | null>(null);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [cibaLoading, setCibaLoading] = useState(false);
  const [applicationsPageDirection, setApplicationsPageDirection] = useState<
    "next" | "previous" | null
  >(null);
  const [offlinePageDirection, setOfflinePageDirection] = useState<
    "next" | "previous" | null
  >(null);
  const [cibaPageDirection, setCibaPageDirection] = useState<
    "next" | "previous" | null
  >(null);
  const [applicationsError, setApplicationsError] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [cibaError, setCibaError] = useState(false);
  const [cibaBusy, setCibaBusy] = useState<{
    authReqId: string;
    decision: "approve" | "deny";
  } | null>(null);
  const [cibaMfaCodes, setCibaMfaCodes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const pageRequestsInFlight = useRef({
    applications: false,
    offline: false,
    ciba: false,
  });
  const pageNumbers = useRef({ applications: 0, offline: 0, ciba: 0 });

  const loadApplicationsPage = useCallback(
    async (
      requestedPage: number,
      retry = false,
      direction: "next" | "previous" | null = null,
    ) => {
      if (!session || pageRequestsInFlight.current.applications) return;
      pageRequestsInFlight.current.applications = true;
      setApplicationsLoading(true);
      setApplicationsPageDirection(direction);
      setApplicationsError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error("No active session");
        const tokenOptions = {
          page: requestedPage,
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        let page = await listAccountApplications(
          currentSession.accessToken,
          tokenOptions,
        );
        if (requestedPage > 0 && requestedPage >= page.totalPages) {
          page = await listAccountApplications(currentSession.accessToken, {
            ...tokenOptions,
            page: Math.max(0, page.totalPages - 1),
          });
        }
        setApplications(page.content ?? []);
        pageNumbers.current.applications = page.number;
        setApplicationsPage({
          number: page.number,
          totalPages: page.totalPages,
        });
      } catch {
        setApplicationsError(true);
      } finally {
        setApplicationsLoading(false);
        setApplicationsPageDirection(null);
        pageRequestsInFlight.current.applications = false;
      }
    },
    [refreshSession, session],
  );

  const loadOfflinePage = useCallback(
    async (
      requestedPage: number,
      retry = false,
      direction: "next" | "previous" | null = null,
    ) => {
      if (!session || pageRequestsInFlight.current.offline) return;
      pageRequestsInFlight.current.offline = true;
      setOfflineLoading(true);
      setOfflinePageDirection(direction);
      setOfflineError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error("No active session");
        const tokenOptions = {
          page: requestedPage,
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        let page = await listOfflineSessions(
          currentSession.accessToken,
          tokenOptions,
        );
        if (requestedPage > 0 && requestedPage >= page.totalPages) {
          page = await listOfflineSessions(currentSession.accessToken, {
            ...tokenOptions,
            page: Math.max(0, page.totalPages - 1),
          });
        }
        setOfflineSessions(page.content ?? []);
        pageNumbers.current.offline = page.number;
        setOfflinePage({ number: page.number, totalPages: page.totalPages });
      } catch {
        setOfflineError(true);
      } finally {
        setOfflineLoading(false);
        setOfflinePageDirection(null);
        pageRequestsInFlight.current.offline = false;
      }
    },
    [refreshSession, session],
  );

  const loadCibaPage = useCallback(
    async (
      requestedPage: number,
      retry = false,
      direction: "next" | "previous" | null = null,
    ) => {
      if (!session || pageRequestsInFlight.current.ciba) return;
      pageRequestsInFlight.current.ciba = true;
      setCibaLoading(true);
      setCibaPageDirection(direction);
      setCibaError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error("No active session");
        const tokenOptions = {
          page: requestedPage,
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        let page = await listCibaRequests(
          currentSession.accessToken,
          tokenOptions,
        );
        if (requestedPage > 0 && requestedPage >= page.totalPages) {
          page = await listCibaRequests(currentSession.accessToken, {
            ...tokenOptions,
            page: Math.max(0, page.totalPages - 1),
          });
        }
        setCibaRequests(page.content ?? []);
        pageNumbers.current.ciba = page.number;
        setCibaPage({ number: page.number, totalPages: page.totalPages });
      } catch {
        setCibaError(true);
      } finally {
        setCibaLoading(false);
        setCibaPageDirection(null);
        pageRequestsInFlight.current.ciba = false;
      }
    },
    [refreshSession, session],
  );

  const loadData = useCallback(
    async (retry = false) => {
      await Promise.all([
        loadApplicationsPage(pageNumbers.current.applications, retry),
        loadOfflinePage(pageNumbers.current.offline, retry),
        loadCibaPage(pageNumbers.current.ciba, retry),
      ]);
    },
    [loadApplicationsPage, loadCibaPage, loadOfflinePage],
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
        if (!currentSession) {
          showNotice({
            kind: "error",
            message: dictionary.revokeApplicationError,
          });
          return;
        }
        await revokeAccountApplication(
          currentSession.accessToken,
          application.clientId,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        await loadApplicationsPage(pageNumbers.current.applications, true);
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
      loadApplicationsPage,
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
        if (!currentSession) {
          showNotice({
            kind: "error",
            message: dictionary.revokeOfflineSessionError,
          });
          return;
        }
        await revokeOfflineSession(
          currentSession.accessToken,
          offlineSession.id,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        await loadOfflinePage(pageNumbers.current.offline, true);
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
      loadOfflinePage,
      refreshSession,
      showNotice,
      session,
    ],
  );

  const decideCiba = useCallback(
    async (
      request: CibaPendingRequest,
      decision: "approve" | "deny",
      mfaCode?: string,
    ) => {
      if (!session || busyKey || mutationInFlight.current) return;
      if (
        decision === "approve" &&
        (request.mfaRequired || request.stepUpRequired) &&
        !mfaCode
      ) {
        return;
      }
      mutationInFlight.current = true;
      const key = `ciba:${request.authReqId}`;
      setBusyKey(key);
      setCibaBusy({ authReqId: request.authReqId, decision });
      try {
        const currentSession = await refreshSession();
        if (!currentSession) {
          showNotice({
            kind: "error",
            message: dictionary.cibaDecisionError,
          });
          return;
        }
        const requestOptions = {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        if (decision === "approve" && mfaCode) {
          await approveCibaRequestWithMfa(
            currentSession.accessToken,
            request,
            mfaCode,
            requestOptions,
          );
          setCibaMfaCodes((current) => ({
            ...current,
            [request.authReqId]: "",
          }));
        } else {
          await decideCibaRequest(
            currentSession.accessToken,
            request,
            decision,
            requestOptions,
          );
        }
        await loadCibaPage(pageNumbers.current.ciba);
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
    [busyKey, dictionary, loadCibaPage, refreshSession, session, showNotice],
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
          {(() => {
            if (applicationsLoading && !applicationsPage) {
              return (
                <ActivityIndicator
                  color={palette.primary}
                  accessibilityLabel={dictionary.loading}
                />
              );
            } else {
              if (applicationsError) {
                return (
                  <RetryRow
                    label={dictionary.applicationsError}
                    retry={dictionary.sessionsRetry}
                    onPress={() =>
                      void loadApplicationsPage(
                        pageNumbers.current.applications,
                        true,
                      )
                    }
                    palette={palette}
                  />
                );
              } else {
                if (applications.length === 0) {
                  return (
                    <Text style={[styles.empty, { color: palette.textMuted }]}>
                      {dictionary.applicationsEmpty}
                    </Text>
                  );
                } else {
                  return applications.map((application) => (
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
                        loading={
                          busyKey === `application:${application.clientId}`
                        }
                        disabled={Boolean(busyKey)}
                        onPress={() => confirmApplication(application)}
                        palette={palette}
                      />
                    </View>
                  ));
                }
              }
            }
          })()}
          {!applicationsError && applicationsPage ? (
            <AccountPagination
              loading={applicationsLoading}
              loadingDirection={applicationsPageDirection}
              onNext={() =>
                void loadApplicationsPage(
                  applicationsPage.number + 1,
                  false,
                  "next",
                )
              }
              onPrevious={() =>
                void loadApplicationsPage(
                  applicationsPage.number - 1,
                  false,
                  "previous",
                )
              }
              page={applicationsPage}
            />
          ) : null}

          <SectionHeader
            palette={palette}
            title={dictionary.offlineSessionsTitle}
            help={dictionary.offlineSessionsHelp}
          />
          {(() => {
            if (offlineLoading && !offlinePage) {
              return (
                <ActivityIndicator
                  color={palette.primary}
                  accessibilityLabel={dictionary.loading}
                />
              );
            } else {
              if (offlineError) {
                return (
                  <RetryRow
                    label={dictionary.offlineSessionsError}
                    retry={dictionary.sessionsRetry}
                    onPress={() =>
                      void loadOfflinePage(pageNumbers.current.offline, true)
                    }
                    palette={palette}
                  />
                );
              } else {
                if (offlineSessions.length === 0) {
                  return (
                    <Text style={[styles.empty, { color: palette.textMuted }]}>
                      {dictionary.offlineSessionsEmpty}
                    </Text>
                  );
                } else {
                  return offlineSessions.map((offlineSession) => (
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
                        {formatDate(
                          offlineSession.issuedAt,
                          resolvedLocale,
                          "—",
                        )}
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
                  ));
                }
              }
            }
          })()}
          {!offlineError && offlinePage ? (
            <AccountPagination
              loading={offlineLoading}
              loadingDirection={offlinePageDirection}
              onNext={() =>
                void loadOfflinePage(offlinePage.number + 1, false, "next")
              }
              onPrevious={() =>
                void loadOfflinePage(offlinePage.number - 1, false, "previous")
              }
              page={offlinePage}
            />
          ) : null}

          <SectionHeader
            palette={palette}
            title={dictionary.cibaTitle}
            help={dictionary.cibaHelp}
          />
          {(() => {
            if (cibaLoading && !cibaPage) {
              return (
                <ActivityIndicator
                  color={palette.primary}
                  accessibilityLabel={dictionary.loading}
                />
              );
            } else {
              if (cibaError) {
                return (
                  <RetryRow
                    label={dictionary.cibaLoadError}
                    retry={dictionary.sessionsRetry}
                    onPress={() =>
                      void loadCibaPage(pageNumbers.current.ciba, true)
                    }
                    palette={palette}
                  />
                );
              } else {
                if (cibaRequests.length === 0) {
                  return (
                    <Text style={[styles.empty, { color: palette.textMuted }]}>
                      {dictionary.cibaEmpty}
                    </Text>
                  );
                } else {
                  return cibaRequests.map((request) => {
                    const requiresStepUp =
                      request.mfaRequired || request.stepUpRequired;
                    let stepUpDescription: string =
                      dictionary.cibaStepUpRequired;
                    if (request.mfaRequired && request.stepUpRequired) {
                      stepUpDescription = dictionary.cibaMfaAndStepUpRequired;
                    } else if (request.mfaRequired) {
                      stepUpDescription = dictionary.cibaMfaRequired;
                    }
                    return (
                      <View
                        key={request.authReqId}
                        style={[styles.card, { borderColor: palette.border }]}
                      >
                        <Text
                          style={[styles.cardTitle, { color: palette.text }]}
                        >
                          {request.bindingMessage ||
                            dictionary.cibaRequestTitle}
                        </Text>
                        <Text
                          style={[styles.meta, { color: palette.textMuted }]}
                        >
                          {dictionary.cibaCode}: {request.userCode}
                        </Text>
                        <Text
                          style={[styles.meta, { color: palette.textMuted }]}
                        >
                          {dictionary.cibaScopes}: {request.authorizedScopes}
                        </Text>
                        <Text
                          style={[styles.meta, { color: palette.textMuted }]}
                        >
                          {dictionary.cibaExpires}:{" "}
                          {formatDate(request.expiresAt, resolvedLocale, "—")}
                        </Text>
                        {requiresStepUp ? (
                          <Text
                            style={[styles.meta, { color: palette.danger }]}
                          >
                            {stepUpDescription}
                          </Text>
                        ) : null}
                        {requiresStepUp ? (
                          <TextInput
                            accessibilityLabel={dictionary.mfaCode}
                            autoComplete="one-time-code"
                            keyboardType="number-pad"
                            maxLength={8}
                            onChangeText={(value) =>
                              setCibaMfaCodes((current) => ({
                                ...current,
                                [request.authReqId]: value.replace(/\D/g, ""),
                              }))
                            }
                            placeholder={dictionary.mfaCode}
                            placeholderTextColor={palette.textMuted}
                            style={[
                              styles.cibaMfaCode,
                              {
                                backgroundColor: palette.surface,
                                borderColor: palette.border,
                                color: palette.text,
                              },
                            ]}
                            value={cibaMfaCodes[request.authReqId] ?? ""}
                          />
                        ) : null}
                        <View style={styles.cibaActions}>
                          <ActionButton
                            label={dictionary.cibaApprove}
                            loading={
                              cibaBusy?.authReqId === request.authReqId &&
                              cibaBusy.decision === "approve"
                            }
                            disabled={
                              Boolean(busyKey) ||
                              (requiresStepUp &&
                                !/^\d{6,8}$/.test(
                                  cibaMfaCodes[request.authReqId] ?? "",
                                ))
                            }
                            onPress={() =>
                              void decideCiba(
                                request,
                                "approve",
                                requiresStepUp
                                  ? cibaMfaCodes[request.authReqId]
                                  : undefined,
                              )
                            }
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
                  });
                }
              }
            }
          })()}
          {!cibaError && cibaPage ? (
            <AccountPagination
              loading={cibaLoading}
              loadingDirection={cibaPageDirection}
              onNext={() =>
                void loadCibaPage(cibaPage.number + 1, false, "next")
              }
              onPrevious={() =>
                void loadCibaPage(cibaPage.number - 1, false, "previous")
              }
              page={cibaPage}
            />
          ) : null}
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
  readonly help?: string;
  readonly palette: ReturnType<typeof useTheme>["palette"];
  readonly title: string;
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
  readonly label: string;
  readonly onPress: () => void;
  readonly palette: ReturnType<typeof useTheme>["palette"];
  readonly retry: string;
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
  cibaMfaCode: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 18,
    letterSpacing: 4,
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
});
