import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { useMobileAuth } from "@/auth/MobileAuthProvider";

export default function SignInScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { error, signIn, status } = useMobileAuth();
  const pending = status === "signing-in";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityLabel={dictionary.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <AppIcon
            name="arrowRight"
            size={18}
            color={palette.text}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </Pressable>
        <BrandMark size={72} />
        <Text style={[styles.title, { color: palette.text }]}>Kitezh</Text>
        <Text style={[styles.message, { color: palette.textMuted }]}>
          {dictionary.appTagline}
        </Text>
        <Text style={[styles.note, { color: palette.textMuted }]}>
          {dictionary.signInNote}
        </Text>
        {error ? (
          <Text style={[styles.error, { color: palette.danger }]}>
            {dictionary.authError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          testID="sign-in-submit"
          onPress={() => void signIn()}
          style={[
            styles.action,
            { backgroundColor: palette.primary, opacity: pending ? 0.7 : 1 },
          ]}
        >
          {pending ? <ActivityIndicator color={palette.onPrimary} /> : null}
          <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
            {dictionary.signIn}
          </Text>
        </Pressable>
        <View style={styles.browserActions}>
          <Pressable
            accessibilityLabel={dictionary.forgotPassword}
            accessibilityRole="button"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => router.push("/forgot-password")}
            style={styles.browserAction}
          >
            <Text style={{ color: palette.primary, fontWeight: "600" }}>
              {dictionary.forgotPassword}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={dictionary.createAccount}
            accessibilityRole="button"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => router.push("/register")}
            style={styles.browserAction}
          >
            <Text style={{ color: palette.primary, fontWeight: "600" }}>
              {dictionary.createAccount}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  back: {
    alignSelf: "flex-start",
    padding: spacing.sm,
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
  },
  title: { fontSize: 30, fontWeight: "800", marginTop: spacing.md },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xl,
    maxWidth: 320,
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    maxWidth: 320,
    textAlign: "center",
  },
  action: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  browserActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  browserAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
});
