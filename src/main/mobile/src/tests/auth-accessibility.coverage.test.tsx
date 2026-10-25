import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@/testing/native-testing-library";
import { ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as publicApi from "@/api/public-api";
import { PublicApiError } from "@/api/public-api";
import * as nativeCaptcha from "@/auth/native-captcha";
import * as nativePasskey from "@/auth/native-passkey";
import SignInScreen from "../app/sign-in";
import RegisterScreen from "../app/register";
import ForgotPasswordScreen from "../app/forgot-password";
import ResetPasswordScreen from "../app/reset-password";
import VerifyEmailScreen from "../app/verify-email";

let mockAuthStatus = "signed-out";
let mockAuthError: string | null = null;
let mockDiscoveryStatus = "ready";
let mockVerificationToken: string | undefined = "verify-token";
let mockLoginChallenge:
  | { kind: "mfa"; transactionId: string }
  | {
      kind: "consent";
      transactionId: string;
      clientName: string;
      scopes: { name: string; displayName: string; description: string }[];
    }
  | {
      kind: "actions";
      transactionId: string;
      actions: {
        key: string;
        displayName: string;
        description: string;
        version: number;
      }[];
    }
  | null = null;
const mockNativeLogin = jest.fn();
const mockSignIn = jest.fn();
const mockRetryDiscovery = jest.fn();
const mockNativePasskeyLogin = jest.fn();
const mockSubmitLoginMfa = jest.fn();
const mockSubmitLoginConsent = jest.fn();
const mockSubmitLoginAction = jest.fn();
const mockSubmitLoginPasskeyRegistration = jest.fn();
const mockCancelNativeLogin = jest.fn();

jest.mock("@/api/public-api", () => ({
  ...jest.requireActual("@/api/public-api"),
  getCaptchaSettings: jest.fn(),
  getSocialProviders: jest.fn(),
  getLoginCaptchaSettings: jest.fn(),
  getMobileLoginMfaSetup: jest.fn(),
  getMobileLoginRecoveryCodes: jest.fn(),
  registerAccount: jest.fn(),
  getMobileLoginPasskeyRegistrationOptions: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
}));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({
      type: "success",
      data: { idToken: "google-id-token" },
    })),
  },
  isSuccessResponse: (response: { type?: string }) =>
    response.type === "success",
}));
jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => ({
    discoveryStatus: mockDiscoveryStatus,
    error: mockAuthError,
    loginChallenge: mockLoginChallenge,
    nativeLogin: mockNativeLogin,
    nativePasskeyLogin: mockNativePasskeyLogin,
    retryDiscovery: mockRetryDiscovery,
    signIn: mockSignIn,
    submitLoginMfa: mockSubmitLoginMfa,
    submitLoginConsent: mockSubmitLoginConsent,
    submitLoginAction: mockSubmitLoginAction,
    submitLoginPasskeyRegistration: mockSubmitLoginPasskeyRegistration,
    cancelNativeLogin: mockCancelNativeLogin,
    status: mockAuthStatus,
  }),
}));
jest.mock("@/auth/native-passkey", () => ({
  createNativePasskey: jest.fn(async () => ({ id: "credential-id" })),
  isNativePasskeySupported: jest.fn(() => true),
}));
jest.mock("@/auth/native-captcha", () => ({
  createNativeCaptchaToken: jest.fn(async () => "native-captcha-token"),
}));
jest.mock("@/auth/native-social-login", () => ({
  isNativeSocialProviderConfigured: jest.fn(() => true),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({
    dictionary: new Proxy({}, { get: (_target, key) => String(key) }),
    resolvedLocale: "en",
  }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({
    palette: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/BrandMark", () => ({ BrandMark: () => null }));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ token: mockVerificationToken }),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthStatus = "signed-out";
  mockAuthError = null;
  mockDiscoveryStatus = "ready";
  mockLoginChallenge = null;
  mockNativeLogin.mockReset();
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
  mockRetryDiscovery.mockReset();
  mockNativePasskeyLogin.mockReset();
  mockSubmitLoginMfa.mockReset();
  mockSubmitLoginConsent.mockReset();
  mockSubmitLoginAction.mockReset();
  mockSubmitLoginPasskeyRegistration.mockReset();
  mockCancelNativeLogin.mockReset();
  jest.mocked(nativePasskey.isNativePasskeySupported).mockReturnValue(true);
  jest.mocked(nativePasskey.createNativePasskey).mockResolvedValue({
    id: "credential-id",
  } as never);
  jest.mocked(publicApi.getSocialProviders).mockResolvedValue([]);
  mockVerificationToken = "verify-token";
  jest
    .mocked(publicApi.getCaptchaSettings)
    .mockResolvedValue({ enabled: false });
  jest.mocked(publicApi.getLoginCaptchaSettings).mockResolvedValue({
    enabled: false,
    nativeRequired: false,
    nativeEnabled: false,
    provider: "",
    siteKey: "",
    action: "",
    recaptchaV3: false,
    useRecaptchaNet: false,
    androidSiteKey: "",
    iosSiteKey: "",
  });
  jest
    .mocked(publicApi.getMobileLoginPasskeyRegistrationOptions)
    .mockResolvedValue({
      challenge: "challenge",
      rp: { id: "kitezh.onrender.com", name: "Kitezh" },
      user: { id: "user-id", name: "alice", displayName: "Alice" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    } as never);
  jest.mocked(publicApi.verifyEmail).mockResolvedValue(undefined);
});

it("validates both credential fields and submits trimmed native credentials", async () => {
  render(<SignInScreen />);
  const username = await screen.findByLabelText("username");
  const submit = screen.getByRole("button", { name: "signIn" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );

  fireEvent.press(submit);
  expect(await screen.findByText("loginUsernameRequired")).toBeTruthy();
  fireEvent.changeText(username, " alice ");
  fireEvent.press(submit);
  expect(await screen.findByText("loginPasswordRequired")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("loginPassword"), "secret");
  fireEvent.press(submit);

  await waitFor(() =>
    expect(mockNativeLogin).toHaveBeenCalledWith("alice", "secret", null),
  );
  expect(screen.getByLabelText("loginPassword").props.value).toBe("");
});

it("renders provider login modes and starts the selected provider flow", async () => {
  jest.mocked(publicApi.getSocialProviders).mockResolvedValue([
    {
      provider: "google",
      providerType: "oauth",
      iconKey: "google",
      configured: true,
    },
    {
      provider: "github",
      providerType: "oauth",
      iconKey: "github",
      configured: true,
    },
    {
      provider: "microsoft",
      providerType: "oauth",
      iconKey: "microsoft",
      configured: false,
    },
  ]);
  render(<SignInScreen />);

  const google = await screen.findByRole("button", {
    name: "signIn google. socialLoginNative",
  });
  expect(screen.getByText("socialLoginBrowser")).toBeTruthy();
  expect(screen.queryByText("signIn · microsoft")).toBeNull();
  fireEvent.press(google);
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith("google"));
});

it("explains discovery failures and retries discovery", async () => {
  mockDiscoveryStatus = "timeout";
  render(<SignInScreen />);

  expect(await screen.findByText("authDiscoveryTimeout")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "retry" }));
  expect(mockRetryDiscovery).toHaveBeenCalledTimes(1);
  mockDiscoveryStatus = "unavailable";
  render(<SignInScreen />);
  expect(await screen.findByText("authDiscoveryUnavailable")).toBeTruthy();
});

it.each([
  ["authorization-timeout", "authTimeout"],
  ["authorization-cancelled", "authCancelled"],
  ["consent-denied", "loginConsentDenied"],
  ["google-account-link-required", "googleAccountLinkRequired"],
  ["login-credentials-invalid", "loginCredentialsInvalid"],
  ["passkey-authentication-failed", "passkeyLoginError"],
  ["unexpected-error", "authError"],
])("maps the %s login error to its public message", async (error, message) => {
  mockAuthError = error;
  render(<SignInScreen />);
  expect(await screen.findByText(message)).toBeTruthy();
});

it("submits a native MFA code after removing non-digits", async () => {
  mockLoginChallenge = { kind: "mfa", transactionId: "login-tx" };
  render(<SignInScreen />);
  const code = await screen.findByLabelText("mfaCode");
  fireEvent.changeText(code, "12a3456789");
  expect(code.props.value).toBe("12345678");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginMfa).toHaveBeenCalledWith("12345678");
});

it("shows native consent scopes and submits approve or deny decisions", async () => {
  mockLoginChallenge = {
    kind: "consent",
    transactionId: "login-tx",
    clientName: "Kitezh Account",
    scopes: [
      { name: "profile", displayName: "Profile", description: "Read profile" },
    ],
  };
  const { unmount } = render(<SignInScreen />);
  expect(await screen.findByText("loginConsentHelp")).toBeTruthy();
  expect(screen.getByText("Profile")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "loginConsentApprove" }));
  expect(mockSubmitLoginConsent).toHaveBeenCalledWith(true);
  unmount();
  render(<SignInScreen />);
  fireEvent.press(screen.getByRole("button", { name: "loginConsentDeny" }));
  expect(mockSubmitLoginConsent).toHaveBeenCalledWith(false);
});

