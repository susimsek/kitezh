import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { requestPasswordReset } from "@/api/public-api";
import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const submit = async () => {
    if (pending || !identifier.trim()) {
      if (!identifier.trim()) setError(true);
      return;
    }
    setPending(true);
    setError(false);
    try {
      await requestPasswordReset(identifier.trim(), resolvedLocale);
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dictionary.back}
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
          {dictionary.forgotTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.forgotHelp}
        </Text>
        {sent ? (
          <View style={[styles.message, { borderColor: palette.primary }]}>
            <Text style={{ color: palette.primary }}>
              {dictionary.forgotSent}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/sign-in")}
              style={styles.link}
            >
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                {dictionary.signIn}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: palette.text }]}>
              {dictionary.username}
            </Text>
            <TextInput
              accessibilityLabel={dictionary.username}
              autoCapitalize="none"
              autoComplete="username"
              onChangeText={(value) => {
                setIdentifier(value);
                setError(false);
              }}
              placeholder={dictionary.username}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                {
                  borderColor: error ? palette.danger : palette.border,
                  color: palette.text,
                },
              ]}
              value={identifier}
            />
            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {dictionary.forgotError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => void submit()}
              style={[
                styles.action,
                {
                  backgroundColor: palette.primary,
                  opacity: pending ? 0.65 : 1,
                },
              ]}
            >
              {pending ? <ActivityIndicator color={palette.onPrimary} /> : null}
              <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
                {dictionary.continue}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, padding: spacing.xl },
  back: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  logo: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  help: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  form: { marginTop: spacing.xl },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  input: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  error: { fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  action: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 50,
  },
  message: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  link: { minHeight: 44, justifyContent: "center" },
});
