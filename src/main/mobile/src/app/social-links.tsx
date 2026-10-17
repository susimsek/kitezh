import * as WebBrowser from "expo-web-browser";
import { AuthRequest as ExpoAuthRequest } from "expo-auth-session";
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
import { useMobileNotice } from "@/components/MobileNoticeProvider";
import {
  authorizationServerIssuer,
  mobileClientId,
} from "@/config";
import {
  completeNativeSocialLink,
  listSocialLinks,
  startNativeSocialLink,
  unlinkSocialProvider,
  type SocialLink,
} from "@/api/account-api";
import {
  consumeOAuthTransaction,
  saveOAuthTransaction,
  clearOAuthTransaction,
} from "@/auth/storage";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import {
  isTrustedSocialLinkAuthorizationUrl,
  NATIVE_SOCIAL_LINK_REDIRECT_URI,
  parseNativeSocialLinkCallback,
} from "@/auth/native-social-link";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function SocialLinksScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { refreshSession, session, status } = useMobileAuth();
  const { showNotice } = useMobileNotice();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const load = useCallback(
    async (retry = false) => {
      if (!session) return;
      setLoading(true);
      setError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) throw new Error();
        setLinks(
          await listSocialLinks(currentSession.accessToken, {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          }),
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
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

  const remove = useCallback(
    async (link: SocialLink) => {
      if (!session || actionInFlight.current) return;
      actionInFlight.current = true;
      setBusyProvider(link.provider);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error();
        await unlinkSocialProvider(currentSession.accessToken, link.provider, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        });
        setLinks((current) =>
          current.map((item) =>
            item.provider === link.provider ? { ...item, linked: false } : item,
          ),
        );
        showNotice({
          kind: "success",
          message: dictionary.socialRemoveSuccess,
        });
      } catch {
        showNotice({ kind: "error", message: dictionary.socialRemoveError });
      } finally {
        actionInFlight.current = false;
        setBusyProvider(null);
      }
    },
    [
      dictionary.socialRemoveError,
      dictionary.socialRemoveSuccess,
      refreshSession,
      session,
      showNotice,
    ],
  );

  const openLinkFlow = useCallback(
    async (provider: string) => {
      if (!session || actionInFlight.current) return;
      actionInFlight.current = true;
      setBusyProvider(provider);
      try {
        const currentSession = await refreshSession();
        if (!currentSession) throw new Error("session_unavailable");
        const request = new ExpoAuthRequest({
          clientId: mobileClientId,
          redirectUri: NATIVE_SOCIAL_LINK_REDIRECT_URI,
          responseType: "code",
          usePKCE: true,
        });
        const requestConfig = await request.getAuthRequestConfigAsync();
        if (
          !requestConfig.state ||
          !requestConfig.codeChallenge ||
          !request.codeVerifier
        ) {
          throw new Error("social_link_request_invalid");
        }
        await clearOAuthTransaction("account");
        await saveOAuthTransaction("account", {
          clientId: mobileClientId,
          codeVerifier: request.codeVerifier,
          createdAt: Date.now(),
          redirectUri: NATIVE_SOCIAL_LINK_REDIRECT_URI,
          state: requestConfig.state,
        });
        const refreshAccessToken = async () =>
          (await refreshSession(true))?.accessToken ?? null;
        const start = await startNativeSocialLink(
          currentSession.accessToken,
          provider,
          {
            state: requestConfig.state,
            codeChallenge: requestConfig.codeChallenge,
          },
          { refreshAccessToken },
        );
        if (
          start.state !== requestConfig.state ||
          !isTrustedSocialLinkAuthorizationUrl(
            start.authorizationUrl,
            authorizationServerIssuer,
          )
        ) {
          throw new Error("social_link_start_invalid");
        }
        const browserResult = await WebBrowser.openAuthSessionAsync(
          start.authorizationUrl,
          NATIVE_SOCIAL_LINK_REDIRECT_URI,
        );
        if (browserResult.type !== "success") {
          await clearOAuthTransaction("account");
          return;
        }
        const callback = parseNativeSocialLinkCallback(
          browserResult.url,
          requestConfig.state,
        );
        const transaction = await consumeOAuthTransaction("account", {
          clientId: mobileClientId,
          redirectUri: NATIVE_SOCIAL_LINK_REDIRECT_URI,
        });
        if (
          !callback ||
          !transaction ||
          transaction.state !== callback.state ||
          callback.error ||
          !callback.code
        ) {
          throw new Error("social_link_callback_invalid");
        }
        const completion = await completeNativeSocialLink(
          currentSession.accessToken,
          { code: callback.code, codeVerifier: transaction.codeVerifier },
          { refreshAccessToken },
        );
        if (completion.provider !== provider || !completion.linked) {
          throw new Error("social_link_completion_invalid");
        }
        await load(true);
        showNotice({ kind: "success", message: dictionary.socialLinkSuccess });
      } catch {
        await clearOAuthTransaction("account");
        showNotice({ kind: "error", message: dictionary.socialLinkError });
      } finally {
        actionInFlight.current = false;
        setBusyProvider(null);
      }
    },
    [dictionary.socialLinkError, dictionary.socialLinkSuccess, load, refreshSession, session, showNotice],
  );

  const confirmRemove = (link: SocialLink) => {
    Alert.alert(dictionary.socialRemove, dictionary.socialRemoveConfirm, [
      { text: dictionary.cancel, style: "cancel" },
      {
        text: dictionary.socialRemove,
        style: "destructive",
        onPress: () => void remove(link),
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
      <ScrollView contentContainerStyle={styles.content}>
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
          {dictionary.socialLinksTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.socialLinksHelp}
        </Text>
        {loading ? (
          <ActivityIndicator
            color={palette.primary}
            accessibilityLabel={dictionary.loading}
          />
        ) : error ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(true)}
            style={[styles.error, { borderColor: palette.danger }]}
          >
            <Text style={{ color: palette.danger }}>
              {dictionary.socialLinksError}
            </Text>
            <Text style={{ color: palette.primary }}>
              {dictionary.sessionsRetry}
            </Text>
          </Pressable>
        ) : links.length === 0 ? (
          <Text style={[styles.help, { color: palette.textMuted }]}>
            {dictionary.socialLinksEmpty}
          </Text>
        ) : (
          links.map((link) => {
            const disabled =
              Boolean(busyProvider) ||
              (!link.linked && (!link.enabled || !link.configured));
            return (
              <View
                key={link.provider}
                style={[styles.card, { borderColor: palette.border }]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.icon, { backgroundColor: palette.primary }]}
                  >
                    <AppIcon name="globe" size={20} color={palette.onPrimary} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>
                      {link.displayName}
                    </Text>
                    <Text style={[styles.meta, { color: palette.textMuted }]}>
                      {link.linked
                        ? dictionary.socialConnected
                        : !link.configured || !link.enabled
                          ? dictionary.socialNotConfigured
                          : dictionary.socialNotConnected}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() =>
                    link.linked
                      ? confirmRemove(link)
                      : void openLinkFlow(link.provider)
                  }
                  style={[
                    styles.action,
                    {
                      borderColor: link.linked
                        ? palette.danger
                        : palette.primary,
                      opacity: disabled ? 0.55 : 1,
                    },
                  ]}
                >
                  {busyProvider === link.provider ? (
                    <ActivityIndicator
                      color={link.linked ? palette.danger : palette.primary}
                      accessibilityLabel={dictionary.loading}
                    />
                  ) : null}
                  <Text
                    style={{
                      color: link.linked ? palette.danger : palette.primary,
                      fontWeight: "700",
                    }}
                  >
                    {link.linked
                      ? dictionary.socialRemove
                      : dictionary.socialConnect}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.xl },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.md },
  help: { fontSize: 14, lineHeight: 21 },
  error: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  icon: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: spacing.xs },
  action: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
});