it("cancels a required email action and reports required-action errors", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "UPDATE_EMAIL",
        displayName: "Verify email",
        description: "Confirm address",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  expect(await screen.findByText("requiredActionEmailHelp")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "requiredActionEmailRestart" }),
  );
  expect(mockCancelNativeLogin).toHaveBeenCalledTimes(1);
});

it("validates and submits a required profile update with normalized fields", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "UPDATE_PROFILE",
        displayName: "Profile",
        description: "Update profile",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);

  fireEvent.press(await screen.findByRole("button", { name: "continue" }));
  expect(await screen.findByText("requiredField")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("firstName"), " Ada ");
  fireEvent.changeText(screen.getByLabelText("lastName"), " Lovelace ");
  fireEvent.changeText(screen.getByLabelText("email"), " ada@example.test ");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));

  expect(mockSubmitLoginAction).toHaveBeenCalledWith({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
  });
});

it("enforces the required password length before submitting an update", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "UPDATE_PASSWORD",
        displayName: "Password",
        description: "Change password",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  const password = await screen.findByLabelText("newPassword");
  fireEvent.changeText(password, "short");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("passwordMinimumLength")).toBeTruthy();
  fireEvent.changeText(password, "long-enough-password");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginAction).toHaveBeenCalledWith({
    newPassword: "long-enough-password",
  });
});

