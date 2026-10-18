import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCaptchaSettings,
  PublicApiError,
  registerAccount,
  type CaptchaSettings,
} from "@/api/public-api";
import { publicErrorMessage } from "@/api/public-error-message";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { createNativeCaptchaToken } from "@/auth/native-captcha";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";
import { problemFieldErrors } from "../../../shared/src/api.ts";
import { isValidEmail } from "@/validation/email";

export default function RegisterScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaSettings, setCaptchaSettings] =
    useState<CaptchaSettings | null>(null);
  const [captchaSettingsUnavailable, setCaptchaSettingsUnavailable] =
    useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const nativeCaptchaSiteKey =
    Platform.OS === "ios"
      ? captchaSettings?.iosSiteKey
      : captchaSettings?.androidSiteKey;
  const nativeCaptchaUnavailable =
    captchaSettings?.nativeRequired === true &&
    (captchaSettings.nativeEnabled !== true ||
      captchaSettings.provider !== "enterprise" ||
      !nativeCaptchaSiteKey);

  useEffect(() => {
    void getCaptchaSettings()
      .then((settings) => {
        setCaptchaSettings(settings);
        setCaptchaSettingsUnavailable(false);
      })
      .catch(() => {
        setCaptchaSettings(null);
        setCaptchaSettingsUnavailable(true);
      });
  }, []);

  const submit = async () => {
    if (
      pending ||
      !captchaSettings ||
      captchaSettingsUnavailable ||
      nativeCaptchaUnavailable
    ) {
      return;
    }
    const invalidField = [
      {
        name: "username",
        message: dictionary.registrationError,
        valid: Boolean(username.trim()),
      },
      {
        name: "firstName",
        message: dictionary.registrationError,
        valid: Boolean(firstName.trim()),
      },
      {
        name: "lastName",
        message: dictionary.registrationError,
        valid: Boolean(lastName.trim()),
      },
      {
        name: "email",
        message: dictionary.invalidEmail,
        valid: isValidEmail(email.trim()),
      },
      {
        name: "password",
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
        [
          "username",
          "firstName",
          "lastName",
          "email",
          "password",
          "confirmPassword",
        ].indexOf(invalidField.name)
      ]?.focus();
      return;
    }
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const captchaToken =
        captchaSettings.nativeRequired && nativeCaptchaSiteKey
          ? await createNativeCaptchaToken(
              nativeCaptchaSiteKey,
              captchaSettings.action,
            )
          : null;
      await registerAccount({
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        captchaToken,
        mobilePlatform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        locale: resolvedLocale,
      });
      setSuccess(true);
    } catch (cause) {
      setFieldErrors(problemFieldErrors(cause));
      setError(
        publicErrorMessage(
          cause instanceof PublicApiError ? cause.kind : undefined,
          dictionary,
          "registrationError",
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
          {dictionary.registrationTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.registrationHelp}
        </Text>
        {(() => {
          if (success) {
            return (
              <View style={[styles.message, { borderColor: palette.primary }]}>
                <Text style={{ color: palette.primary }}>
                  {dictionary.registrationSuccess}
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
            );
          } else {
            if (captchaSettings === null && !captchaSettingsUnavailable) {
              return (
                <ActivityIndicator
                  color={palette.primary}
                  accessibilityLabel={dictionary.loading}
                  style={styles.loading}
                />
              );
            } else if (captchaSettings === null) {
              return (
                <View style={[styles.message, { borderColor: palette.danger }]}>
                  <Text style={{ color: palette.danger }}>
                    {dictionary.registrationCaptchaSettingsUnavailable}
                  </Text>
                </View>
              );
            } else {
              if (nativeCaptchaUnavailable) {
                return (
                  <View
                    style={[styles.message, { borderColor: palette.danger }]}
                  >
                    <Text style={{ color: palette.text }}>
                      {dictionary.registrationCaptcha}
                    </Text>
                  </View>
                );
              } else {
                return (
                  <View style={styles.form}>
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[0] = node;
                      }}
                      label={dictionary.username}
                      value={username}
                      onChangeText={(value) => {
                        setUsername(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "username"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.username}
                      palette={palette}
                    />
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[1] = node;
                      }}
                      label={dictionary.firstName}
                      value={firstName}
                      onChangeText={(value) => {
                        setFirstName(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "firstName"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.firstName}
                      palette={palette}
                    />
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[2] = node;
                      }}
                      label={dictionary.lastName}
                      value={lastName}
                      onChangeText={(value) => {
                        setLastName(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "lastName"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.lastName}
                      palette={palette}
                    />
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[3] = node;
                      }}
                      label={dictionary.email}
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "email"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.email}
                      keyboardType="email-address"
                      palette={palette}
                    />
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[4] = node;
                      }}
                      label={dictionary.newPassword}
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "password"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.password}
                      secureTextEntry
                      palette={palette}
                    />
                    <Field
                      inputRef={(node) => {
                        inputRefs.current[5] = node;
                      }}
                      label={dictionary.confirmPassword}
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        setFieldErrors((current) =>
                          omitFieldError(current, "confirmPassword"),
                        );
                        setError(null);
                      }}
                      error={fieldErrors.confirmPassword}
                      secureTextEntry
                      palette={palette}
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
                      <Text
                        style={{ color: palette.onPrimary, fontWeight: "700" }}
                      >
                        {dictionary.createAccount}
                      </Text>
                    </Pressable>
                  </View>
                );
              }
            }
          }
        })()}
      </MobileFormScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  palette,
  secureTextEntry = false,
  keyboardType = "default",
  inputRef,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly error?: string;
  readonly palette: ReturnType<typeof useTheme>["palette"];
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: "default" | "email-address";
  readonly inputRef?: (node: TextInput | null) => void;
}) {
  return (
    <View>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCapitalize="none"
        ref={inputRef}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
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
  loading: { marginTop: spacing.xl },
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
