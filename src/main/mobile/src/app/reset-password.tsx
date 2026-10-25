import { router, useLocalSearchParams } from "expo-router";
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

import { PublicApiError, resetPassword } from "@/api/public-api";
import { publicErrorMessage } from "@/api/public-error-message";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";
import { problemFieldErrors } from "../../../shared/src/api.ts";

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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const submit = async () => {
    if (pending) return;
    const invalidField = [
      {
        name: "token",
        message: dictionary.resetError,
        valid: Boolean(token.trim()),
      },
      {
        name: "newPassword",
        message: dictionary.passwordMinLength,
        valid: password.length >= 12,
      },
      {
        name: "confirmPassword",
        message: dictionary.passwordMismatch,
        valid: password === confirmPassword && Boolean(confirmPassword),
      },
    ].find((field) => !field.valid);
    if (invalidField) {
      setError(null);
      setFieldErrors({ [invalidField.name]: invalidField.message });
      inputRefs.current[
        ["token", "newPassword", "confirmPassword"].indexOf(
          invalidField.name,
        )
      ]?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword({
        token: token.trim(),
        newPassword: password,
        otpCode: otpCode.trim() || undefined,
      });
      setSuccess(true);
    } catch (cause) {
      setFieldErrors(problemFieldErrors(cause));
      setError(
        publicErrorMessage(
          cause instanceof PublicApiError ? cause.kind : undefined,
          dictionary,
          "resetError",
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
      <MobileFormScrollView
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
        <BrandMark size={72} />
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
              inputRef={(node) => {
                inputRefs.current[0] = node;
              }}
              label={dictionary.resetToken}
              value={token}
              onChangeText={(value) => {
                setToken(value);
                setError(null);
                setFieldErrors((current) => omitFieldError(current, "token"));
              }}
              error={fieldErrors.token}
              palette={palette}
            />
            <Field
              inputRef={(node) => {
                inputRefs.current[1] = node;
              }}
              label={dictionary.newPassword}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
                setFieldErrors((current) =>
                  omitFieldError(current, "newPassword"),
                );
              }}
              error={fieldErrors.newPassword}
              palette={palette}
              secureTextEntry
            />
            <Field
              inputRef={(node) => {
                inputRefs.current[2] = node;
              }}
              label={dictionary.confirmPassword}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setError(null);
                setFieldErrors((current) =>
                  omitFieldError(current, "confirmPassword"),
                );
              }}
              error={fieldErrors.confirmPassword}
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
                {dictionary.save}
              </Text>
            </Pressable>
          </View>
        )}
      </MobileFormScrollView>
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
  error,
  inputRef,
}: Readonly<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  secureTextEntry?: boolean;
  keyboardType?: "default" | "number-pad";
  error?: string;
  inputRef?: (node: TextInput | null) => void;
}>) {
  return (
    <View>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
        ref={inputRef}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            borderColor: error ? palette.danger : palette.border,
            color: palette.text,
          },
        ]}
        value={value}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.fieldError, { color: palette.danger }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function omitFieldError(
  errors: Record<string, string>,
  field: string,
): Record<string, string> {
  const { [field]: _removed, ...remaining } = errors;
  return remaining;
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
    marginBottom: spacing.lg,
    minHeight: 44,
    minWidth: 44,
  },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  help: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  form: { gap: spacing.sm, marginTop: spacing.xl },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  fieldError: { fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
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
