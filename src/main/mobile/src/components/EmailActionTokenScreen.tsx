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

import { confirmEmail, verifyEmail } from "@/api/public-api";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type EmailAction = "verify" | "confirm";

export function EmailActionTokenScreen({
  action,
}: Readonly<{ action: EmailAction }>) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [result, setResult] = useState<{
    token: string | undefined;
    status: "completed" | "failed";
  } | null>(null);
  const actionToken = typeof token === "string" ? token.trim() : "";
  const status = result && result.token === token ? result.status : "pending";

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!actionToken) throw new Error("Missing email action token");
        return action === "confirm"
          ? confirmEmail(actionToken)
          : verifyEmail(actionToken);
      })
      .then(() => {
        if (active) setResult({ token, status: "completed" });
      })
      .catch(() => {
        if (active) setResult({ token, status: "failed" });
      });
    return () => {
      active = false;
    };
  }, [action, actionToken, token]);

  const title =
    action === "confirm"
      ? dictionary.confirmEmailTitle
      : dictionary.verifyEmailTitle;
  const help =
    action === "confirm"
      ? dictionary.confirmEmailHelp
      : dictionary.verifyEmailHelp;
  const success =
    action === "confirm"
      ? dictionary.confirmEmailSuccess
      : dictionary.verifyEmailSuccess;
  const error =
    action === "confirm"
      ? dictionary.confirmEmailError
      : dictionary.verifyEmailError;

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
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>{help}</Text>
        {status === "pending" ? (
          <ActivityIndicator
            accessibilityLabel={dictionary.loading}
            color={palette.primary}
            style={styles.status}
          />
        ) : status === "completed" ? (
          <View style={[styles.message, { borderColor: palette.success }]}>
            <Text style={{ color: palette.success }}>{success}</Text>
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
        ) : status === "failed" ? (
          <View style={[styles.message, { borderColor: palette.danger }]}>
            <Text style={{ color: palette.danger }}>{error}</Text>
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  back: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
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
