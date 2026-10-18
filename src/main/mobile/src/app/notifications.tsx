import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAccountUnreadNotificationCount,
  listAccountNotifications,
  markAccountNotificationRead,
  type AccountNotification,
  type AccountPage,
} from "@/api/account-api";
import { AppIcon } from "@/components/AppIcon";
import { AccountTabBar } from "@/components/AccountTabBar";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

const NOTIFICATION_MESSAGE_KEYS = [
  "notificationAccountPasswordChanged",
  "notificationAccountMfaEnabled",
  "notificationAccountMfaDisabled",
  "notificationAccountSessionRevoked",
  "notificationAdminUserRegistered",
] as const;

export default function NotificationsScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const { session, status, refreshSession } = useMobileAuth();
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [page, setPage] = useState<AccountPage<AccountNotification> | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageDirection, setPageDirection] = useState<"next" | "previous" | null>(null);
  const [error, setError] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const mutationRef = useRef(false);

  const load = useCallback(
    async (requestedPage = 0, retry = false, direction: "next" | "previous" | null = null) => {
      if (!session || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setPageDirection(direction);
      setError(false);
      try {
        const current = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!current) throw new Error("No active account session");
        const options = {
          page: requestedPage,
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        };
        let nextPage = await listAccountNotifications(
          current.accessToken,
          options,
        );
        if (requestedPage > 0 && requestedPage >= nextPage.totalPages) {
          nextPage = await listAccountNotifications(current.accessToken, {
            ...options,
            page: Math.max(0, nextPage.totalPages - 1),
          });
        }
        const count = await getAccountUnreadNotificationCount(
          current.accessToken,
          options,
        );
        setItems(nextPage.content ?? []);
        setPage(nextPage);
        setUnreadCount(Math.max(0, count));
      } catch {
        setError(true);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setPageDirection(null);
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

  const markRead = useCallback(
    async (item: AccountNotification) => {
      if (!session || item.read || mutationRef.current) return;
      mutationRef.current = true;
      setMarkingId(item.id);
      setError(false);
      try {
        const current = await refreshSession();
        if (!current) throw new Error("No active account session");
        await markAccountNotificationRead(current.accessToken, item.id, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        setItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id ? { ...currentItem, read: true } : currentItem,
          ),
        );
        setUnreadCount((count) => Math.max(0, (count ?? 1) - 1));
      } catch {
        setError(true);
      } finally {
        mutationRef.current = false;
        setMarkingId(null);
      }
    },
    [refreshSession, session],
  );

  const messageFor = (messageKey: string) => {
    if (!(NOTIFICATION_MESSAGE_KEYS as readonly string[]).includes(messageKey)) {
      return dictionary.notificationsUnknown;
    }
    return dictionary[messageKey as (typeof NOTIFICATION_MESSAGE_KEYS)[number]];
  };

  if (status === "loading") {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.primary} accessibilityLabel={dictionary.loading} />
      </SafeAreaView>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView
      testID="notifications-screen"
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.screen}>
        <MobileFormScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel={dictionary.back}
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.back}
            >
              <AppIcon name="arrowLeft" size={18} color={palette.primary} />
              <Text style={{ color: palette.primary }}>{dictionary.back}</Text>
            </Pressable>
            <Text style={[styles.title, { color: palette.text }]}>
              {dictionary.notificationsTitle}
            </Text>
            <Text style={[styles.description, { color: palette.textMuted }]}>
              {dictionary.notificationsDescription}
            </Text>
            {unreadCount !== null ? (
              <Text style={[styles.count, { color: palette.textMuted }]}>
                {dictionary.notificationsUnreadCount}: {unreadCount}
              </Text>
            ) : null}
          </View>

          {loading && items.length === 0 ? (
            <ActivityIndicator
              color={palette.primary}
              accessibilityLabel={dictionary.loading}
            />
          ) : error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              disabled={loading}
              onPress={() => void load(page?.number ?? 0, true)}
              style={[styles.error, { borderColor: palette.danger }]}
            >
              {loading ? <ActivityIndicator color={palette.primary} /> : null}
              <Text style={{ color: palette.danger }}>{dictionary.notificationsError}</Text>
              <Text style={{ color: palette.primary }}>{dictionary.sessionsRetry}</Text>
            </Pressable>
          ) : items.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              {dictionary.notificationsEmpty}
            </Text>
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const busy = markingId === item.id;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.cardHeading}>
                      <AppIcon
                        name="bell"
                        size={16}
                        color={item.read ? palette.textMuted : palette.primary}
                      />
                      <Text style={[styles.status, { color: item.read ? palette.textMuted : palette.primary }]}>
                        {item.read ? dictionary.notificationRead : dictionary.notificationUnread}
                      </Text>
                    </View>
                    <Text style={[styles.message, { color: palette.text }]}>
                      {messageFor(item.messageKey)}
                    </Text>
                    <Text style={[styles.date, { color: palette.textMuted }]}>
                      {new Date(item.createdAt).toLocaleString(resolvedLocale)}
                    </Text>
                    {!item.read ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ busy, disabled: busy || markingId !== null }}
                        disabled={busy || markingId !== null}
                        onPress={() => void markRead(item)}
                        style={[
                          styles.markRead,
                          {
                            backgroundColor: palette.surfaceMuted,
                            opacity: busy || markingId !== null ? 0.6 : 1,
                          },
                        ]}
                      >
                        {busy ? <ActivityIndicator color={palette.primary} /> : null}
                        <Text style={{ color: palette.primary, fontWeight: "700" }}>
                          {dictionary.notificationMarkRead}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {page && page.totalPages > 1 ? (
            <View style={styles.pagination}>
              <PageButton
                disabled={loading || page.number <= 0}
                busy={loading && pageDirection === "previous"}
                label={dictionary.previousPage}
                onPress={() => void load(Math.max(0, page.number - 1), false, "previous")}
              />
              <Text style={{ color: palette.textMuted }}>
                {page.number + 1} / {page.totalPages}
              </Text>
              <PageButton
                disabled={loading || page.number + 1 >= page.totalPages}
                busy={loading && pageDirection === "next"}
                label={dictionary.nextPage}
                onPress={() => void load(page.number + 1, false, "next")}
              />
            </View>
          ) : null}
        </MobileFormScrollView>
        <AccountTabBar active="account" />
      </View>
    </SafeAreaView>
  );
}

function PageButton({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pageButton, { borderColor: palette.border, opacity: disabled ? 0.55 : 1 }]}
    >
      {busy ? <ActivityIndicator color={palette.primary} /> : null}
      <Text style={{ color: palette.primary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    gap: spacing.lg,
    maxWidth: 640,
    padding: spacing.lg,
    width: "100%",
  },
  header: { gap: spacing.sm },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 48 },
  title: { fontSize: 28, fontWeight: "800" },
  description: { fontSize: 15, lineHeight: 22 },
  count: { fontSize: 13 },
  list: { gap: spacing.md },
  card: { borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  cardHeading: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  status: { fontSize: 13, fontWeight: "700" },
  message: { fontSize: 16, lineHeight: 23 },
  date: { fontSize: 13 },
  markRead: { alignItems: "center", alignSelf: "flex-start", borderRadius: radii.sm, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md },
  empty: { paddingVertical: spacing.xl, textAlign: "center" },
  error: { alignItems: "center", borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  pagination: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  pageButton: { alignItems: "center", borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 48, minWidth: 96, paddingHorizontal: spacing.md },
});
