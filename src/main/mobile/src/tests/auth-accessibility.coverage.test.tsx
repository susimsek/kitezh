import {
  act,
  render,
  screen,
  fireEvent,
} from "@/testing/native-testing-library";
import { StyleSheet } from "react-native";
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
const mockSignIn = jest.fn();

jest.mock("@/api/public-api", () => ({
  ...jest.requireActual("@/api/public-api"),
  getCaptchaSettings: jest.fn(),
  registerAccount: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
}));
jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => ({
    error: null,
    signIn: mockSignIn,
    status: mockAuthStatus,
  }),
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
  mockVerificationToken = "verify-token";
  jest.mocked(publicApi.getCaptchaSettings).mockResolvedValue({ enabled: false });
  jest.mocked(publicApi.verifyEmail).mockResolvedValue(undefined);
});

it.each([
  ["sign in", SignInScreen],
  ["registration", RegisterScreen],
  ["forgot password", ForgotPasswordScreen],
  ["reset password", ResetPasswordScreen],
  ["email verification", VerifyEmailScreen],
])("exposes a 44 point back target on the %s screen", async (_name, Screen) => {
  render(<Screen />);
  const back = await screen.findByRole("button", { name: "back" });
  const style = StyleSheet.flatten(back.props.style);
  expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
  expect(style.minWidth ?? style.width).toBeGreaterThanOrEqual(44);
});

it("announces sign-in progress and disables repeated authentication", () => {
  mockAuthStatus = "signing-in";
  render(<SignInScreen />);

  const submit = screen.getByRole("button", { name: "signIn" });
  expect(submit.props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true }),
  );
  expect(screen.getByLabelText("loading")).toBeTruthy();
});

it("opens the Account Console after an authorization callback signs in", () => {
  mockAuthStatus = "signed-in";
  render(<SignInScreen />);

  expect(router.replace).toHaveBeenCalledWith("/account");
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

it("keeps email-verification retry progress inline", async () => {
  let finishRetry!: () => void;
  jest
    .mocked(publicApi.verifyEmail)
    .mockRejectedValueOnce(new Error("expired"))
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishRetry = resolve;
      }),
    );
  render(<VerifyEmailScreen />);
  const retry = await screen.findByRole("button", { name: "sessionsRetry" });

  fireEvent.press(retry);
  expect(retry.props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true }),
  );
  expect(screen.getByLabelText("loading")).toBeTruthy();
  finishRetry();
  await screen.findByText("verifyEmailSuccess");
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
