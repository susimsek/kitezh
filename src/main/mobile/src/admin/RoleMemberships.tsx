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
  assignAdminRoleUser,
  getAdminRoleDetail,
  listAdminAvailableRoleUsers,
  removeAdminRoleUser,
  type AdminPage,
  type AdminRoleUser,
} from "@/api/admin-api";
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

const PAGE_SIZE = 10;

export function RoleMemberships({
  roleName,
  onClose,
}: Readonly<{ roleName: string; onClose: () => void }>) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, refreshSession } = useMobileAuth();
  const { showNotice } = useMobileNotice();
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [assigned, setAssigned] = useState<AdminPage<AdminRoleUser> | null>(
    null,
  );
  const [available, setAvailable] = useState<AdminPage<AdminRoleUser> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setErrorStatus(null);
    try {
      const current = await refreshSession();
      if (!current) return;
      const options = {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      };
      const [detail, candidates] = await Promise.all([
        getAdminRoleDetail(
          current.accessToken,
          roleName,
          query,
          undefined,
          pageNumber,
          PAGE_SIZE,
          options,
        ),
        listAdminAvailableRoleUsers(
          current.accessToken,
          roleName,
          query,
          pageNumber,
          PAGE_SIZE,
          options,
        ),
      ]);
      setAssigned(detail.users);
      setAvailable(candidates);
    } catch (cause) {
      setErrorStatus(cause instanceof AdminApiError ? cause.status : 0);
    } finally {
      setLoading(false);
    }
  }, [pageNumber, query, refreshSession, roleName, session]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const updateMembership = async (user: AdminRoleUser, assign: boolean) => {
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
        await assignAdminRoleUser(
          current.accessToken,
          roleName,
          user.id,
          pageNumber,
          PAGE_SIZE,
          options,
        );
      } else {
        await removeAdminRoleUser(
          current.accessToken,
          roleName,
          user.id,
          pageNumber,
          PAGE_SIZE,
          options,
        );
      }
      showNotice({
        kind: "success",
        message: assign
          ? dictionary.adminRoleUserAssigned
          : dictionary.adminRoleUserRemoved,
      });
      await load();
    } catch (cause) {
      showNotice({
        kind: "error",
        message:
          cause instanceof AdminApiError && cause.status === 403
            ? dictionary.adminForbidden
            : dictionary.adminRoleUserActionError,
      });
    } finally {
      setActionUserId(null);
    }
  };

  const confirmRemove = (user: AdminRoleUser) => {
    Alert.alert(
      dictionary.adminRoleRemoveUser,
      dictionary.adminRoleRemoveUserConfirm,
      [
        { text: dictionary.cancel, style: "cancel" },
        {
          text: dictionary.adminRoleRemoveUser,
          style: "destructive",
          onPress: () => void updateMembership(user, false),
        },
      ],
    );
  };

  const actionButton = (user: AdminRoleUser, assign: boolean) => {
    const busy = actionUserId === user.id;
    const label = assign
      ? dictionary.adminRoleAssignUser
      : dictionary.adminRoleRemoveUser;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: actionUserId !== null }}
        disabled={actionUserId !== null}
        key={`${assign ? "assign" : "remove"}:${user.id}`}
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
    users: AdminPage<AdminRoleUser> | null,
    assign: boolean,
  ) => (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
        {title}
      </Text>
      {users?.content.length ? (
        users.content.map((user) => (
          <View
            key={user.id}
            style={{
              alignItems: "center",
              borderBottomColor: palette.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              gap: spacing.sm,
              justifyContent: "space-between",
              paddingVertical: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
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
            ? dictionary.adminRoleNoAvailableUsers
            : dictionary.adminRoleNoUsers}
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={{
          alignSelf: "flex-start",
          minHeight: 44,
          justifyContent: "center",
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
        {roleName}
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
          minHeight: 48,
          paddingHorizontal: spacing.md,
        }}
        value={query}
      />
      {loading && !assigned && !available ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      ) : null}
      {errorStatus !== null ? (
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {errorStatus === 403
            ? dictionary.adminForbidden
            : dictionary.adminRoleUsersLoadError}
        </Text>
      ) : null}
      {list(dictionary.adminRoleAssignedUsers, assigned, false)}
      {list(dictionary.adminRoleAvailableUsers, available, true)}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
              Math.max(assigned?.totalPages ?? 0, available?.totalPages ?? 0) <=
                pageNumber,
          }}
          disabled={
            loading ||
            Math.max(assigned?.totalPages ?? 0, available?.totalPages ?? 0) <=
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
      {loading && (assigned || available) ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      ) : null}
    </View>
  );
}
