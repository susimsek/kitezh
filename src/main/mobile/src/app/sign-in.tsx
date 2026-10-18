import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { MobileFormScrollView } from "@/components/MobileFormScrollView";
import {
  getMobileLoginMfaSetup,
  getMobileLoginPasskeyRegistrationOptions,
  getMobileLoginRecoveryCodes,
  getLoginCaptchaSettings,
  getSocialProviders,
  type SocialProviderAvailability,
  type LoginCaptchaSettings,
} from "@/api/public-api";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import {
  createNativePasskey,
  isNativePasskeySupported,
} from "@/auth/native-passkey";
import { createNativeCaptchaToken } from "@/auth/native-captcha";
import { isNativeSocialProviderConfigured } from "@/auth/native-social-login";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { controlSizes, radii, spacing, typography } from "@/theme/tokens";
import { socialProviderIcon } from "@kitezh/shared/icons";

type CaptchaState = "loading" | "disabled" | "enabled" | "unavailable";
type ActionValues = {
  firstName: string;
  lastName: string;
  email: string;
  newPassword: string;
  code: string;
  accepted: boolean;
  confirmed: boolean;
  passkeyLabel: string;
};

const emptyActionValues: ActionValues = {
  firstName: "",
  lastName: "",
  email: "",
  newPassword: "",
  code: "",
  accepted: false,
  confirmed: false,
  passkeyLabel: "",
};

