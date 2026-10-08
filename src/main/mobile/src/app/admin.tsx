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

import { useMobileAuth, MobileAuthProvider } from "@/auth/MobileAuthProvider";
import {
  AdminApiError,
  deleteAdminUser,
  getAdminDashboard,
  listAdminClientScopes,
  listAdminClients,
  listAdminUsers,
  setAdminUserEnabled,
  type AdminDashboard,
  type AdminClient,
  type AdminClientScope,
  type AdminPage,
  type AdminUser,
} from "@/api/admin-api";
import { AppIcon } from "@/components/AppIcon";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type AdminSection =
  | "dashboard"
  | "users"
  | "clients"
  | "scopes"
  | "settings";

export default function AdminScreen() {
  return (
    <MobileAuthProvider consoleName="admin">
      <AdminConsole />
    </MobileAuthProvider>
  );
}

function AdminConsole() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, signIn, signOut, status, refreshSession } = useMobileAuth();
  const { showNotice } = useMobileNotice();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [users, setUsers] = useState<AdminPage<AdminUser> | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErrorStatus, setUsersErrorStatus] = useState<number | null>(
    null,
  );
  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [userActionKey, setUserActionKey] = useState<string | null>(null);
  const [clients, setClients] = useState<AdminPage<AdminClient> | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErrorStatus, setClientsErrorStatus] = useState<number | null>(
    null,
  );
  const [clientQuery, setClientQuery] = useState("");
  const [clientPage, setClientPage] = useState(0);
  const [scopes, setScopes] = useState<AdminPage<AdminClientScope> | null>(null);
  const [scopesLoading, setScopesLoading] = useState(false);
  const [scopesErrorStatus, setScopesErrorStatus] = useState<number | null>(
    null,
  );
  const [scopeQuery, setScopeQuery] = useState("");
  const [scopePage, setScopePage] = useState(0);

  const loadDashboard = useCallback(
    async (retry = false) => {
      if (!session) return;
      setLoading(true);
      setErrorStatus(null);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) return;
        setDashboard(
          await getAdminDashboard(currentSession.accessToken, {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          }),
        );
      } catch (cause) {
        setErrorStatus(cause instanceof AdminApiError ? cause.status : 0);
      } finally {
        setLoading(false);
      }
    },
    [refreshSession, session],
  );

  const loadUsers = useCallback(
    async (retry = false) => {
      if (!session) return;
      setUsersLoading(true);
      setUsersErrorStatus(null);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) return;
        setUsers(
          await listAdminUsers(
            currentSession.accessToken,
            userQuery,
            userPage,
            10,
            {
              refreshAccessToken: async () =>
                (await refreshSession(true))?.accessToken ?? null,
            },
          ),
        );
      } catch (cause) {
        setUsersErrorStatus(cause instanceof AdminApiError ? cause.status : 0);
      } finally {
        setUsersLoading(false);
      }
    },
    [refreshSession, session, userPage, userQuery],
  );

  const updateUserEnabled = useCallback(
    async (user: AdminUser) => {
      if (!session || userActionKey) return;
      const key = `enabled:${user.id}`;
      setUserActionKey(key);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await setAdminUserEnabled(currentSession.accessToken, user.id, !user.enabled, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        showNotice({ kind: "success", message: dictionary.adminUserUpdated });
        await loadUsers(true);
      } catch (cause) {
        showNotice({
          kind: "error",
          message:
            cause instanceof AdminApiError && cause.status === 403
              ? dictionary.adminForbidden
              : dictionary.adminUserActionError,
        });
      } finally {
        setUserActionKey(null);
      }
    },
    [dictionary.adminForbidden, dictionary.adminUserActionError, dictionary.adminUserUpdated, loadUsers, refreshSession, session, showNotice, userActionKey],
  );

  const loadClients = useCallback(
    async (retry = false) => {
      if (!session) return;
      setClientsLoading(true);
      setClientsErrorStatus(null);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) return;
        setClients(
          await listAdminClients(
            currentSession.accessToken,
            clientQuery,
            clientPage,
            10,
            {
              refreshAccessToken: async () =>
                (await refreshSession(true))?.accessToken ?? null,
            },
          ),
        );
      } catch (cause) {
        setClientsErrorStatus(
          cause instanceof AdminApiError ? cause.status : 0,
        );
      } finally {
        setClientsLoading(false);
      }
    },
    [clientPage, clientQuery, refreshSession, session],
  );

  const loadScopes = useCallback(
    async (retry = false) => {
      if (!session) return;
      setScopesLoading(true);
      setScopesErrorStatus(null);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) return;
        setScopes(
          await listAdminClientScopes(
            currentSession.accessToken,
            scopeQuery,
            scopePage,
            10,
            {
              refreshAccessToken: async () =>
                (await refreshSession(true))?.accessToken ?? null,
            },
          ),
        );
      } catch (cause) {
        setScopesErrorStatus(
          cause instanceof AdminApiError ? cause.status : 0,
        );
      } finally {
        setScopesLoading(false);
      }
    },
    [refreshSession, scopePage, scopeQuery, session],
  );

  const deleteUser = useCallback(
    (user: AdminUser) => {
      if (!session || userActionKey) return;
      Alert.alert(dictionary.adminUserDelete, dictionary.adminUserDeleteConfirm, [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.adminUserDelete,
          style: "destructive",
          onPress: () => {
            void (async () => {
              const key = `delete:${user.id}`;
              setUserActionKey(key);
              try {
                const currentSession = await refreshSession();
                if (!currentSession) throw new Error();
                await deleteAdminUser(currentSession.accessToken, user.id, {
                  refreshAccessToken: async () =>
                    (await refreshSession(true))?.accessToken ?? null,
                });
                showNotice({ kind: "success", message: dictionary.adminUserDeleted });
                await loadUsers(true);
              } catch (cause) {
                showNotice({
                  kind: "error",
                  message:
                    cause instanceof AdminApiError && cause.status === 403
                      ? dictionary.adminForbidden
                      : dictionary.adminUserActionError,
                });
              } finally {
                setUserActionKey(null);
              }
            })();
          },
        },
      ]);
    },
    [dictionary, loadUsers, refreshSession, session, showNotice, userActionKey],
  );

  useEffect(() => {
    if (session) queueMicrotask(() => void loadDashboard());
  }, [loadDashboard, session]);

  useEffect(() => {
    if (session && section === "users") queueMicrotask(() => void loadUsers());
  }, [loadUsers, section, session]);

  useEffect(() => {
    if (session && section === "clients") {
      queueMicrotask(() => void loadClients());
    }
  }, [loadClients, section, session]);

  useEffect(() => {
    if (session && section === "scopes") {
      queueMicrotask(() => void loadScopes());
    }
  }, [loadScopes, section, session]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status !== "signed-in" || !session) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <View style={styles.authContent}>
          <View style={[styles.logo, { backgroundColor: palette.primary }]}>
            <AppIcon name="shield" size={42} color={palette.onPrimary} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>
            {dictionary.adminSignIn}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {dictionary.adminSignInNote}
          </Text>
          {status === "error" ? (
            <Text style={[styles.error, { color: palette.danger }]}>
              {dictionary.authError}
            </Text>
          ) : null}
          <ActionButton
            label={dictionary.signIn}
            busy={status === "signing-in"}
            onPress={() => void signIn()}
            palette={palette}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.smallLogo, { backgroundColor: palette.primary }]}>
              <AppIcon name="shield" size={18} color={palette.onPrimary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Kitezh</Text>
              <Text style={[styles.headerSubtitle, { color: palette.textMuted }]}>
                {dictionary.adminTitle}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dictionary.signOut}
            onPress={() => void signOut()}
            style={styles.iconButton}
          >
            <AppIcon name="logout" size={19} color={palette.textMuted} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: palette.text }]}>
              {section === "dashboard"
                ? dictionary.adminDashboard
                : section === "users"
                  ? dictionary.adminUsers
                : section === "clients"
                  ? dictionary.adminClients
                  : section === "scopes"
                    ? dictionary.adminClientScopes
                    : dictionary.adminSettings}
            </Text>
            <Text style={[styles.subtitle, { color: palette.textMuted }]}>
              {section === "dashboard"
                ? dictionary.adminOverview
                : section === "scopes"
                  ? dictionary.adminOverview
                  : dictionary.adminComingSoon}
            </Text>
            {section === "dashboard" ? (
              <DashboardContent
                dashboard={dashboard}
                errorStatus={errorStatus}
                loading={loading}
                onRetry={() => void loadDashboard(true)}
              />
            ) : section === "users" ? (
              <UsersContent
                errorStatus={usersErrorStatus}
                loading={usersLoading}
                onNext={() => setUserPage((page) => page + 1)}
                onPrevious={() => setUserPage((page) => Math.max(0, page - 1))}
                onRetry={() => void loadUsers(true)}
                onToggle={updateUserEnabled}
                onDelete={deleteUser}
                page={users}
                query={userQuery}
                setQuery={(query) => {
                  setUserPage(0);
                  setUserQuery(query);
                }}
                busyKey={userActionKey}
              />
            ) : section === "clients" ? (
              <ClientsContent
                errorStatus={clientsErrorStatus}
                loading={clientsLoading}
                onNext={() => setClientPage((page) => page + 1)}
                onPrevious={() => setClientPage((page) => Math.max(0, page - 1))}
                onRetry={() => void loadClients(true)}
                page={clients}
                query={clientQuery}
                setQuery={(query) => {
                  setClientPage(0);
                  setClientQuery(query);
                }}
              />
            ) : section === "scopes" ? (
              <ClientScopesContent
                errorStatus={scopesErrorStatus}
                loading={scopesLoading}
                onNext={() => setScopePage((page) => page + 1)}
                onPrevious={() => setScopePage((page) => Math.max(0, page - 1))}
                onRetry={() => void loadScopes(true)}
                page={scopes}
                query={scopeQuery}
                setQuery={(query) => {
                  setScopePage(0);
                  setScopeQuery(query);
                }}
              />
            ) : null}
          </ScrollView>
        </View>
        <AdminTabBar active={section} onChange={setSection} />
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  const { palette } = useTheme();
  const { dictionary } = useLocale();
  return (
    <SafeAreaView style={[styles.loading, { backgroundColor: palette.background }]}>
      <ActivityIndicator
        accessibilityLabel={dictionary.loading}
        color={palette.primary}
      />
    </SafeAreaView>
  );
}

