import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
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

import { getCaptchaSettings, registerAccount } from "@/api/public-api";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { authorizationServerIssuer } from "@/config";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function RegisterScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaEnabled, setCaptchaEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [browserPending, setBrowserPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserError, setBrowserError] = useState(false);

  useEffect(() => {
    void getCaptchaSettings()
      .then((settings) => setCaptchaEnabled(settings.enabled))
      .catch(() => setCaptchaEnabled(true));
  }, []);

  const submit = async () => {
    if (pending || captchaEnabled !== false) return;
    if (
      !username.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim()
    ) {
      setError(dictionary.registrationError);
      return;
    }
    if (
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      password.length < 12 ||
      password !== confirmPassword
    ) {
      setError(dictionary.registrationError);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await registerAccount({
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        locale: resolvedLocale,
      });
      setSuccess(true);
    } catch {
      setError(dictionary.registrationError);
    } finally {
      setPending(false);
    }
  };

  const openBrowserRegistration = async () => {
    if (browserPending) return;
    setBrowserPending(true);
    setBrowserError(false);
    try {
      await WebBrowser.openBrowserAsync(
        `${authorizationServerIssuer.replace(/\/$/, "")}/register`,
      );
    } catch {
      setBrowserError(true);
    } finally {
      setBrowserPending(false);
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
        <BrandMark size={72} />
        <Text style={[styles.title, { color: palette.text }]}>
          {dictionary.registrationTitle}
        </Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>
          {dictionary.registrationHelp}
        </Text>
        {success ? (
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
        ) : captchaEnabled === null ? (
          <ActivityIndicator
            color={palette.primary}
            accessibilityLabel={dictionary.loading}
            style={styles.loading}
          />
        ) : captchaEnabled ? (
          <View style={[styles.message, { borderColor: palette.border }]}>
            <Text style={{ color: palette.text }}>
              {dictionary.registrationCaptcha}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: browserPending }}
              disabled={browserPending}
              onPress={() => void openBrowserRegistration()}
              style={[styles.link, { opacity: browserPending ? 0.65 : 1 }]}
            >
              {browserPending ? (
                <ActivityIndicator color={palette.primary} size="small" />
              ) : null}
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                {dictionary.continueInBrowser}
              </Text>
            </Pressable>
            {browserError ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {dictionary.browserError}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.form}>
            <Field
              label={dictionary.username}
              value={username}
              onChangeText={setUsername}
              palette={palette}
            />
            <Field
              label={dictionary.firstName}
              value={firstName}
              onChangeText={setFirstName}
              palette={palette}
            />
            <Field
              label={dictionary.lastName}
              value={lastName}
              onChangeText={setLastName}
              palette={palette}
            />
            <Field
              label={dictionary.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              palette={palette}
            />
            <Field
              label={dictionary.newPassword}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              palette={palette}
            />
            <Field
              label={dictionary.confirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              palette={palette}
            />
            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {error}
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
                {dictionary.createAccount}
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
  keyboardType?: "default" | "email-address";
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
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  help: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  form: { gap: spacing.sm, marginTop: spacing.xl },
  loading: { marginTop: spacing.xl },
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