export default function SignInScreen() {
  const { dictionary, resolvedLocale } = useLocale();
  const { palette } = useTheme();
  const {
    error,
    loginChallenge,
    nativeLogin,
    nativePasskeyLogin,
    signIn,
    status,
    discoveryStatus,
    retryDiscovery,
    submitLoginMfa,
    submitLoginAction,
    submitLoginPasskeyRegistration,
    cancelNativeLogin,
  } = useMobileAuth();
  const [providers, setProviders] = useState<SocialProviderAvailability[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersUnavailable, setProvidersUnavailable] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [captchaState, setCaptchaState] = useState<CaptchaState>("loading");
  const [captchaLocale, setCaptchaLocale] = useState<string | null>(null);
  const [captchaSettings, setCaptchaSettings] =
    useState<LoginCaptchaSettings | null>(null);
  const [captchaPending, setCaptchaPending] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [actionValues, setActionValues] =
    useState<ActionValues>(emptyActionValues);
  const [actionSetup, setActionSetup] = useState<Awaited<
    ReturnType<typeof getMobileLoginMfaSetup>
  > | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<Awaited<
    ReturnType<typeof getMobileLoginRecoveryCodes>
  > | null>(null);
  const [passkeyOptions, setPasskeyOptions] = useState<Awaited<
    ReturnType<typeof getMobileLoginPasskeyRegistrationOptions>
  > | null>(null);
  const [passkeyActionPending, setPasskeyActionPending] = useState(false);
  const [actionSetupLoading, setActionSetupLoading] = useState(false);
  const [actionSetupError, setActionSetupError] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const pending = status === "signing-in";
  const discoveryPending = discoveryStatus === "loading";
  const action =
    loginChallenge?.kind === "actions" ? loginChallenge.actions[0] : null;
  const supportedActionKeys = [
    "UPDATE_PROFILE",
    "UPDATE_PASSWORD",
    "CONFIGURE_TOTP",
    "TERMS_AND_CONDITIONS",
    "DELETE_ACCOUNT",
    "CUSTOM",
    "RECOVERY_CODES",
    "CONFIGURE_PASSKEY",
    "CONFIGURE_PASSKEY_PASSWORDLESS",
  ];
  const unsupportedAction = Boolean(
    action && !supportedActionKeys.includes(action.key),
  );
  const nativeCaptchaBlocked =
    captchaLocale !== resolvedLocale ||
    (captchaState === "enabled" &&
      (captchaSettings?.nativeRequired !== true ||
        captchaSettings.nativeEnabled !== true ||
        captchaSettings.provider !== "enterprise" ||
        !(Platform.OS === "ios"
          ? captchaSettings.iosSiteKey
          : captchaSettings.androidSiteKey))) ||
    captchaState === "unavailable";
  const visibleCaptchaState =
    captchaLocale === resolvedLocale ? captchaState : "loading";
  const nativePasskeySupported = isNativePasskeySupported();

  useEffect(() => {
    if (discoveryStatus !== "ready") return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) {
          setProvidersLoading(true);
          setProvidersUnavailable(false);
        }
        return getSocialProviders({ locale: resolvedLocale });
      })
      .then((result) => {
        if (active)
          setProviders(result.filter((provider) => provider.configured));
      })
      .catch(() => {
        if (active) setProvidersUnavailable(true);
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [discoveryStatus, resolvedLocale]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => getLoginCaptchaSettings({ locale: resolvedLocale }))
      .then((settings) => {
        if (!active) return;
        setCaptchaLocale(resolvedLocale);
        setCaptchaSettings(settings);
        setCaptchaState(settings.nativeRequired ? "enabled" : "disabled");
      })
      .catch(() => {
        if (active) {
          setCaptchaLocale(resolvedLocale);
          setCaptchaSettings(null);
          setCaptchaState("unavailable");
        }
      });
    return () => {
      active = false;
    };
  }, [resolvedLocale]);

  useEffect(() => {
    const transactionId =
      loginChallenge?.kind === "actions" ? loginChallenge.transactionId : null;
    const actionKey = action?.key;
    let active = true;
    if (
      !transactionId ||
      (actionKey !== "CONFIGURE_TOTP" &&
        actionKey !== "RECOVERY_CODES" &&
        actionKey !== "CONFIGURE_PASSKEY" &&
        actionKey !== "CONFIGURE_PASSKEY_PASSWORDLESS")
    ) {
      return () => {
        active = false;
      };
    }
    void Promise.resolve()
      .then(() => {
        if (active) {
          setActionSetup(null);
          setRecoveryCodes(null);
          setPasskeyOptions(null);
          setActionSetupError(false);
          setActionSetupLoading(true);
        }
      })
      .then(async () => {
        if (actionKey === "CONFIGURE_TOTP") {
          const setup = await getMobileLoginMfaSetup(transactionId, {
            locale: resolvedLocale,
          });
          if (active) setActionSetup(setup);
        } else if (actionKey === "RECOVERY_CODES") {
          const codes = await getMobileLoginRecoveryCodes(transactionId, {
            locale: resolvedLocale,
          });
          if (active) setRecoveryCodes(codes);
        } else if (nativePasskeySupported) {
          const options = await getMobileLoginPasskeyRegistrationOptions(
            transactionId,
            actionKey,
            { locale: resolvedLocale },
          );
          if (active) setPasskeyOptions(options);
        }
      })
      .catch(() => {
        if (active) setActionSetupError(true);
      })
      .finally(() => {
        if (active) setActionSetupLoading(false);
      });
    return () => {
      active = false;
    };
  }, [action?.key, loginChallenge, nativePasskeySupported, resolvedLocale]);

  const submitCredentials = async () => {
    setFieldError(null);
    if (!username.trim()) {
      setFieldError(dictionary.loginUsernameRequired);
      return;
    }
    if (!password) {
      setFieldError(dictionary.loginPasswordRequired);
      return;
    }
    if (nativeCaptchaBlocked || captchaState === "loading") return;
    setCaptchaPending(true);
    try {
      let captchaToken: string | null = null;
      if (captchaState === "enabled") {
        const siteKey =
          Platform.OS === "ios"
            ? captchaSettings?.iosSiteKey
            : captchaSettings?.androidSiteKey;
        if (!siteKey || !captchaSettings?.action) throw new Error("captcha_config_missing");
        captchaToken = await createNativeCaptchaToken(
          siteKey,
          captchaSettings.action,
        );
      }
      void nativeLogin(username.trim(), password, captchaToken);
      setPassword("");
    } catch {
      setFieldError(dictionary.loginCaptchaNativeUnavailable);
    } finally {
      setCaptchaPending(false);
    }
  };

  const submitAction = () => {
    if (!action) return;
    let values: Record<string, unknown>;
    switch (action.key) {
      case "UPDATE_PROFILE":
        if (
          !actionValues.firstName.trim() ||
          !actionValues.lastName.trim() ||
          !actionValues.email.trim()
        ) {
          setFieldError(dictionary.requiredField);
          return;
        }
        values = {
          firstName: actionValues.firstName.trim(),
          lastName: actionValues.lastName.trim(),
          email: actionValues.email.trim(),
        };
        break;
      case "UPDATE_PASSWORD":
        if (actionValues.newPassword.length < 8) {
          setFieldError(dictionary.passwordMinimumLength);
          return;
        }
        values = { newPassword: actionValues.newPassword };
        break;
      case "CONFIGURE_TOTP":
        if (!/^\d{6,8}$/.test(actionValues.code)) {
          setFieldError(dictionary.mfaInvalidCode);
          return;
        }
        values = { code: actionValues.code };
        break;
      case "TERMS_AND_CONDITIONS":
      case "RECOVERY_CODES":
        if (!actionValues.accepted) {
          setFieldError(dictionary.requiredActionAcceptRequired);
          return;
        }
        values = { accepted: true };
        break;
      case "DELETE_ACCOUNT":
      case "CUSTOM":
        if (!actionValues.confirmed) {
          setFieldError(dictionary.requiredActionConfirmRequired);
          return;
        }
        values = { confirmed: true };
        break;
      case "UPDATE_EMAIL":
        values = {};
        break;
      default:
        return;
    }
    setFieldError(null);
    void submitLoginAction(values);
    setActionValues((current) => ({ ...current, newPassword: "" }));
  };

  const submitPasskeyAction = async () => {
    if (
      !action ||
      !loginChallenge ||
      loginChallenge.kind !== "actions" ||
      !passkeyOptions ||
      passkeyActionPending ||
      !nativePasskeySupported
    ) {
      return;
    }
    setPasskeyActionPending(true);
    setFieldError(null);
    try {
      const credential = await createNativePasskey(passkeyOptions);
      await submitLoginPasskeyRegistration(
        action.key,
        credential,
        actionValues.passkeyLabel.trim() || dictionary.defaultPasskeyLabel,
      );
    } catch {
      setFieldError(dictionary.passkeyActionError);
    } finally {
      setPasskeyActionPending(false);
    }
  };

  const updateAction = (key: keyof ActionValues, value: string | boolean) => {
    setActionValues((current) => ({ ...current, [key]: value }));
    setFieldError(null);
  };

  useEffect(() => {
    if (status === "signed-in") router.replace("/account");
  }, [status]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <MobileFormScrollView contentContainerStyle={styles.content}>
        {!loginChallenge ? (
          <>
            <BrandMark size={64} />
            <Text style={[styles.title, { color: palette.text }]}>Kitezh</Text>
            <Text style={[styles.message, { color: palette.textMuted }]}>
              {dictionary.appTagline}
            </Text>
            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {error === "authorization-timeout"
                  ? dictionary.authTimeout
                  : error === "authorization-cancelled"
                    ? dictionary.authCancelled
                    : error === "google-account-link-required"
                      ? dictionary.googleAccountLinkRequired
                    : error === "login-credentials-invalid"
                      ? dictionary.loginCredentialsInvalid
                      : error === "passkey-authentication-failed"
                        ? dictionary.passkeyLoginError
                        : dictionary.authError}
              </Text>
            ) : null}
            {discoveryStatus !== "ready" ? (
              <Text style={[styles.help, { color: palette.textMuted }]}>
                {discoveryPending
                  ? dictionary.authDiscoveryLoading
                  : discoveryStatus === "timeout"
                    ? dictionary.authDiscoveryTimeout
                    : dictionary.authDiscoveryUnavailable}
              </Text>
            ) : null}
            {discoveryStatus !== "ready" ? (
              <ActionButton
                label={dictionary.retry}
                loading={discoveryPending}
                disabled={discoveryPending}
                onPress={() => void retryDiscovery()}
                palette={palette}
                primary
              />
            ) : null}

            <View style={styles.form}>
              <Field
                label={dictionary.username}
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setFieldError(null);
                }}
                autoComplete="username"
                returnKeyType="next"
                palette={palette}
                editable={!pending && !nativeCaptchaBlocked}
              />
              <Field
                label={dictionary.loginPassword}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldError(null);
                }}
                autoComplete="password"
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={submitCredentials}
                palette={palette}
                editable={!pending && !nativeCaptchaBlocked}
              />
              {fieldError ? (
                <Text style={[styles.error, { color: palette.danger }]}>
                  {fieldError}
                </Text>
              ) : null}
              {visibleCaptchaState === "loading" ? (
                <Text style={[styles.help, { color: palette.textMuted }]}>
                  {dictionary.loginCaptchaChecking}
                </Text>
              ) : null}
              {visibleCaptchaState === "enabled" && nativeCaptchaBlocked ? (
                <Text style={[styles.error, { color: palette.danger }]}>
                  {dictionary.loginCaptchaNativeUnavailable}
                </Text>
              ) : null}
              {visibleCaptchaState === "unavailable" ? (
                <Text style={[styles.error, { color: palette.danger }]}>
                  {dictionary.loginCaptchaSettingsUnavailable}
                </Text>
              ) : null}
              <ActionButton
                label={dictionary.signIn}
                loading={pending || captchaPending}
                disabled={
                  pending || captchaPending ||
                  discoveryStatus !== "ready" ||
                  nativeCaptchaBlocked ||
                  captchaState === "loading"
                }
                onPress={() => void submitCredentials()}
                palette={palette}
                primary
              />
              {nativePasskeySupported ? (
                <ActionButton
                  label={dictionary.passkeySignIn}
                  loading={pending}
                  disabled={
                    pending || discoveryStatus !== "ready" || !username.trim()
                  }
                  onPress={() => void nativePasskeyLogin(username.trim())}
                  palette={palette}
                />
              ) : null}
            </View>
            {providersLoading ? (
              <ActivityIndicator
                accessibilityLabel={dictionary.authDiscoveryLoading}
                color={palette.primary}
                style={styles.providerLoading}
              />
            ) : null}
            {providersUnavailable ? (
              <Text style={[styles.help, { color: palette.textMuted }]}>
                {dictionary.authError}
              </Text>
            ) : null}
            {providers.map((provider) => {
              const nativeGoogle =
                provider.provider === "google" &&
                isNativeSocialProviderConfigured("google");
              const loginMode = nativeGoogle
                ? dictionary.socialLoginNative
                : dictionary.socialLoginBrowser;
              return (
                <Pressable
                  key={provider.provider}
                  accessibilityRole="button"
                  accessibilityLabel={`${dictionary.signIn} ${provider.provider}. ${loginMode}`}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={() => {
                    setPendingProvider(provider.provider);
                    void signIn(provider.provider).finally(() =>
                      setPendingProvider(null),
                    );
                  }}
                  style={({ pressed }) => [
                    styles.providerAction,
                    {
                      backgroundColor: palette.surfaceMuted,
                      opacity: pending ? 0.7 : pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  {pending && pendingProvider === provider.provider ? (
                    <ActivityIndicator color={palette.primary} />
                  ) : (
                    <AppIcon
                      name={socialProviderIcon(provider.iconKey)}
                      size={18}
                      color={palette.primary}
                    />
                  )}
                  <View style={styles.providerCopy}>
                    <Text style={{ color: palette.text, fontWeight: "700" }}>
                      {dictionary.signIn} · {provider.provider}
                    </Text>
                    <Text
                      style={[styles.providerMode, { color: palette.textMuted }]}
                    >
                      {loginMode}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.browserActions}>
              <LinkButton
                label={dictionary.forgotPassword}
                onPress={() => router.push("/forgot-password")}
                disabled={pending}
                palette={palette}
              />
              <LinkButton
                label={dictionary.createAccount}
                onPress={() => router.push("/register")}
                disabled={pending}
                palette={palette}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.challengeTitle, { color: palette.text }]}>
              {loginChallenge.kind === "mfa"
                ? dictionary.loginMfaTitle
                : (action?.displayName ?? dictionary.requiredActions)}
            </Text>
            <Text style={[styles.help, { color: palette.textMuted }]}>
              {loginChallenge.kind === "mfa"
                ? dictionary.loginMfaHelp
                : action?.description}
            </Text>
            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {dictionary.loginChallengeError}
              </Text>
            ) : null}
            {fieldError ? (
              <Text style={[styles.error, { color: palette.danger }]}>
                {fieldError}
              </Text>
            ) : null}
            {loginChallenge.kind === "mfa" ? (
              <>
                <Field
                  label={dictionary.mfaCode}
                  value={mfaCode}
                  onChangeText={(value) => {
                    setMfaCode(value.replace(/\D/g, "").slice(0, 8));
                    setFieldError(null);
                  }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  palette={palette}
                  editable={!pending}
                />
                <ActionButton
                  label={dictionary.continue}
                  loading={pending}
                  disabled={pending || !/^\d{6,8}$/.test(mfaCode)}
                  onPress={() => void submitLoginMfa(mfaCode)}
                  palette={palette}
                  primary
                />
              </>
            ) : action ? (
              <>
                {actionSetupLoading ? (
                  <ActivityIndicator
                    accessibilityLabel={dictionary.loading}
                    color={palette.primary}
                    style={styles.providerLoading}
                  />
                ) : null}
                {actionSetupError ? (
                  <Text style={[styles.error, { color: palette.danger }]}>
                    {dictionary.requiredActionSetupError}
                  </Text>
                ) : null}
                {action.key === "CONFIGURE_TOTP" && actionSetup ? (
                  <>
                    <Image
                      accessibilityLabel={dictionary.mfaSetup}
                      source={{ uri: actionSetup.qrCode }}
                      style={styles.qr}
                    />
                    <Text style={[styles.help, { color: palette.textMuted }]}>
                      {dictionary.mfaSecret}: {actionSetup.secret}
                    </Text>
                    <Text style={[styles.help, { color: palette.textMuted }]}>
                      {dictionary.mfaAlgorithm}: {actionSetup.algorithm} ·{" "}
                      {dictionary.mfaDigits}: {actionSetup.digits} ·{" "}
                      {dictionary.mfaPeriod}: {actionSetup.periodSeconds}s
                    </Text>
                  </>
                ) : null}
                {action.key === "RECOVERY_CODES" && recoveryCodes ? (
                  <>
                    <Text style={[styles.help, { color: palette.textMuted }]}>
                      {dictionary.recoveryCodesHelp}
                    </Text>
                    <View
                      style={[
                        styles.recoveryCodes,
                        { backgroundColor: palette.surfaceMuted },
                      ]}
                    >
                      {recoveryCodes.codes.map((recoveryCode) => (
                        <Text
                          key={recoveryCode}
                          style={[styles.recoveryCode, { color: palette.text }]}
                        >
                          {recoveryCode}
                        </Text>
                      ))}
                    </View>
                    <Text style={[styles.help, { color: palette.textMuted }]}>
                      {dictionary.recoveryCodesRemaining}:{" "}
                      {recoveryCodes.remaining}
                    </Text>
                  </>
                ) : null}
                {action.key.startsWith("CONFIGURE_PASSKEY") ? (
                  nativePasskeySupported ? (
                    <>
                      <Text style={[styles.help, { color: palette.textMuted }]}>
                        {dictionary.requiredActionPasskeyHelp}
                      </Text>
                      <Field
                        label={dictionary.passkeyLabel}
                        value={actionValues.passkeyLabel}
                        onChangeText={(value) =>
                          updateAction("passkeyLabel", value)
                        }
                        palette={palette}
                        editable={!pending && !passkeyActionPending}
                        autoCapitalize="words"
                        autoComplete="off"
                      />
                    </>
                  ) : (
                    <Text style={[styles.error, { color: palette.danger }]}>
                      {dictionary.requiredActionNativeUnavailable}
                    </Text>
                  )
                ) : null}
                {renderActionFields(
                  action.key,
                  actionValues,
                  updateAction,
                  palette,
                  dictionary,
                  pending,
                )}
                {unsupportedAction ? (
                  <Text style={[styles.error, { color: palette.danger }]}>
                    {dictionary.requiredActionNativeUnavailable}
                  </Text>
                ) : null}
                {action.key === "UPDATE_EMAIL" ? (
                  <Text style={[styles.help, { color: palette.textMuted }]}>
                    {dictionary.requiredActionEmailHelp}
                  </Text>
                ) : null}
                {action.key.startsWith("CONFIGURE_PASSKEY") ? (
                  <ActionButton
                    label={dictionary.requiredActionPasskey}
                    loading={pending || passkeyActionPending}
                    disabled={
                      pending ||
                      passkeyActionPending ||
                      actionSetupLoading ||
                      actionSetupError ||
                      !nativePasskeySupported ||
                      !passkeyOptions
                    }
                    onPress={() => void submitPasskeyAction()}
                    palette={palette}
                    primary
                  />
                ) : action.key === "UPDATE_EMAIL" ? (
                  <ActionButton
                    label={dictionary.requiredActionEmailRestart}
                    loading={pending}
                    disabled={pending}
                    onPress={() => void cancelNativeLogin()}
                    palette={palette}
                    primary
                  />
                ) : (
                  <ActionButton
                    label={dictionary.continue}
                    loading={pending}
                    disabled={
                      pending ||
                      unsupportedAction ||
                      actionSetupLoading ||
                      actionSetupError ||
                      (action.key === "CONFIGURE_TOTP" && !actionSetup) ||
                      (action.key === "RECOVERY_CODES" && !recoveryCodes)
                    }
                    onPress={submitAction}
                    palette={palette}
                    primary
                  />
                )}
              </>
            ) : (
              <Text style={[styles.error, { color: palette.danger }]}>
                {dictionary.requiredActionNativeUnavailable}
              </Text>
            )}
            <LinkButton
              label={dictionary.cancelSignIn}
              onPress={() => void cancelNativeLogin()}
              disabled={pending}
              palette={palette}
            />
          </>
        )}
      </MobileFormScrollView>
    </SafeAreaView>
  );
}