it("requires acceptance before completing terms and conditions", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "TERMS_AND_CONDITIONS",
        displayName: "Terms",
        description: "Review terms",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "continue" }));
  expect(await screen.findByText("requiredActionAcceptRequired")).toBeTruthy();
  const accepted = screen.getByRole("checkbox", {
    name: "requiredActionAcceptTerms",
  });
  fireEvent.press(accepted);
  expect(accepted.props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginAction).toHaveBeenCalledWith({ accepted: true });
});

it("requires explicit confirmation before submitting account deletion", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "DELETE_ACCOUNT",
        displayName: "Delete account",
        description: "Confirm deletion",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "continue" }));
  expect(await screen.findByText("requiredActionConfirmRequired")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("checkbox", { name: "requiredActionConfirm" }),
  );
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginAction).toHaveBeenCalledWith({ confirmed: true });
});

it("sets up TOTP and validates the one-time required-action code", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "CONFIGURE_TOTP",
        displayName: "Set up MFA",
        description: "Add an authenticator",
        version: 1,
      },
    ],
  };
  jest.mocked(publicApi.getMobileLoginMfaSetup).mockResolvedValue({
    secret: "secret",
    qrCode: "data:image/png;base64,c2VjcmV0",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  render(<SignInScreen />);
  expect(await screen.findByText("mfaSecret: secret")).toBeTruthy();
  const code = screen.getByLabelText("mfaCode");
  fireEvent.changeText(code, "abc");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("mfaInvalidCode")).toBeTruthy();
  fireEvent.changeText(code, "123456");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginAction).toHaveBeenCalledWith({ code: "123456" });
});

it("shows required-action setup errors and unavailable actions", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "RECOVERY_CODES",
        displayName: "Recovery",
        description: "Save recovery codes",
        version: 1,
      },
    ],
  };
  jest
    .mocked(publicApi.getMobileLoginRecoveryCodes)
    .mockRejectedValueOnce(new Error("setup unavailable"));
  const { unmount } = render(<SignInScreen />);
  expect(await screen.findByText("requiredActionSetupError")).toBeTruthy();
  unmount();
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "UNKNOWN_ACTION",
        displayName: "Unknown",
        description: "Unsupported",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  expect(
    await screen.findByText("requiredActionNativeUnavailable"),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "continue" }).props.accessibilityState
      .disabled,
  ).toBe(true);
});

