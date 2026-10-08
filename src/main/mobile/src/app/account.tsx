import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

import { AppIcon } from "@/components/AppIcon";
import { AccountTabBar } from "@/components/AccountTabBar";
import { useLocale } from "@/i18n/LocaleProvider";
import {
  getAccountProfile,
  updateAccountProfile,
  type AccountProfile,
} from "@/api/account-api";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function AccountScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, signOut, status, refreshSession } = useMobileAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (retry = false) => {
      if (!session) return;
      setProfileLoading(true);
      setProfileError(false);
      try {
        const currentSession = retry
          ? await refreshSession(true)
          : await refreshSession();
        if (!currentSession) {
          setProfileError(true);
          return;
        }
        const nextProfile = await getAccountProfile(
          currentSession.accessToken,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        setProfile(nextProfile);
        setFirstName(nextProfile.firstName ?? "");
        setLastName(nextProfile.lastName ?? "");
        setEmail(nextProfile.email ?? "");
        setCurrentPassword("");
      } catch {
        setProfileError(true);
      } finally {
        setProfileLoading(false);
      }
    },
    [refreshSession, session],
  );

  const saveProfile = useCallback(async () => {
    if (!session || !profile) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setEmailError(dictionary.invalidEmail);
      return;
    }
    if (trimmedEmail !== (profile.email ?? "") && !currentPassword) {
      setEmailError(dictionary.emailReauthRequired);
      return;
    }
    setProfileSaving(true);
    setProfileSaveError(false);
    setEmailError(null);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) {
        setProfileSaveError(true);
        return;
      }
      const updatedProfile = await updateAccountProfile(
        currentSession.accessToken,
        {
          email: trimmedEmail || null,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          currentPassword: currentPassword.trim() || null,
        },
        {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        },
      );
      setProfile(updatedProfile);
      setFirstName(updatedProfile.firstName ?? "");
      setLastName(updatedProfile.lastName ?? "");
      setEmail(updatedProfile.email ?? "");
      setCurrentPassword("");
    } catch {
      setProfileSaveError(true);
    } finally {
      setProfileSaving(false);
    }
  }, [
    currentPassword,
    dictionary.emailReauthRequired,
    dictionary.invalidEmail,
    email,
    firstName,
    lastName,
    profile,
    refreshSession,
    session,
  ]);

  useEffect(() => {
    if (status !== "loading" && !session) router.replace("/sign-in");
  }, [session, status]);

  useEffect(() => {
    if (session) queueMicrotask(() => void loadProfile());
  }, [loadProfile, session]);

  if (status === "loading") {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <ActivityIndicator
          color={palette.primary}
          accessibilityLabel={dictionary.loading}
        />
      </SafeAreaView>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.screen}>
        <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        >
        <View style={[styles.logo, { backgroundColor: palette.primary }]}>
          <AppIcon name="shield" size={38} color={palette.onPrimary} />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>
          {dictionary.accountTitle}
        </Text>
        <Text style={[styles.message, { color: palette.textMuted }]}>
          {profile?.username ?? dictionary.signedIn}
        </Text>
        {profile?.email ? (
          <Text style={[styles.email, { color: palette.textMuted }]}>
            {profile.email}
          </Text>
        ) : null}
        {profileLoading ? (
          <ActivityIndicator
            color={palette.primary}
            accessibilityLabel={dictionary.loading}
            style={styles.profileLoading}
          />
        ) : null}
        {profileError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadProfile(true)}
            style={[styles.error, { borderColor: palette.danger }]}
          >
            <Text style={{ color: palette.danger }}>
              {dictionary.profileLoadError}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.form}>
          <Text style={[styles.label, { color: palette.text }]}>
            {dictionary.firstName}
          </Text>
          <TextInput
            accessibilityLabel={dictionary.firstName}
            editable={!profileSaving && !profileLoading}
            onChangeText={setFirstName}
            placeholder={dictionary.firstName}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text },
            ]}
            value={firstName}
          />
          <Text style={[styles.label, { color: palette.text }]}>
            {dictionary.lastName}
          </Text>
          <TextInput
            accessibilityLabel={dictionary.lastName}
            editable={!profileSaving && !profileLoading}
            onChangeText={setLastName}
            placeholder={dictionary.lastName}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text },
            ]}
            value={lastName}
          />
          <Text style={[styles.label, { color: palette.text }]}>
            {dictionary.email}
          </Text>
          <TextInput
            accessibilityLabel={dictionary.email}
            editable={!profileSaving && !profileLoading}
            keyboardType="email-address"
            onChangeText={(nextEmail) => {
              setEmail(nextEmail);
              setEmailError(null);
            }}
            placeholder={dictionary.email}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              {
                borderColor: emailError ? palette.danger : palette.border,
                color: palette.text,
              },
            ]}
            value={email}
          />
          {emailError ? (
            <Text style={[styles.saveError, { color: palette.danger }]}>
              {emailError}
            </Text>
          ) : null}
          {email.trim() !== (profile?.email ?? "") ? (
            <>
              <Text style={[styles.label, { color: palette.text }]}>
                {dictionary.currentPassword}
              </Text>
              <TextInput
                accessibilityLabel={dictionary.currentPassword}
                editable={!profileSaving && !profileLoading}
                onChangeText={(nextPassword) => {
                  setCurrentPassword(nextPassword);
                  setEmailError(null);
                }}
                placeholder={dictionary.currentPassword}
                placeholderTextColor={palette.textMuted}
                secureTextEntry
                style={[
                  styles.input,
                  { borderColor: palette.border, color: palette.text },
                ]}
                value={currentPassword}
              />
            </>
          ) : null}
          {profileSaveError ? (
            <Text style={[styles.saveError, { color: palette.danger }]}>
              {dictionary.profileSaveError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: profileSaving || !profile }}
            disabled={profileSaving || !profile}
            onPress={() => void saveProfile()}
            style={[
              styles.save,
              {
                backgroundColor: palette.primary,
                opacity: profileSaving || !profile ? 0.65 : 1,
              },
            ]}
          >
            {profileSaving ? (
              <ActivityIndicator
                color={palette.onPrimary}
                accessibilityLabel={dictionary.loading}
              />
            ) : null}
            <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
              {dictionary.save}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={styles.settings}
        >
          <AppIcon name="gear" size={16} color={palette.primary} />
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.settings}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/security")}
          style={styles.settings}
        >
          <AppIcon name="shield" size={16} color={palette.primary} />
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.security}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/applications")}
          style={styles.settings}
        >
          <AppIcon name="globe" size={16} color={palette.primary} />
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.applications}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/mfa")}
          style={styles.settings}
        >
          <AppIcon name="shield" size={16} color={palette.primary} />
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.mfa}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/social-links")}
          style={styles.settings}
        >
          <AppIcon name="globe" size={16} color={palette.primary} />
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.socialLinks}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: status === "signing-out" }}
          disabled={status === "signing-out"}
          onPress={() => void signOut()}
          style={[styles.action, { borderColor: palette.border }]}
        >
          {status === "signing-out" ? (
            <ActivityIndicator
              color={palette.text}
              accessibilityLabel={dictionary.loading}
            />
          ) : (
            <AppIcon name="logout" size={16} color={palette.text} />
          )}
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {dictionary.signOut}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/")}
        >
          <Text style={[styles.secondary, { color: palette.primary }]}>
            {dictionary.continue}
          </Text>
        </Pressable>
        </ScrollView>
        <AccountTabBar active="account" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  logo: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 82,
    justifyContent: "center",
    width: 82,
  },
  title: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  message: { fontSize: 16, marginTop: spacing.sm },
  email: { fontSize: 14, marginTop: spacing.xs },
  profileLoading: { marginTop: spacing.md },
  error: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  form: { alignSelf: "stretch", marginTop: spacing.lg, maxWidth: 420 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  input: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  saveError: { fontSize: 13, marginBottom: spacing.sm },
  save: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  settings: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  action: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xl,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  secondary: { fontSize: 14, marginTop: spacing.lg },
});
