import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useMobileAuth } from "@/auth/MobileAuthProvider";
import {
  AdminApiError,
  addAdminGroupUser,
  listAdminAvailableGroupUsers,
  listAdminGroupUsers,
  removeAdminGroupUser,
  type AdminGroupUser,
  type AdminPage,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

const PAGE_SIZE = 10;

export function GroupMemberships({
  groupId,
  groupName,
  onClose,
}: Readonly<{
  groupId: number;
  groupName: string;
  onClose: () => void;
}>) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, refreshSession } = useMobileAuth();
  const { showNotice } = useMobileNotice();
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [members, setMembers] = useState<AdminPage<AdminGroupUser> | null>(
    null,
  );
  const [available, setAvailable] = useState<AdminPage<AdminGroupUser> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<
    "forbidden" | "offline" | "timeout" | "other" | null
  >(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setErrorKind(null);
    try {
      const current = await refreshSession();
      if (!current) return;
      const options = {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      };
      const [assignedPage, availablePage] = await Promise.all([
        listAdminGroupUsers(
          current.accessToken,
          groupId,
          query,
          pageNumber,
          PAGE_SIZE,
          options,
        ),
        listAdminAvailableGroupUsers(
          current.accessToken,
          groupId,
          query,
          pageNumber,
          PAGE_SIZE,
          options,
        ),
      ]);
      setMembers(assignedPage);
      setAvailable(availablePage);
    } catch (cause) {
      setErrorKind(
        cause instanceof AdminApiError
          ? cause.status === 403
            ? "forbidden"
            : cause.kind === "offline" || cause.kind === "timeout"
              ? cause.kind
              : "other"
          : "other",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, pageNumber, query, refreshSession, session]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const updateMembership = async (user: AdminGroupUser, assign: boolean) => {
    if (!session || actionUserId !== null) return;
    setActionUserId(user.id);
    try {
      const current = await refreshSession();
      if (!current) throw new Error("No active session");
      const options = {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      };
      if (assign) {
        await addAdminGroupUser(current.accessToken, groupId, user.id, options);
      } else {
        await removeAdminGroupUser(
          current.accessToken,
          groupId,
          user.id,
          options,
        );
      }
      showNotice({
        kind: "success",
        message: assign
          ? dictionary.adminGroupUserAdded
          : dictionary.adminGroupUserRemoved,
      });
      await load();
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError && cause.status === 403
            ? dictionary.adminForbidden
            : cause instanceof AdminApiError && cause.kind === "offline"
              ? dictionary.adminApiOfflineError
              : cause instanceof AdminApiError && cause.kind === "timeout"
                ? dictionary.adminApiTimeoutError
                : dictionary.adminActionError,
      });
    } finally {
      setActionUserId(null);
    }
  };

  const confirmRemove = (user: AdminGroupUser) => {
    Alert.alert(
      dictionary.adminRemoveGroupUser,
      dictionary.adminRemoveGroupUserPrompt,
      [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.adminRemoveGroupUser,
          style: "destructive",
          onPress: () => void updateMembership(user, false),
        },
      ],
    );
  };

  const actionButton = (user: AdminGroupUser, assign: boolean) => {
    const busy = actionUserId === user.id;
    const label = assign
      ? dictionary.adminAddGroupUser
      : dictionary.adminRemoveGroupUser;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: actionUserId !== null }}
        disabled={actionUserId !== null}
        key={`${assign ? "add" : "remove"}:${user.id}`}
        onPress={() =>
          assign ? void updateMembership(user, true) : confirmRemove(user)
        }
        style={{
          alignItems: "center",
          backgroundColor: palette.surfaceMuted,
          borderColor: palette.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          justifyContent: "center",
          minHeight: 48,
          opacity: actionUserId !== null && !busy ? 0.6 : 1,
          paddingHorizontal: spacing.md,
        }}
      >
        {busy ? (
          <ActivityIndicator
            accessibilityLabel={dictionary.loading}
            color={palette.primary}
          />
        ) : null}
        <Text style={{ color: palette.text, fontWeight: "600" }}>{label}</Text>
      </Pressable>
    );
  };

  const list = (
    title: string,
    page: AdminPage<AdminGroupUser> | null,
    assign: boolean,
  ) => (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
        {title}
      </Text>
      {page?.content.length ? (
        page.content.map((user) => (
          <View
            key={user.id}
            style={{
              alignItems: "center",
              borderBottomColor: palette.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
              justifyContent: "space-between",
              paddingVertical: spacing.sm,
            }}
          >
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: palette.text, fontWeight: "600" }}>
                {user.username}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                {user.enabled
                  ? dictionary.adminEnabled
                  : dictionary.adminDisabled}
              </Text>
            </View>
            {actionButton(user, assign)}
          </View>
        ))
      ) : (
        <Text style={{ color: palette.textMuted }}>
          {assign
            ? dictionary.adminNoAvailableUsers
            : dictionary.adminNoGroupMembers}
        </Text>
      )}
    </View>
  );

  const errorMessage =
    errorKind === "forbidden"
      ? dictionary.adminForbidden
      : errorKind === "offline"
        ? dictionary.adminApiOfflineError
        : errorKind === "timeout"
          ? dictionary.adminApiTimeoutError
          : dictionary.adminLoadError;

  return (
    <View
      style={{
        alignSelf: "center",
        gap: spacing.md,
        maxWidth: 720,
        width: "100%",
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={{
          alignSelf: "flex-start",
          justifyContent: "center",
          minHeight: 44,
        }}
      >
        <Text style={{ color: palette.primary, fontWeight: "600" }}>
          ‹ {dictionary.back}
        </Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{ color: palette.text, fontSize: 24, fontWeight: "700" }}
      >
        {groupName}
      </Text>
      <TextInput
        accessibilityLabel={dictionary.adminRoleUserSearch}
        onChangeText={(value) => {
          setPageNumber(0);
          setQuery(value);
        }}
        placeholder={dictionary.adminRoleUserSearch}
        placeholderTextColor={palette.textMuted}
        style={{
          borderColor: palette.border,
          borderRadius: radii.md,
          borderWidth: 1,
          color: palette.text,
          fontSize: 16,
          minHeight: 48,
          paddingHorizontal: spacing.md,
        }}
        value={query}
      />
      {loading && !members && !available ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      ) : null}
      {errorKind ? (
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={() => void load()}
            style={{
              alignItems: "center",
              backgroundColor: palette.surfaceMuted,
              borderColor: palette.border,
              borderRadius: radii.md,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing.sm,
              justifyContent: "center",
              minHeight: 48,
              paddingHorizontal: spacing.md,
            }}
          >
            {loading ? (
              <ActivityIndicator
                accessibilityLabel={dictionary.loading}
                color={palette.primary}
              />
            ) : null}
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              {dictionary.adminRetry}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {list(dictionary.adminGroupMembers, members, false)}
      {list(dictionary.adminAvailableUsers, available, true)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pageNumber === 0 || loading }}
          disabled={pageNumber === 0 || loading}
          onPress={() => setPageNumber((page) => Math.max(0, page - 1))}
          style={{
            justifyContent: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text style={{ color: palette.primary }}>
            {dictionary.adminPrevious}
          </Text>
        </Pressable>
        <Text style={{ alignSelf: "center", color: palette.textMuted }}>
          {pageNumber + 1}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled:
              loading ||
              Math.max(members?.totalPages ?? 0, available?.totalPages ?? 0) <=
                pageNumber,
          }}
          disabled={
            loading ||
            Math.max(members?.totalPages ?? 0, available?.totalPages ?? 0) <=
              pageNumber
          }
          onPress={() => setPageNumber((page) => page + 1)}
          style={{
            justifyContent: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text style={{ color: palette.primary }}>{dictionary.adminNext}</Text>
        </Pressable>
      </View>
      {loading && (members || available) ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      ) : null}
    </View>
  );
}