it("reports native passkey enrollment failures without completing the action", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "CONFIGURE_PASSKEY",
        displayName: "Passkey",
        description: "Register a passkey",
        version: 1,
      },
    ],
  };
  jest
    .mocked(nativePasskey.createNativePasskey)
    .mockRejectedValueOnce(new Error("authenticator unavailable"));
  render(<SignInScreen />);
  const submit = await screen.findByRole("button", {
    name: "requiredActionPasskey",
  });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(submit);
  expect(await screen.findByText("passkeyActionError")).toBeTruthy();
  expect(mockSubmitLoginPasskeyRegistration).not.toHaveBeenCalled();
});

it("sends native CAPTCHA proof only when the configured provider is supported", async () => {
  jest.mocked(publicApi.getLoginCaptchaSettings).mockResolvedValue({
    enabled: true,
    nativeRequired: true,
    nativeEnabled: true,
    provider: "enterprise",
    siteKey: "site-key",
    action: "login",
    recaptchaV3: true,
    useRecaptchaNet: false,
    androidSiteKey: "android-key",
    iosSiteKey: "ios-key",
  });
  render(<SignInScreen />);
  fireEvent.changeText(await screen.findByLabelText("username"), "alice");
  fireEvent.changeText(screen.getByLabelText("loginPassword"), "secret");
  const submit = screen.getByRole("button", { name: "signIn" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(submit);

  await waitFor(() =>
    expect(nativeCaptcha.createNativeCaptchaToken).toHaveBeenCalledWith(
      expect.stringMatching(/-key$/),
      "login",
    ),
  );
  expect(mockNativeLogin).toHaveBeenCalledWith(
    "alice",
    "secret",
    "native-captcha-token",
  );
});

it("fails closed when CAPTCHA configuration is unavailable or unsupported", async () => {
  jest
    .mocked(publicApi.getLoginCaptchaSettings)
    .mockRejectedValueOnce(new Error("configuration unavailable"));
  const { unmount } = render(<SignInScreen />);
  expect(
    await screen.findByText("loginCaptchaSettingsUnavailable"),
  ).toBeTruthy();
  unmount();

  jest.mocked(publicApi.getLoginCaptchaSettings).mockResolvedValueOnce({
    enabled: true,
    nativeRequired: true,
    nativeEnabled: true,
    provider: "recaptcha",
    siteKey: "site-key",
    action: "login",
    recaptchaV3: true,
    useRecaptchaNet: false,
    androidSiteKey: "android-key",
    iosSiteKey: "ios-key",
  });
  render(<SignInScreen />);
  expect(await screen.findByText("loginCaptchaNativeUnavailable")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "signIn" }).props.accessibilityState
      .disabled,
  ).toBe(true);
});

it("reports a missing native CAPTCHA action after server settings pass capability checks", async () => {
  jest.mocked(publicApi.getLoginCaptchaSettings).mockResolvedValueOnce({
    enabled: true,
    nativeRequired: true,
    nativeEnabled: true,
    provider: "enterprise",
    siteKey: "site-key",
    action: "",
    recaptchaV3: true,
    useRecaptchaNet: false,
    androidSiteKey: "android-key",
    iosSiteKey: "ios-key",
  });
  render(<SignInScreen />);
  fireEvent.changeText(await screen.findByLabelText("username"), "alice");
  fireEvent.changeText(screen.getByLabelText("loginPassword"), "secret");
  const submit = screen.getByRole("button", { name: "signIn" });
  await waitFor(() =>
    expect(submit.props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(submit);
  expect(await screen.findByText("loginCaptchaNativeUnavailable")).toBeTruthy();
  expect(nativeCaptcha.createNativeCaptchaToken).not.toHaveBeenCalled();
});

it("renders completed recovery codes and requires confirmation before continuing", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "RECOVERY_CODES",
        displayName: "Recovery codes",
        description: "Save your codes",
        version: 1,
      },
    ],
  };
  jest.mocked(publicApi.getMobileLoginRecoveryCodes).mockResolvedValueOnce({
    codes: ["ABCD-EFGH", "IJKL-MNOP"],
    remaining: 2,
  });
  render(<SignInScreen />);

  expect(await screen.findByText("ABCD-EFGH")).toBeTruthy();
  expect(screen.getByText("IJKL-MNOP")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("requiredActionAcceptRequired")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("checkbox", { name: "requiredActionAccept" }),
  );
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(mockSubmitLoginAction).toHaveBeenCalledWith({ accepted: true });
});

