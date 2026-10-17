import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PublicApiError, verifyEmail } from "@/api/public-api";
import { publicErrorMessage } from "@/api/public-error-message";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
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
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    if (pending || completed) return;
    setAttempted(true);
    if (typeof token !== "string" || !token.trim()) {
      setFailure(dictionary.verifyEmailError);
      return;
    }
    setPending(true);
    try {
      await verifyEmail(token.trim());
      setCompleted(true);
    } catch (cause) {
      setFailure(
        publicErrorMessage(
          cause instanceof PublicApiError ? cause.kind : undefined,
          dictionary,
          "verifyEmailError",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  let verificationContent: ReactNode = null;
  if ((pending && !failure) || !attempted) {
    verificationContent = (
      <ActivityIndicator
        accessibilityLabel={dictionary.loading}
        color={palette.primary}
        style={styles.status}
      />
    );
  } else if (completed) {
    verificationContent = (
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
    );
  } else if (failure) {
    verificationContent = (
      <View style={[styles.message, { borderColor: palette.danger }]}>
        <Text style={{ color: palette.danger }}>
          {failure}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: pending, disabled: pending }}
          disabled={pending}
          onPress={() => void submit()}
          style={styles.action}
        >
          {pending ? (
            <ActivityIndicator
              accessibilityLabel={dictionary.loading}
              color={palette.primary}
            />
          ) : null}
          <Text style={{ color: palette.primary, fontWeight: "700" }}>
            {dictionary.sessionsRetry}
          </Text>
        </Pressable>
      </View>
    );
  }

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
        <BrandMark size={72} style={{ marginTop: spacing.xl }} />
        <Text style={[styles.title, { color: palette.text }]}>
          {dictionary.verifyEmailTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.verifyEmailHelp}
        </Text>
        {verificationContent}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    alignSelf: "center",
    maxWidth: 560,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    width: "100%",
  },
  back: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    minWidth: 44,
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
  action: { minHeight: 44, minWidth: 44, justifyContent: "center" },
});