function renderActionFields(
  key: string,
  values: ActionValues,
  update: (key: keyof ActionValues, value: string | boolean) => void,
  palette: ReturnType<typeof useTheme>["palette"],
  dictionary: ReturnType<typeof useLocale>["dictionary"],
  disabled: boolean,
) {
  if (key === "UPDATE_PROFILE") {
    return (
      <>
        <Field
          label={dictionary.firstName}
          value={values.firstName}
          onChangeText={(value) => update("firstName", value)}
          palette={palette}
          editable={!disabled}
        />
        <Field
          label={dictionary.lastName}
          value={values.lastName}
          onChangeText={(value) => update("lastName", value)}
          palette={palette}
          editable={!disabled}
        />
        <Field
          label={dictionary.email}
          value={values.email}
          onChangeText={(value) => update("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          palette={palette}
          editable={!disabled}
        />
      </>
    );
  }
  if (key === "UPDATE_PASSWORD") {
    return (
      <Field
        label={dictionary.newPassword}
        value={values.newPassword}
        onChangeText={(value) => update("newPassword", value)}
        secureTextEntry
        palette={palette}
        editable={!disabled}
      />
    );
  }
  if (key === "CONFIGURE_TOTP") {
    return (
      <Field
        label={dictionary.mfaCode}
        value={values.code}
        onChangeText={(value) =>
          update("code", value.replace(/\D/g, "").slice(0, 8))
        }
        keyboardType="number-pad"
        autoComplete="one-time-code"
        palette={palette}
        editable={!disabled}
      />
    );
  }
  if (["TERMS_AND_CONDITIONS", "RECOVERY_CODES"].includes(key)) {
    return (
      <CheckField
        label={
          key === "TERMS_AND_CONDITIONS"
            ? dictionary.requiredActionAcceptTerms
            : dictionary.requiredActionAccept
        }
        checked={values.accepted}
        onPress={() => update("accepted", !values.accepted)}
        palette={palette}
        disabled={disabled}
      />
    );
  }
  if (["DELETE_ACCOUNT", "CUSTOM"].includes(key)) {
    return (
      <CheckField
        label={dictionary.requiredActionConfirm}
        checked={values.confirmed}
        onPress={() => update("confirmed", !values.confirmed)}
        palette={palette}
        disabled={disabled}
      />
    );
  }
  return null;
}

function Field({
  label,
  value,
  onChangeText,
  palette,
  editable = true,
  ...props
}: Readonly<
  {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    palette: ReturnType<typeof useTheme>["palette"];
    editable?: boolean;
  } & Pick<
    import("react-native").TextInputProps,
    | "autoCapitalize"
    | "autoComplete"
    | "keyboardType"
    | "returnKeyType"
    | "secureTextEntry"
    | "onSubmitEditing"
  >
>) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            color: palette.text,
            opacity: editable ? 1 : 0.65,
          },
        ]}
        {...props}
      />
    </View>
  );
}