it("hides passkey choices and explains unsupported passkey required actions", async () => {
  jest.mocked(nativePasskey.isNativePasskeySupported).mockReturnValue(false);
  const { unmount } = render(<SignInScreen />);
  expect(await screen.findByLabelText("username")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "passkeySignIn" })).toBeNull();
  unmount();

  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-tx",
    actions: [
      {
        key: "CONFIGURE_PASSKEY_PASSWORDLESS",
        displayName: "Passkey",
        description: "Register a device key",
        version: 1,
      },
    ],
  };
  render(<SignInScreen />);
  expect(
    await screen.findByText("requiredActionNativeUnavailable"),
  ).toBeTruthy();
});

it.each([
  ["registration", RegisterScreen],
  ["forgot password", ForgotPasswordScreen],
  ["reset password", ResetPasswordScreen],
  ["email verification", VerifyEmailScreen],
])("exposes a 44 point back target on the %s screen", async (_name, Screen) => {
  render(<Screen />);
  const back = await screen.findByRole("button", { name: "back" });
  const style = StyleSheet.flatten(back.props.style);
  expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
});

it("announces sign-in progress and disables repeated authentication", () => {
  mockAuthStatus = "signing-in";
  render(<SignInScreen />);

  const submit = screen.getByRole("button", { name: "signIn" });
  expect(submit.props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true }),
  );
  expect(submit.findByType(ActivityIndicator)).toBeTruthy();
});

it("opens the Account Console after an authorization callback signs in", () => {
  mockAuthStatus = "signed-in";
  render(<SignInScreen />);

  expect(router.replace).toHaveBeenCalledWith("/account");
});

it("starts native passkey login for the entered account", async () => {
  render(<SignInScreen />);
  fireEvent.changeText(await screen.findByLabelText("username"), "alice");
  const passkey = screen.getByRole("button", { name: "passkeySignIn" });
  fireEvent.press(passkey);

  expect(mockNativePasskeyLogin).toHaveBeenCalledWith("alice");
  expect(passkey.props.accessibilityState.disabled).toBe(false);
});

it("registers a native passkey for the transaction-bound required action", async () => {
  mockLoginChallenge = {
    kind: "actions",
    transactionId: "login-transaction",
    actions: [
      {
        key: "CONFIGURE_PASSKEY",
        displayName: "Register passkey",
        description: "Register a passkey",
        version: 1,
      },
    ],
  };

  render(<SignInScreen />);
  const register = await screen.findByRole("button", {
    name: "requiredActionPasskey",
  });
  await waitFor(() =>
    expect(
      publicApi.getMobileLoginPasskeyRegistrationOptions,
    ).toHaveBeenCalledWith(
      "login-transaction",
      "CONFIGURE_PASSKEY",
      expect.any(Object),
    ),
  );
  fireEvent.changeText(screen.getByLabelText("passkeyLabel"), "My phone");
  fireEvent.press(register);

  await waitFor(() =>
    expect(mockSubmitLoginPasskeyRegistration).toHaveBeenCalledWith(
      "CONFIGURE_PASSKEY",
      { id: "credential-id" },
      "My phone",
    ),
  );
});

it("announces password-reset request progress and rejects duplicate taps", async () => {
  let finishRequest!: () => void;
  jest.mocked(publicApi.requestPasswordReset).mockReturnValue(
    new Promise<void>((resolve) => {
      finishRequest = resolve;
    }),
  );
  render(<ForgotPasswordScreen />);
  fireEvent.changeText(screen.getByLabelText("username"), "alice");
  const submit = screen.getByRole("button", { name: "continue" });

  fireEvent.press(submit);
  expect(submit.props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true }),
  );
  expect(screen.getByLabelText("loading")).toBeTruthy();
  fireEvent.press(submit);
  expect(publicApi.requestPasswordReset).toHaveBeenCalledTimes(1);

  finishRequest();
  await screen.findByText("forgotSent");
});

