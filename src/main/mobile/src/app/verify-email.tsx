import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { verifyEmail } from "@/api/public-api";
import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function VerifyEmailScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [pending, setPending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    if (pending || completed) return;
    setAttempted(true);
    if (typeof token !== "string" || !token.trim()) {
      setFailed(true);
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await verifyEmail(token.trim());
      setCompleted(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void submit());
    // The action token is immutable for the lifetime of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel={dictionary.back}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <AppIcon name="arrowLeft" size={18} color={palette.primary} />
          <Text style={{ color: palette.primary }}>{dictionary.back}</Text>
        </Pressable>
        <View style={[styles.logo, { backgroundColor: palette.primary }]}>
          <AppIcon name="shield" size={38} color={palette.onPrimary} />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>
          {dictionary.verifyEmailTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.verifyEmailHelp}
        </Text>
        {pending || !attempted ? (
          <ActivityIndicator
            accessibilityLabel={dictionary.loading}
            color={palette.primary}
            style={styles.status}
          />
        ) : completed ? (
          <View style={[styles.message, { borderColor: palette.success }]}>
            <Text style={{ color: palette.success }}>
              {dictionary.verifyEmailSuccess}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/sign-in")}
              style={styles.action}
            >
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                {dictionary.signIn}
              </Text>
            </Pressable>
          </View>
        ) : failed ? (
          <View style={[styles.message, { borderColor: palette.danger }]}>
            <Text style={{ color: palette.danger }}>
              {dictionary.verifyEmailError}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => void submit()}
              style={styles.action}
            >
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                {dictionary.sessionsRetry}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  logo: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 72,
    justifyContent: "center",
    marginTop: spacing.xl,
    width: 72,
  },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  help: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  status: { marginTop: spacing.xl },
  message: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  action: { minHeight: 44, justifyContent: "center" },
});