function DashboardContent({
  dashboard,
  errorStatus,
  loading,
  onRetry,
}: {
  dashboard: AdminDashboard | null;
  errorStatus: number | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  if (loading && !dashboard) {
    return <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} />;
  }
  if (errorStatus !== null && !dashboard) {
    return (
      <View style={[styles.errorCard, { borderColor: palette.danger }]}>
        <Text style={{ color: palette.danger }}>
          {errorStatus === 403 ? dictionary.adminForbidden : dictionary.adminLoadError}
        </Text>
        <ActionButton
          label={dictionary.adminRetry}
          busy={loading}
          onPress={onRetry}
          palette={palette}
          secondary
        />
      </View>
    );
  }
  if (!dashboard) return null;
  const cards = [
    [dictionary.adminStatClients, dashboard.clients],
    [dictionary.adminStatUsers, dashboard.users],
    [dictionary.adminStatSessions, dashboard.sessions],
    [dictionary.adminStatConsents, dashboard.consents],
  ] as const;
  return (
    <View style={styles.cards}>
      {cards.map(([label, value]) => (
        <View
          key={label}
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.cardLabel, { color: palette.textMuted }]}>{label}</Text>
          <Text style={[styles.cardValue, { color: palette.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function UsersContent({
  errorStatus,
  loading,
  onNext,
  onPrevious,
  onRetry,
  onToggle,
  onDelete,
  page,
  query,
  setQuery,
  busyKey,
}: {
  errorStatus: number | null;
  loading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  onToggle: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  page: AdminPage<AdminUser> | null;
  query: string;
  setQuery: (query: string) => void;
  busyKey: string | null;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  return (
    <View style={styles.usersContent}>
      <TextInput
        accessibilityLabel={dictionary.adminSearchUsers}
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder={dictionary.adminSearchUsers}
        placeholderTextColor={palette.textMuted}
        style={[styles.search, { borderColor: palette.border, color: palette.text }]}
        value={query}
      />
      {loading && !page ? (
        <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} />
      ) : errorStatus !== null && !page ? (
        <View style={[styles.errorCard, { borderColor: palette.danger }]}>
          <Text style={{ color: palette.danger }}>
            {errorStatus === 403 ? dictionary.adminForbidden : dictionary.adminUsersLoadError}
          </Text>
          <ActionButton
            label={dictionary.adminRetry}
            busy={loading}
            onPress={onRetry}
            palette={palette}
            secondary
          />
        </View>
      ) : page && page.content.length > 0 ? (
        <View style={styles.userList}>
          {page.content.map((user) => (
            <View
              key={user.id}
              style={[styles.userCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={styles.userCardHeader}>
                <Text style={[styles.userName, { color: palette.text }]}>{user.username}</Text>
                <Text style={{ color: user.enabled ? palette.success : palette.danger }}>
                  {user.enabled ? dictionary.adminUserEnabled : dictionary.adminUserDisabled}
                </Text>
              </View>
              <Text style={{ color: palette.textMuted }}>
                {user.email ??
                  ([user.firstName, user.lastName].filter(Boolean).join(" ") || "—")}
              </Text>
              {user.locked ? (
                <Text style={{ color: palette.danger }}>{dictionary.adminUserLocked}</Text>
              ) : null}
              {user.effectiveRoles.length > 0 ? (
                <Text style={[styles.roles, { color: palette.textMuted }]}>
                  {user.effectiveRoles.join(", ")}
                </Text>
              ) : null}
              <View style={styles.userActions}>
                <ActionButton
                  label={user.enabled ? dictionary.adminUserDisable : dictionary.adminUserEnable}
                  busy={busyKey === `enabled:${user.id}`}
                  disabled={busyKey !== null && busyKey !== `enabled:${user.id}`}
                  onPress={() => onToggle(user)}
                  palette={palette}
                  secondary
                />
                <ActionButton
                  label={dictionary.adminUserDelete}
                  busy={busyKey === `delete:${user.id}`}
                  disabled={busyKey !== null && busyKey !== `delete:${user.id}`}
                  onPress={() => onDelete(user)}
                  palette={palette}
                  secondary
                />
              </View>
            </View>
          ))}
          <View style={styles.pagination}>
            <ActionButton
              label={dictionary.adminPrevious}
              busy={loading}
              disabled={page.number === 0}
              onPress={onPrevious}
              palette={palette}
              secondary
            />
            <Text style={{ color: palette.textMuted }}>
              {dictionary.adminPage} {page.number + 1} / {Math.max(page.totalPages, 1)}
            </Text>
            <ActionButton
              label={dictionary.adminNext}
              busy={loading}
              disabled={page.number + 1 >= page.totalPages}
              onPress={onNext}
              palette={palette}
              secondary
            />
          </View>
        </View>
      ) : (
        <Text style={{ color: palette.textMuted }}>{dictionary.adminNoUsers}</Text>
      )}
    </View>
  );
}

function ClientsContent({
  errorStatus,
  loading,
  onNext,
  onPrevious,
  onRetry,
  page,
  query,
  setQuery,
}: {
  errorStatus: number | null;
  loading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  page: AdminPage<AdminClient> | null;
  query: string;
  setQuery: (query: string) => void;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  return (
    <View style={styles.usersContent}>
      <TextInput
        accessibilityLabel={dictionary.adminSearchClients}
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder={dictionary.adminSearchClients}
        placeholderTextColor={palette.textMuted}
        style={[styles.search, { borderColor: palette.border, color: palette.text }]}
        value={query}
      />
      {loading && !page ? (
        <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} />
      ) : errorStatus !== null && !page ? (
        <View style={[styles.errorCard, { borderColor: palette.danger }]}>
          <Text style={{ color: palette.danger }}>
            {errorStatus === 403 ? dictionary.adminForbidden : dictionary.adminClientsLoadError}
          </Text>
          <ActionButton
            label={dictionary.adminRetry}
            busy={loading}
            onPress={onRetry}
            palette={palette}
            secondary
          />
        </View>
      ) : page && page.content.length > 0 ? (
        <View style={styles.userList}>
          {page.content.map((client) => (
            <View
              key={client.id}
              style={[styles.userCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={styles.userCardHeader}>
                <Text style={[styles.userName, { color: palette.text }]}>{client.clientName}</Text>
                <Text style={{ color: client.enabled ? palette.success : palette.danger }}>
                  {client.enabled ? dictionary.adminUserEnabled : dictionary.adminUserDisabled}
                </Text>
              </View>
              <Text style={{ color: palette.textMuted }}>{client.clientId}</Text>
              <Text style={[styles.roles, { color: palette.textMuted }]}>
                {client.scopes.join(", ") || "—"}
              </Text>
            </View>
          ))}
          <View style={styles.pagination}>
            <ActionButton
              label={dictionary.adminPrevious}
              busy={loading}
              disabled={page.number === 0}
              onPress={onPrevious}
              palette={palette}
              secondary
            />
            <Text style={{ color: palette.textMuted }}>
              {dictionary.adminPage} {page.number + 1} / {Math.max(page.totalPages, 1)}
            </Text>
            <ActionButton
              label={dictionary.adminNext}
              busy={loading}
              disabled={page.number + 1 >= page.totalPages}
              onPress={onNext}
              palette={palette}
              secondary
            />
          </View>
        </View>
      ) : (
        <Text style={{ color: palette.textMuted }}>{dictionary.adminNoClients}</Text>
      )}
    </View>
  );
}

function ClientScopesContent({
  errorStatus,
  loading,
  onNext,
  onPrevious,
  onRetry,
  page,
  query,
  setQuery,
}: {
  errorStatus: number | null;
  loading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  page: AdminPage<AdminClientScope> | null;
  query: string;
  setQuery: (query: string) => void;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  return (
    <View style={styles.usersContent}>
      <TextInput
        accessibilityLabel={dictionary.adminSearchClientScopes}
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder={dictionary.adminSearchClientScopes}
        placeholderTextColor={palette.textMuted}
        style={[styles.search, { borderColor: palette.border, color: palette.text }]}
        value={query}
      />
      {loading && !page ? (
        <ActivityIndicator accessibilityLabel={dictionary.loading} color={palette.primary} />
      ) : errorStatus !== null && !page ? (
        <View style={[styles.errorCard, { borderColor: palette.danger }]}>
          <Text style={{ color: palette.danger }}>
            {errorStatus === 403
              ? dictionary.adminForbidden
              : dictionary.adminClientScopesLoadError}
          </Text>
          <ActionButton
            label={dictionary.adminRetry}
            busy={loading}
            onPress={onRetry}
            palette={palette}
            secondary
          />
        </View>
      ) : page && page.content.length > 0 ? (
        <View style={styles.userList}>
          {page.content.map((scope) => (
            <View
              key={scope.id}
              style={[styles.userCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={styles.userCardHeader}>
                <Text style={[styles.userName, { color: palette.text }]}>{scope.name}</Text>
                <Text style={{ color: scope.builtIn ? palette.textMuted : palette.primary }}>
                  {scope.builtIn ? dictionary.adminBuiltIn : dictionary.adminCustom}
                </Text>
              </View>
              {scope.displayName ? (
                <Text style={{ color: palette.textMuted }}>{scope.displayName}</Text>
              ) : null}
              {scope.description ? (
                <Text style={{ color: palette.textMuted }}>{scope.description}</Text>
              ) : null}
              <Text style={[styles.roles, { color: palette.textMuted }]}>
                {scope.includeInTokenScope ? "token_scope" : "—"}
                {scope.displayOnConsentScreen ? " · consent" : ""}
              </Text>
            </View>
          ))}
          <View style={styles.pagination}>
            <ActionButton
              label={dictionary.adminPrevious}
              busy={loading}
              disabled={page.number === 0}
              onPress={onPrevious}
              palette={palette}
              secondary
            />
            <Text style={{ color: palette.textMuted }}>
              {dictionary.adminPage} {page.number + 1} / {Math.max(page.totalPages, 1)}
            </Text>
            <ActionButton
              label={dictionary.adminNext}
              busy={loading}
              disabled={page.number + 1 >= page.totalPages}
              onPress={onNext}
              palette={palette}
              secondary
            />
          </View>
        </View>
      ) : (
        <Text style={{ color: palette.textMuted }}>{dictionary.adminNoClientScopes}</Text>
      )}
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
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: secondary ? palette.surfaceMuted : palette.primary,
          borderColor: secondary ? palette.border : palette.primary,
          opacity: pressed || busy || disabled ? 0.7 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? palette.primary : palette.onPrimary} /> : null}
      <Text style={{ color: secondary ? palette.text : palette.onPrimary, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function AdminTabBar({
  active,
  onChange,
}: {
  active: AdminSection;
  onChange: (section: AdminSection) => void;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const tabs: readonly [
    AdminSection,
    string,
    "home" | "shield" | "layers" | "gear",
  ][] = [
    ["dashboard", dictionary.adminDashboard, "home"],
    ["users", dictionary.adminUsers, "shield"],
    ["clients", dictionary.adminClients, "shield"],
    ["scopes", dictionary.adminClientScopes, "layers"],
    ["settings", dictionary.adminSettings, "gear"],
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.tabBar, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      {tabs.map(([section, label, icon]) => {
        const selected = section === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            key={section}
            onPress={() => onChange(section)}
            style={[styles.tab, { backgroundColor: selected ? palette.surfaceMuted : "transparent" }]}
          >
            <AppIcon color={selected ? palette.primary : palette.textMuted} name={icon} size={17} />
            <Text style={{ color: selected ? palette.primary : palette.textMuted, fontSize: 11 }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
  screen: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brandRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  smallLogo: { alignItems: "center", borderRadius: radii.sm, height: 34, justifyContent: "center", width: 34 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  content: { gap: spacing.sm, padding: spacing.lg },
  usersContent: { gap: spacing.md, marginTop: spacing.lg },
  search: { borderRadius: radii.md, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: spacing.md },
  userList: { gap: spacing.md },
  userCard: { borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  userCardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  userName: { fontSize: 16, fontWeight: "700" },
  roles: { fontSize: 12, marginTop: spacing.xs },
  pagination: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  userActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  authContent: { alignItems: "center", flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { alignItems: "center", borderRadius: radii.lg, height: 92, justifyContent: "center", width: 92 },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: spacing.sm, textAlign: "center" },
  error: { marginTop: spacing.md, textAlign: "center" },
  errorCard: { borderRadius: radii.md, borderWidth: 1, gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg },
  action: { alignItems: "center", borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.lg, minHeight: 50, paddingHorizontal: spacing.lg },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  card: { borderRadius: radii.md, borderWidth: 1, flexBasis: "47%", flexGrow: 1, minHeight: 112, padding: spacing.md },
  cardLabel: { fontSize: 13, lineHeight: 18 },
  cardValue: { fontSize: 30, fontWeight: "800", marginTop: spacing.sm },
  tabBar: { borderTopWidth: 1, flexDirection: "row", padding: spacing.xs },
  tab: { alignItems: "center", borderRadius: radii.sm, flex: 1, gap: spacing.xs, justifyContent: "center", minHeight: 58 },
});
