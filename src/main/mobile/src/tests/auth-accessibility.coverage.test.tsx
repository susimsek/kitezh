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
import SignInScreen from "../app/sign-in";
import RegisterScreen from "../app/register";
import ForgotPasswordScreen from "../app/forgot-password";
import ResetPasswordScreen from "../app/reset-password";
import VerifyEmailScreen from "../app/verify-email";

let mockAuthStatus = "signed-out";
let mockVerificationToken: string | undefined = "verify-token";
let mockLoginChallenge: {
  kind: "actions";
  transactionId: string;
  actions: { key: string; displayName: string; description: string; version: number }[];
} | null = null;
const mockSignIn = jest.fn();
const mockNativePasskeyLogin = jest.fn();
const mockSubmitLoginPasskeyRegistration = jest.fn();

jest.mock("@/api/public-api", () => ({
  ...jest.requireActual("@/api/public-api"),
  getCaptchaSettings: jest.fn(),
  getLoginCaptchaSettings: jest.fn(),
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
    discoveryStatus: "ready",
    error: null,
    loginChallenge: mockLoginChallenge,
    nativeLogin: jest.fn(),
    nativePasskeyLogin: mockNativePasskeyLogin,
    retryDiscovery: jest.fn(),
    signIn: mockSignIn,
    submitLoginPasskeyRegistration: mockSubmitLoginPasskeyRegistration,
    status: mockAuthStatus,
  }),
}));
jest.mock("@/auth/native-passkey", () => ({
  createNativePasskey: jest.fn(async () => ({ id: "credential-id" })),
  isNativePasskeySupported: jest.fn(() => true),
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
  mockLoginChallenge = null;
  mockVerificationToken = "verify-token";
  jest.mocked(publicApi.getCaptchaSettings).mockResolvedValue({ enabled: false });
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
  jest.mocked(publicApi.getMobileLoginPasskeyRegistrationOptions).mockResolvedValue({
    challenge: "challenge",
    rp: { id: "kitezh.onrender.com", name: "Kitezh" },
    user: { id: "user-id", name: "alice", displayName: "Alice" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
  } as never);
  jest.mocked(publicApi.verifyEmail).mockResolvedValue(undefined);
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
    expect(publicApi.getMobileLoginPasskeyRegistrationOptions).toHaveBeenCalledWith(
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
  jest.mocked(publicApi.requestPasswordReset).mockRejectedValue(
    new PublicApiError(0, "request unavailable", new Error("network")),
  );
  render(<ForgotPasswordScreen />);
  fireEvent.changeText(screen.getByLabelText("username"), "alice");
  fireEvent.press(screen.getByRole("button", { name: "continue" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("apiOffline");
});

it("shows email-verification failure and returns to sign-in", async () => {
  jest.mocked(publicApi.verifyEmail).mockRejectedValueOnce(new Error("expired"));
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
  const { MobileNoticeProvider, useMobileNotice } = await import(
    "@/components/MobileNoticeProvider"
  );
  const { Text } = await import("react-native");
  function NoticeTrigger() {
    const { showNotice } = useMobileNotice();
    return <Text onPress={() => showNotice({ kind: "info", message: "hello" })}>show</Text>;
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
  const { MobileNoticeProvider, useMobileNotice } = await import(
    "@/components/MobileNoticeProvider"
  );
  const { Text } = await import("react-native");
  function NoticeActions() {
    const { showNotice } = useMobileNotice();
    return (
      <>
        <Text onPress={() => showNotice({ kind: "info", message: "   " })}>blank</Text>
        <Text onPress={() => showNotice({ kind: "error", message: "first notice" })}>first</Text>
        <Text onPress={() => showNotice({ kind: "success", message: "second notice" })}>second</Text>
      </>
    );
  }

  render(<MobileNoticeProvider><NoticeActions /></MobileNoticeProvider>);
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
  const { MobileNoticeProvider, useMobileNotice } = await import(
    "@/components/MobileNoticeProvider"
  );
  const { Text } = await import("react-native");
  function SuccessNoticeTrigger() {
    const { showNotice } = useMobileNotice();
    return (
      <Text onPress={() => showNotice({ kind: "success", message: "Saved", durationMs: 1_000 })}>
        show success
      </Text>
    );
  }

  jest.useFakeTimers();
  try {
    render(<MobileNoticeProvider><SuccessNoticeTrigger /></MobileNoticeProvider>);
    act(() => screen.getByText("show success").props.onPress());
    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.queryByText("Saved")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
