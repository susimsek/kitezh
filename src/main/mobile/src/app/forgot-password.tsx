import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PublicApiError, requestPasswordReset } from "@/api/public-api";
import { publicErrorMessage } from "@/api/public-error-message";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identifierRef = useRef<TextInput>(null);

  const submit = async () => {
    if (pending || !identifier.trim()) {
      if (!identifier.trim()) {
        setError(dictionary.forgotError);
        identifierRef.current?.focus();
      }
      return;
    }
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(identifier.trim(), resolvedLocale);
      setSent(true);
    } catch (cause) {
      setError(
        publicErrorMessage(
          cause instanceof PublicApiError ? cause.kind : undefined,
          dictionary,
          "forgotError",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <MobileFormScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dictionary.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <AppIcon name="arrowLeft" size={18} color={palette.primary} />
          <Text style={{ color: palette.primary }}>{dictionary.back}</Text>
        </Pressable>
        <BrandMark size={72} />
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
              accessibilityHint={error ?? undefined}
              autoCapitalize="none"
              autoComplete="username"
              onChangeText={(value) => {
                setIdentifier(value);
                setError(null);
              }}
              placeholder={dictionary.username}
              placeholderTextColor={palette.textMuted}
              ref={identifierRef}
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
              <Text
                accessibilityRole="alert"
                style={[styles.error, { color: palette.danger }]}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: pending, disabled: pending }}
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
              {pending ? (
                <ActivityIndicator
                  accessibilityLabel={dictionary.loading}
                  color={palette.onPrimary}
                />
              ) : null}
              <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
                {dictionary.continue}
              </Text>
            </Pressable>
          </View>
        )}
      </MobileFormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: 560,
    padding: spacing.xl,
    width: "100%",
  },
  back: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xl,
    minHeight: 44,
    minWidth: 44,
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