it("shows a localized offline message when a public account request fails", async () => {
  jest
    .mocked(publicApi.requestPasswordReset)
    .mockRejectedValue(
      new PublicApiError(0, "request unavailable", new Error("network")),
    );
  render(<ForgotPasswordScreen />);
  fireEvent.changeText(screen.getByLabelText("username"), "alice");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("apiOffline");
});

it("shows email-verification failure and returns to sign-in", async () => {
  jest
    .mocked(publicApi.verifyEmail)
    .mockRejectedValueOnce(new Error("expired"));
  render(<VerifyEmailScreen />);
  expect(await screen.findByText("verifyEmailError")).toBeTruthy();
  expect(publicApi.verifyEmail).toHaveBeenCalledWith("verify-token");
  fireEvent.press(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
});

it("requires a verification token and does not send an empty value", async () => {
  mockVerificationToken = "  ";
  render(<VerifyEmailScreen />);

  expect(await screen.findByText("verifyEmailError")).toBeTruthy();
  expect(publicApi.verifyEmail).not.toHaveBeenCalled();
});

it("normalizes the verification token and returns to sign-in after success", async () => {
  mockVerificationToken = "  token-with-space  ";
  render(<VerifyEmailScreen />);

  expect(await screen.findByText("verifyEmailSuccess")).toBeTruthy();
  expect(publicApi.verifyEmail).toHaveBeenCalledWith("token-with-space");
  fireEvent.press(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
});

it("keeps the notice dismiss target at the native minimum", async () => {
  const { MobileNoticeProvider, useMobileNotice } =
    await import("@/components/MobileNoticeProvider");
  const { Text } = await import("react-native");
  function NoticeTrigger() {
    const { showNotice } = useMobileNotice();
    return (
      <Text onPress={() => showNotice({ kind: "info", message: "hello" })}>
        show
      </Text>
    );
  }

  render(
    <MobileNoticeProvider>
      <NoticeTrigger />
    </MobileNoticeProvider>,
  );
  act(() => screen.getByText("show").props.onPress());
  expect(screen.getByText("hello")).toBeTruthy();
  const close = screen.getByRole("button", { name: "close" });
  const style = StyleSheet.flatten(close.props.style);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  expect(style.minWidth).toBeGreaterThanOrEqual(44);
});

it("ignores blank notices, replaces active notices, and dismisses explicitly", async () => {
  const { MobileNoticeProvider, useMobileNotice } =
    await import("@/components/MobileNoticeProvider");
  const { Text } = await import("react-native");
  function NoticeActions() {
    const { showNotice } = useMobileNotice();
    return (
      <>
        <Text onPress={() => showNotice({ kind: "info", message: "   " })}>
          blank
        </Text>
        <Text
          onPress={() => showNotice({ kind: "error", message: "first notice" })}
        >
          first
        </Text>
        <Text
          onPress={() =>
            showNotice({ kind: "success", message: "second notice" })
          }
        >
          second
        </Text>
      </>
    );
  }

  render(
    <MobileNoticeProvider>
      <NoticeActions />
    </MobileNoticeProvider>,
  );
  act(() => screen.getByText("blank").props.onPress());
  expect(screen.queryByRole("alert")).toBeNull();
  act(() => screen.getByText("first").props.onPress());
  expect(screen.getByText("first notice")).toBeTruthy();
  act(() => screen.getByText("second").props.onPress());
  expect(screen.queryByText("first notice")).toBeNull();
  expect(screen.getByText("second notice")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "close" }));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("automatically dismisses a success notice after its requested duration", async () => {
  const { MobileNoticeProvider, useMobileNotice } =
    await import("@/components/MobileNoticeProvider");
  const { Text } = await import("react-native");
  function SuccessNoticeTrigger() {
    const { showNotice } = useMobileNotice();
    return (
      <Text
        onPress={() =>
          showNotice({ kind: "success", message: "Saved", durationMs: 1_000 })
        }
      >
        show success
      </Text>
    );
  }

  jest.useFakeTimers();
  try {
    render(
      <MobileNoticeProvider>
        <SuccessNoticeTrigger />
      </MobileNoticeProvider>,
    );
    act(() => screen.getByText("show success").props.onPress());
    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.queryByText("Saved")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
