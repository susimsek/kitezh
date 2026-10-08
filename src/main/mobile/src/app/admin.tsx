import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  getAdminDashboard,
  listAdminUsers,
  type AdminDashboard,
  type AdminPage,
  type AdminUser,
} from "@/api/admin-api";
import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type AdminSection = "dashboard" | "users" | "clients" | "settings";

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

  useEffect(() => {
    if (session) queueMicrotask(() => void loadDashboard());
  }, [loadDashboard, session]);

  useEffect(() => {
    if (session && section === "users") queueMicrotask(() => void loadUsers());
  }, [loadUsers, section, session]);

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
                    : dictionary.adminSettings}
            </Text>
            <Text style={[styles.subtitle, { color: palette.textMuted }]}>
              {section === "dashboard"
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
                page={users}
                query={userQuery}
                setQuery={(query) => {
                  setUserPage(0);
                  setUserQuery(query);
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
  page,
  query,
  setQuery,
}: {
  errorStatus: number | null;
  loading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  page: AdminPage<AdminUser> | null;
  query: string;
  setQuery: (query: string) => void;
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
  const tabs: readonly [AdminSection, string, "home" | "shield" | "gear"][] = [
    ["dashboard", dictionary.adminDashboard, "home"],
    ["users", dictionary.adminUsers, "shield"],
    ["clients", dictionary.adminClients, "shield"],
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
