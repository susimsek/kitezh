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
  useLocalSearchParams: () => ({ token: "verify-token" }),
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