function CheckField({
  label,
  checked,
  onPress,
  palette,
  disabled,
}: Readonly<{
  label: string;
  checked: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  disabled: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={styles.checkField}
    >
      <Text style={{ color: palette.primary, fontSize: 18 }}>
        {checked ? "☑" : "☐"}
      </Text>
      <Text style={[styles.help, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  loading,
  disabled,
  onPress,
  palette,
  primary = false,
}: Readonly<{
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  primary?: boolean;
}>) {
  const backgroundColor = primary ? palette.primary : palette.surfaceMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor,
          opacity: disabled || loading ? 0.65 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={primary ? palette.onPrimary : palette.primary}
        />
      ) : null}
      <Text
        style={{
          color: primary ? palette.onPrimary : palette.text,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LinkButton({
  label,
  onPress,
  disabled,
  palette,
}: Readonly<{
  label: string;
  onPress: () => void;
  disabled: boolean;
  palette: ReturnType<typeof useTheme>["palette"];
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.browserAction}
    >
      <Text style={{ color: palette.primary, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 560,
    padding: spacing.xl,
    width: "100%",
  },
  title: {
    fontSize: typography.pageTitle,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  challengeTitle: {
    alignSelf: "stretch",
    fontSize: typography.sectionTitle,
    fontWeight: "700",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  help: {
    alignSelf: "stretch",
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  error: {
    alignSelf: "stretch",
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: "center",
  },
  form: { alignSelf: "stretch", marginTop: spacing.lg },
  field: { alignSelf: "stretch", marginTop: spacing.md },
  label: { fontSize: 14, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: controlSizes.mobile,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  action: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: controlSizes.mobile,
    paddingHorizontal: spacing.lg,
  },
  providerAction: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: controlSizes.mobile,
    paddingHorizontal: spacing.lg,
  },
  providerCopy: { alignItems: "center" },
  providerMode: { fontSize: 12, marginTop: spacing.xs },
  providerLoading: { marginTop: spacing.md },
  browserActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  browserAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  checkField: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 44,
  },
  qr: { alignSelf: "center", height: 192, marginTop: spacing.md, width: 192 },
  recoveryCodes: {
    alignSelf: "stretch",
    borderRadius: radii.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  recoveryCode: {
    fontFamily: "monospace",
    fontSize: 15,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
});
