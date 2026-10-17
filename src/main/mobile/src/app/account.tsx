import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { AccountTabBar } from "@/components/AccountTabBar";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import { useLocale } from "@/i18n/LocaleProvider";
import {
  AccountApiError,
  deleteAccountAvatar,
  getAccountAvatar,
  getAccountProfile,
  getAccountProfileAttributes,
  updateAccountProfile,
  updateAccountProfileAttributes,
  sendAccountVerificationEmail,
  uploadAccountAvatar,
  type AccountProfileAttributeDefinition,
  type AccountProfileAttributes,
  type AccountProfile,
} from "@/api/account-api";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { authorizationServerIssuer } from "@/config";
import { radii, spacing } from "@/theme/tokens";
import { isValidEmailAddress } from "@/utils/email";
import { problemFieldErrors } from "../../../shared/src/api.ts";

type ProfileField = "firstName" | "lastName" | "email";
const BUILT_IN_PROFILE_FIELDS = new Set(["username", "email", "firstName", "lastName"]);

function validateProfileAttributes(
  definitions: AccountProfileAttributeDefinition[],
  values: Record<string, string[]>,
  requiredMessage: string,
  invalidMessage: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const definition of definitions) {
    if (BUILT_IN_PROFILE_FIELDS.has(definition.name)) continue;
    const items = (values[definition.name] ?? []).map((item) => item.trim()).filter(Boolean);
    if (definition.required && items.length === 0) {
      errors[definition.name] = requiredMessage;
      continue;
    }
    if (!definition.multivalued && items.length > 1) {
      errors[definition.name] = invalidMessage;
      continue;
    }
    for (const item of items) {
      let invalid =
        (definition.minLength !== null && item.length < definition.minLength) ||
        (definition.maxLength !== null && item.length > definition.maxLength);
      if (definition.type === "EMAIL") invalid ||= !isValidEmailAddress(item);
      if (definition.type === "INTEGER") invalid ||= !/^-?\d+$/.test(item);
      if (definition.type === "BOOLEAN") invalid ||= !["true", "false"].includes(item);
      if (definition.pattern) {
        try {
          invalid ||= !new RegExp(definition.pattern).test(item);
        } catch {
          invalid = true;
        }
      }
      if (invalid) {
        errors[definition.name] = invalidMessage;
        break;
      }
    }
  }
  return errors;
}

function profileAttributeServerErrors(cause: AccountApiError): Record<string, string> {
  return (cause.problem?.violations ?? []).reduce<Record<string, string>>(
    (errors, violation) => {
      const field = violation.field?.replace(/^attributes\./, "");
      if (field && violation.message) errors[field] = violation.message;
      return errors;
    },
    {},
  );
}

