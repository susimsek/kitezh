import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { resetPassword } from "@/api/public-api";
import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function ResetPasswordScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(
    typeof params.token === "string" ? params.token : "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const submit = async () => {
    if (pending) return;
    if (!token.trim() || password.length < 12 || password !== confirmPassword) {
      setError(true);
      return;
    }
    setPending(true);
    setError(false);
    try {
      await resetPassword({
        token: token.trim(),
        newPassword: password,
        otpCode: otpCode.trim() || undefined,
      });
      setSuccess(true);
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
          {dictionary.resetTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.resetTokenHelp}
        </Text>
        {success ? (
          <View style={[styles.message, { borderColor: palette.primary }]}>
            <Text style={{ color: palette.primary }}>
              {dictionary.resetSuccess}
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
            <Field
              label={dictionary.resetToken}
              value={token}
              onChangeText={(value) => {
                setToken(value);
                setError(false);
              }}
              palette={palette}
            />
            <Field
              label={dictionary.newPassword}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(false);
              }}
              palette={palette}
              secureTextEntry
            />
            <Field
              label={dictionary.confirmPassword}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setError(false);
              }}
              palette={palette}
              secureTextEntry
            />
            <Field
              label={dictionary.mfaCode}
              value={otpCode}
              onChangeText={setOtpCode}
              palette={palette}
              keyboardType="number-pad"
            />
            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {dictionary.resetError}
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
                {dictionary.save}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  palette,
  secureTextEntry = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  secureTextEntry?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          { borderColor: palette.border, color: palette.text },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  back: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
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
  form: { gap: spacing.sm, marginTop: spacing.xl },
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
    marginTop: spacing.md,
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