export default function AccountScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const { session, signOut, status, refreshSession } = useMobileAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState(false);
  const [profileAttributes, setProfileAttributes] = useState<AccountProfileAttributes | null>(null);
  const [profileAttributeValues, setProfileAttributeValues] = useState<Record<string, string[]>>({});
  const [profileAttributeErrors, setProfileAttributeErrors] = useState<Record<string, string>>({});
  const [profileAttributesLoadError, setProfileAttributesLoadError] = useState(false);
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Partial<Record<ProfileField, string>>
  >({});
  const profileLoadInFlight = useRef(false);
  const profileSaveInFlight = useRef(false);
  const profileAttributeRefs = useRef<Record<string, TextInput | null>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationError, setVerificationError] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const avatarSaveInFlight = useRef(false);
  const verificationInFlight = useRef(false);

  const loadProfile = useCallback(
    async (retry = false) => {
      if (!session || profileLoadInFlight.current) return;
      profileLoadInFlight.current = true;
      setProfileLoading(true);
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
        const nextAttributes = await getAccountProfileAttributes(
          currentSession.accessToken,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        ).catch(() => null);
        const nextAvatar = await getAccountAvatar(currentSession.accessToken, {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        }).catch(() => null);
        setProfile(nextProfile);
        setFirstName(nextProfile.firstName ?? "");
        setLastName(nextProfile.lastName ?? "");
        setEmail(nextProfile.email ?? "");
        setCurrentPassword("");
        setProfileAttributes(nextAttributes);
        setProfileAttributeValues(nextAttributes?.attributes ?? {});
        setProfileAttributesLoadError(nextAttributes === null);
        setAvatarUrl(nextAvatar?.avatarUrl ?? null);
        setProfileError(false);
      } catch {
        setProfileError(true);
      } finally {
        setProfileLoading(false);
        profileLoadInFlight.current = false;
      }
    },
    [refreshSession, session],
  );

  const chooseAvatar = useCallback(async () => {
    if (!session || avatarSaveInFlight.current) return;
    setAvatarError(null);
    setAvatarSaving(true);
    avatarSaveInFlight.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (
        asset.width <= 0 ||
        asset.height <= 0 ||
        asset.width * asset.height > 40_000_000
      ) {
        setAvatarError(dictionary.accountAvatarInvalid);
        return;
      }
      const maxDimension = 2000;
      const pixelCount = asset.width * asset.height;
      const scale = Math.min(
        1,
        maxDimension / Math.max(asset.width, asset.height),
        Math.sqrt(4_000_000 / pixelCount),
      );
      const resize =
        scale < 1
          ? {
              width: Math.floor(asset.width * scale),
              height: Math.floor(asset.height * scale),
            }
          : undefined;
      const converted = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize ? [{ resize }] : [],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      const file = new File(converted.uri);
      if (
        converted.width * converted.height > 4_000_000 ||
        file.size <= 0 ||
        file.size > 2 * 1024 * 1024
      ) {
        setAvatarError(dictionary.accountAvatarInvalid);
        return;
      }
      const currentSession = await refreshSession();
      if (!currentSession) {
        setAvatarError(dictionary.accountAvatarUploadError);
        return;
      }
      const uploaded = await uploadAccountAvatar(
        currentSession.accessToken,
        { uri: converted.uri, name: "profile.jpg", type: "image/jpeg" },
        {
          refreshAccessToken: async () =>
            (await refreshSession(true))?.accessToken ?? null,
        },
      );
      setAvatarUrl(uploaded.avatarUrl);
    } catch (cause) {
      if (cause instanceof AccountApiError && [400, 413, 415].includes(cause.status)) {
        setAvatarError(dictionary.accountAvatarInvalid);
      } else if (cause instanceof Error && /permission|denied/i.test(cause.message)) {
        setAvatarError(dictionary.accountAvatarPermissionDenied);
      } else {
        setAvatarError(dictionary.accountAvatarUploadError);
      }
    } finally {
      setAvatarSaving(false);
      avatarSaveInFlight.current = false;
    }
  }, [
    dictionary.accountAvatarInvalid,
    dictionary.accountAvatarPermissionDenied,
    dictionary.accountAvatarUploadError,
    refreshSession,
    session,
  ]);

  const removeAvatar = useCallback(async () => {
    if (!session || avatarSaveInFlight.current) return;
    avatarSaveInFlight.current = true;
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("account_session_unavailable");
      await deleteAccountAvatar(currentSession.accessToken, {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      });
      setAvatarUrl(null);
    } catch {
      setAvatarError(dictionary.accountAvatarUploadError);
    } finally {
      setAvatarSaving(false);
      avatarSaveInFlight.current = false;
    }
  }, [dictionary.accountAvatarUploadError, refreshSession, session]);

  const confirmRemoveAvatar = useCallback(() => {
    Alert.alert(dictionary.accountAvatarRemove, dictionary.accountAvatarRemoveConfirm, [
      { text: dictionary.cancel, style: "cancel" },
      {
        text: dictionary.accountAvatarRemove,
        style: "destructive",
        onPress: () => void removeAvatar(),
      },
    ]);
  }, [
    dictionary.accountAvatarRemove,
    dictionary.accountAvatarRemoveConfirm,
    dictionary.cancel,
    removeAvatar,
  ]);

  const sendVerification = useCallback(async () => {
    if (!session || verificationInFlight.current) return;
    verificationInFlight.current = true;
    setVerificationSending(true);
    setVerificationError(false);
    setVerificationSent(false);
    try {
      const currentSession = await refreshSession();
      if (!currentSession) throw new Error("account_session_unavailable");
      await sendAccountVerificationEmail(currentSession.accessToken, {
        refreshAccessToken: async () =>
          (await refreshSession(true))?.accessToken ?? null,
      });
      setVerificationSent(true);
    } catch {
      setVerificationError(true);
    } finally {
      setVerificationSending(false);
      verificationInFlight.current = false;
    }
  }, [refreshSession, session]);

  const saveProfile = useCallback(async () => {
    if (!session || !profile || profileSaveInFlight.current) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !isValidEmailAddress(trimmedEmail)) {
      setEmailError(dictionary.invalidEmail);
      return;
    }
    if (trimmedEmail !== (profile.email ?? "") && !currentPassword) {
      setEmailError(dictionary.emailReauthRequired);
      return;
    }
    const attributeErrors = profileAttributes
      ? validateProfileAttributes(
          profileAttributes.definitions,
          profileAttributeValues,
          dictionary.profileAttributeRequired,
          dictionary.profileAttributeInvalid,
        )
      : {};
    setProfileAttributeErrors(attributeErrors);
    const firstInvalidAttribute = Object.keys(attributeErrors)[0];
    if (firstInvalidAttribute) {
      profileAttributeRefs.current[firstInvalidAttribute]?.focus();
      return;
    }
    profileSaveInFlight.current = true;
    setProfileSaving(true);
    setProfileSaveError(false);
    setProfileFieldErrors({});
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
      if (profileAttributes) {
        const updatedAttributes = await updateAccountProfileAttributes(
          currentSession.accessToken,
          profileAttributeValues,
          {
            refreshAccessToken: async () =>
              (await refreshSession(true))?.accessToken ?? null,
          },
        );
        setProfileAttributes(updatedAttributes);
        setProfileAttributeValues(updatedAttributes.attributes ?? {});
      }
      setProfile(updatedProfile);
      setFirstName(updatedProfile.firstName ?? "");
      setLastName(updatedProfile.lastName ?? "");
      setEmail(updatedProfile.email ?? "");
      setCurrentPassword("");
    } catch (cause) {
      const errors =
        cause instanceof AccountApiError ? problemFieldErrors(cause) : {};
      const profileErrors = Object.fromEntries(
        Object.entries(errors).filter(([field]) =>
          ["firstName", "lastName", "email"].includes(field),
        ),
      ) as Partial<Record<ProfileField, string>>;
      setProfileFieldErrors(profileErrors);
      if (cause instanceof AccountApiError) {
        const serverErrors = profileAttributeServerErrors(cause);
        setProfileAttributeErrors(serverErrors);
      }
      setProfileSaveError(Object.keys(profileErrors).length === 0);
    } finally {
      setProfileSaving(false);
      profileSaveInFlight.current = false;
    }
  }, [
    currentPassword,
    dictionary.emailReauthRequired,
    dictionary.invalidEmail,
    dictionary.profileAttributeInvalid,
    dictionary.profileAttributeRequired,
    email,
    firstName,
    lastName,
    profile,
    profileAttributes,
    profileAttributeValues,
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
        <MobileFormScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BrandMark size={82} />
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
              accessibilityState={{ disabled: profileLoading }}
              disabled={profileLoading}
              onPress={() => void loadProfile(true)}
              style={[styles.error, { borderColor: palette.danger }]}
            >
              <Text style={{ color: palette.danger }}>
                {dictionary.profileLoadError}
              </Text>
              {profileLoading ? (
                <ActivityIndicator
                  color={palette.danger}
                  accessibilityLabel={dictionary.loading}
                />
              ) : null}
            </Pressable>
          ) : null}
          <View style={styles.form} testID="account-profile-form">
            <View style={[styles.avatarSection, { borderColor: palette.border }]}>
              <View style={styles.avatarHeading}>
                {avatarUrl ? (
                  <Image
                    accessibilityLabel={dictionary.accountAvatar}
                    source={{
                      uri: new URL(avatarUrl, `${authorizationServerIssuer}/`).toString(),
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View
                    accessibilityLabel={dictionary.accountAvatar}
                    accessibilityRole="image"
                    style={[styles.avatarPlaceholder, { backgroundColor: palette.surface }]}
                  >
                    <AppIcon name="user" size={28} color={palette.textMuted} />
                  </View>
                )}
                <View style={styles.avatarCopy}>
                  <Text style={[styles.label, { color: palette.text }]}>
                    {dictionary.accountAvatar}
                  </Text>
                  <Text style={[styles.attributeDescription, { color: palette.textMuted }]}>
                    {dictionary.accountAvatarHelp}
                  </Text>
                </View>
              </View>
              <View style={styles.avatarActions} testID="account-avatar-actions">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: avatarSaving || profileLoading }}
                  disabled={avatarSaving || profileLoading}
                  onPress={() => void chooseAvatar()}
                  style={[styles.secondaryAction, { borderColor: palette.border }]}
                >
                  {avatarSaving ? (
                    <ActivityIndicator color={palette.primary} accessibilityLabel={dictionary.loading} />
                  ) : (
                    <AppIcon name="upload" size={16} color={palette.primary} />
                  )}
                  <Text style={[styles.secondary, { color: palette.primary }]}>
                    {dictionary.accountAvatarChoose}
                  </Text>
                </Pressable>
                {avatarUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: avatarSaving || profileLoading }}
                    disabled={avatarSaving || profileLoading}
                    onPress={confirmRemoveAvatar}
                    style={[styles.secondaryAction, { borderColor: palette.border }]}
                  >
                    <AppIcon name="trash" size={16} color={palette.danger} />
                    <Text style={{ color: palette.danger, fontWeight: "700" }}>
                      {dictionary.accountAvatarRemove}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {avatarError ? (
                <Text accessibilityRole="alert" style={[styles.saveError, { color: palette.danger }]}>
                  {avatarError}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.label, { color: palette.text }]}>
              {dictionary.firstName}
            </Text>
            <TextInput
              accessibilityLabel={dictionary.firstName}
              editable={!profileSaving && !profileLoading}
              onChangeText={(value) => {
                setFirstName(value);
                setProfileFieldErrors((current) => ({
                  ...current,
                  firstName: undefined,
                }));
              }}
              placeholder={dictionary.firstName}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                { borderColor: palette.border, color: palette.text },
              ]}
              value={firstName}
            />
            {profileFieldErrors.firstName ? (
              <Text
                accessibilityRole="alert"
                style={[styles.saveError, { color: palette.danger }]}
              >
                {profileFieldErrors.firstName}
              </Text>
            ) : null}
            <Text style={[styles.label, { color: palette.text }]}>
              {dictionary.lastName}
            </Text>
            <TextInput
              accessibilityLabel={dictionary.lastName}
              editable={!profileSaving && !profileLoading}
              onChangeText={(value) => {
                setLastName(value);
                setProfileFieldErrors((current) => ({
                  ...current,
                  lastName: undefined,
                }));
              }}
              placeholder={dictionary.lastName}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                { borderColor: palette.border, color: palette.text },
              ]}
              value={lastName}
            />
            {profileFieldErrors.lastName ? (
              <Text
                accessibilityRole="alert"
                style={[styles.saveError, { color: palette.danger }]}
              >
                {profileFieldErrors.lastName}
              </Text>
            ) : null}
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
                setProfileFieldErrors((current) => ({
                  ...current,
                  email: undefined,
                }));
              }}
              placeholder={dictionary.email}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                {
                  borderColor:
                    emailError || profileFieldErrors.email
                      ? palette.danger
                      : palette.border,
                  color: palette.text,
                },
              ]}
              value={email}
            />
            {emailError || profileFieldErrors.email ? (
              <Text
                accessibilityRole="alert"
                style={[styles.saveError, { color: palette.danger }]}
              >
                {emailError ?? profileFieldErrors.email}
              </Text>
            ) : null}
            {profile?.pendingEmail ? (
              <Text accessibilityRole="text" style={[styles.statusMessage, { color: palette.textMuted }]}>
                {dictionary.accountEmailVerificationPending} {profile.pendingEmail}
              </Text>
            ) : profile?.email ? (
              <>
                <Text accessibilityRole="text" style={[styles.statusMessage, { color: palette.textMuted }]}>
                  {profile.emailVerified
                    ? dictionary.accountEmailVerified
                    : dictionary.accountEmailNotVerified}
                </Text>
                {!profile.emailVerified ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: verificationSending || profileLoading }}
                    disabled={verificationSending || profileLoading}
                    onPress={() => void sendVerification()}
                    style={[styles.secondaryAction, { alignSelf: "flex-start", borderColor: palette.border }]}
                  >
                    {verificationSending ? (
                      <ActivityIndicator color={palette.primary} accessibilityLabel={dictionary.loading} />
                    ) : (
                      <AppIcon name="send" size={16} color={palette.primary} />
                    )}
                    <Text style={[styles.secondary, { color: palette.primary }]}>
                      {dictionary.accountSendVerification}
                    </Text>
                  </Pressable>
                ) : null}
                {verificationSent ? (
                  <Text accessibilityRole="text" style={[styles.statusMessage, { color: palette.textMuted }]}>
                    {dictionary.accountVerificationSent}
                  </Text>
                ) : null}
                {verificationError ? (
                  <Text accessibilityRole="alert" style={[styles.saveError, { color: palette.danger }]}>
                    {dictionary.accountVerificationError}
                  </Text>
                ) : null}
              </>
            ) : null}
            {profileAttributesLoadError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: profileLoading }}
                disabled={profileLoading}
                onPress={() => void loadProfile(true)}
                style={[styles.error, { borderColor: palette.danger }]}
              >
                <Text style={{ color: palette.danger }}>
                  {dictionary.profileAttributesLoadError}
                </Text>
                {profileLoading ? (
                  <ActivityIndicator
                    color={palette.danger}
                    accessibilityLabel={dictionary.loading}
                  />
                ) : null}
              </Pressable>
            ) : null}
            {profileAttributes?.definitions.some(
              (definition) => !BUILT_IN_PROFILE_FIELDS.has(definition.name),
            ) ? (
              <>
                <Text style={[styles.attributeHeading, { color: palette.text }]}>
                  {dictionary.profileAttributes}
                </Text>
                {profileAttributes.definitions
                  .filter((definition) => !BUILT_IN_PROFILE_FIELDS.has(definition.name))
                  .map((definition) => {
                    const values = profileAttributeValues[definition.name] ?? [];
                    const error = profileAttributeErrors[definition.name];
                    return (
                      <View key={definition.name}>
                        <Text style={[styles.label, { color: palette.text }]}>
                          {definition.displayName}
                          {definition.required ? " *" : ""}
                        </Text>
                        {definition.description ? (
                          <Text style={[styles.attributeDescription, { color: palette.textMuted }]}>
                            {definition.description}
                          </Text>
                        ) : null}
                        <TextInput
                          accessibilityLabel={definition.displayName}
                          accessibilityHint={definition.description ?? undefined}
                          editable={!profileSaving && !profileLoading}
                          testID={`profile-attribute-${definition.name}`}
                          ref={(input) => {
                            profileAttributeRefs.current[definition.name] = input;
                          }}
                          keyboardType={definition.type === "INTEGER" ? "numeric" : definition.type === "EMAIL" ? "email-address" : "default"}
                          multiline={definition.multivalued}
                          onChangeText={(text) => {
                            setProfileAttributeValues((current) => ({
                              ...current,
                              [definition.name]: definition.multivalued
                                ? text.split(/\r?\n/)
                                : [text],
                            }));
                            setProfileAttributeErrors((current) => ({
                              ...current,
                              [definition.name]: "",
                            }));
                          }}
                          placeholder={definition.displayName}
                          placeholderTextColor={palette.textMuted}
                          style={[
                            styles.input,
                            styles.attributeInput,
                            {
                              borderColor: error ? palette.danger : palette.border,
                              color: palette.text,
                            },
                          ]}
                          value={values.join(definition.multivalued ? "\n" : "")}
                        />
                        {error ? (
                          <Text accessibilityRole="alert" style={[styles.saveError, { color: palette.danger }]}>
                            {error}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
              </>
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
            accessibilityLabel={dictionary.applications}
            onPress={() => router.push("/applications")}
            style={styles.settings}
            testID="account-applications"
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
        </MobileFormScrollView>
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
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    width: "100%",
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
  avatarSection: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  avatarHeading: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  avatarImage: { borderRadius: radii.pill, height: 72, width: 72 },
  avatarPlaceholder: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  avatarCopy: { flex: 1, minWidth: 0 },
  avatarActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  secondaryAction: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  statusMessage: { fontSize: 14, marginBottom: spacing.sm },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  attributeHeading: { fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
  attributeDescription: { fontSize: 13, marginBottom: spacing.xs },
  attributeInput: { minHeight: 48, textAlignVertical: "top" },
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
  secondary: { fontSize: 14 },
});
