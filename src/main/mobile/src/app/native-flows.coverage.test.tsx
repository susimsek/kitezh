import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Alert } from "react-native";
import * as accountApi from "@/api/account-api";
import * as publicApi from "@/api/public-api";
import MfaScreen from "./mfa";
import RegisterScreen from "./register";
import ResetPasswordScreen from "./reset-password";
import SecurityScreen from "./security";
import SocialLinksScreen from "./social-links";
import ForgotPasswordScreen from "./forgot-password";
import {
  AccountAuthCallbackScreen,
  AdminAuthCallbackScreen,
} from "@/components/AuthCallbackScreen";

let mockMobileAuthStatus = "signed-in";

jest.mock("@/api/account-api", () => ({
  AccountApiError: class AccountApiError extends Error {
    status = 0;
    data: unknown;
    problem: undefined;
  },
  changeAccountPassword: jest.fn(),
  deleteAccount: jest.fn(),
  generateRecoveryCodes: jest.fn(),
  getMfaStatus: jest.fn(),
  getRecoveryCodesStatus: jest.fn(),
  listAccountSessions: jest.fn(),
  listSocialLinks: jest.fn(),
  mutateMfa: jest.fn(),
  signOutAccountSession: jest.fn(),
  signOutOtherAccountSessions: jest.fn(),
  startMfaSetup: jest.fn(),
  unlinkSocialProvider: jest.fn(),
}));
jest.mock("@/api/public-api", () => ({
  getCaptchaSettings: jest.fn(),
  registerAccount: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock("@/auth/MobileAuthProvider", () => {
  const session = { accessToken: "test-access-token" };
  const mockSignOut = jest.fn();
  const mockRefreshSession = jest.fn(async () => session);
  return {
    MobileAuthProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    mockSignOut,
    mockRefreshSession,
    useMobileAuth: jest.fn(() => ({
      session,
      signIn: jest.fn(),
      signOut: mockSignOut,
      status: mockMobileAuthStatus,
      refreshSession: mockRefreshSession,
    })),
  };
});
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
jest.mock("@/theme/tokens", () => ({
  radii: { sm: 4, md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
}));
jest.mock("@/components/MobileNoticeProvider", () => {
  const mockShowNotice = jest.fn();
  return {
    mockShowNotice,
    useMobileNotice: () => ({ showNotice: mockShowNotice }),
  };
});
jest.mock("@/components/AccountTabBar", () => ({ AccountTabBar: () => null }));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/BrandMark", () => ({ BrandMark: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ token: "reset-token" }),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

const { mockRefreshSession, mockSignOut } = jest.requireMock(
  "@/auth/MobileAuthProvider",
);
const { mockShowNotice } = jest.requireMock(
  "@/components/MobileNoticeProvider",
);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockRefreshSession.mockResolvedValue({ accessToken: "test-access-token" });
  mockMobileAuthStatus = "signed-in";
});

afterEach(() => jest.useRealTimers());

it("validates, updates, and confirms active-account session security actions", async () => {
  jest.mocked(accountApi.listAccountSessions).mockResolvedValue({
    content: [
      {
        id: "session-1",
        createdAt: "2026-01-01T10:00:00Z",
        lastAccessedAt: "2026-01-02T10:00:00Z",
        expiresAt: "2026-02-01T10:00:00Z",
        current: true,
        clients: [{ clientId: "account", clientName: "Account" }],
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
  });
  jest.mocked(accountApi.changeAccountPassword).mockResolvedValue(undefined);

  render(<SecurityScreen />);
  expect(await screen.findByText("currentSession")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findAllByText("passwordRequired")).toHaveLength(3);

  fireEvent.change(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(accountApi.changeAccountPassword).toHaveBeenCalledWith(
      "test-access-token",
      { currentPassword: "old-secret", newPassword: "a-long-new-secret" },
      expect.any(Object),
    ),
  );
  expect(await screen.findByText("passwordSaved")).toBeVisible();
});

it("sets up mobile MFA and validates the one-time code before enabling", async () => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: false,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest.mocked(accountApi.startMfaSetup).mockResolvedValue({
    secret: "test-secret",
    qrCode: "data:image/png;base64,test",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest.mocked(accountApi.mutateMfa).mockResolvedValue(undefined);

  render(<MfaScreen />);
  fireEvent.click(await screen.findByRole("button", { name: "mfaSetup" }));
  expect(await screen.findByText("mfaSecret: test-secret")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "mfaEnable" }));
  fireEvent.change(screen.getByLabelText("mfaCode"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "mfaEnable" }));
  await waitFor(() =>
    expect(accountApi.mutateMfa).toHaveBeenCalledWith(
      "test-access-token",
      "enable",
      "123456",
      expect.any(Object),
    ),
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it("confirms linked social-provider removal and refreshes native link status", async () => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "google",
      displayName: "Google",
      iconKey: "google",
      linked: true,
      configured: true,
      enabled: true,
    },
  ]);
  jest.mocked(accountApi.unlinkSocialProvider).mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialConnected")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "socialRemove" }));
  const actions = alert.mock.calls[0]?.[2];
  const confirm = actions?.find((action) => action.style === "destructive");
  await act(async () => confirm?.onPress?.());
  await waitFor(() =>
    expect(accountApi.unlinkSocialProvider).toHaveBeenCalledWith(
      "test-access-token",
      "google",
      expect.any(Object),
    ),
  );
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "socialRemoveSuccess",
  });
  expect(await screen.findByText("socialNotConnected")).toBeVisible();
});

it("validates and completes native account registration", async () => {
  jest
    .mocked(publicApi.getCaptchaSettings)
    .mockResolvedValue({ enabled: false });
  jest.mocked(publicApi.registerAccount).mockResolvedValue(undefined);

  render(<RegisterScreen />);
  const create = await screen.findByRole("button", { name: "createAccount" });
  fireEvent.click(create);
  expect(await screen.findByText("registrationError")).toBeVisible();
  for (const [label, value] of [
    ["username", "alice"],
    ["firstName", "Alice"],
    ["lastName", "Example"],
    ["email", "alice@example.test"],
    ["newPassword", "a-long-password"],
    ["confirmPassword", "a-long-password"],
  ]) {
    fireEvent.change(screen.getByPlaceholderText(label), {
      target: { value },
    });
  }
  fireEvent.click(create);
  await waitFor(() =>
    expect(publicApi.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "alice",
        email: "alice@example.test",
        locale: "en",
      }),
    ),
  );
  expect(await screen.findByText("registrationSuccess")).toBeVisible();
});

it("validates and completes a deep-link password reset", async () => {
  jest.mocked(publicApi.resetPassword).mockResolvedValue(undefined);

  render(<ResetPasswordScreen />);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("resetError")).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(publicApi.resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "a-long-reset-secret",
      otpCode: undefined,
    }),
  );
  expect(await screen.findByText("resetSuccess")).toBeVisible();
});

it("validates password-reset requests, reports failures, and navigates after success", async () => {
  const publicApi =
    jest.requireMock<typeof import("@/api/public-api")>("@/api/public-api");
  const { router } = jest.requireMock("expo-router");
  render(<ForgotPasswordScreen />);

  fireEvent.click(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotError")).toBeVisible();

  fireEvent.change(screen.getByLabelText("username"), {
    target: { value: " alice " },
  });
  jest
    .mocked(publicApi.requestPasswordReset)
    .mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotError")).toBeVisible();

  jest.mocked(publicApi.requestPasswordReset).mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotSent")).toBeVisible();
  expect(publicApi.requestPasswordReset).toHaveBeenLastCalledWith(
    "alice",
    "en",
  );
  fireEvent.click(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
  fireEvent.click(screen.getByRole("button", { name: "back" }));
  expect(router.back).toHaveBeenCalled();
});

it("routes account and admin auth callbacks by state and times out signed-out sessions", async () => {
  jest.useFakeTimers();
  const { router } = jest.requireMock("expo-router");
  const { rerender } = render(<AccountAuthCallbackScreen />);
  expect(screen.getByLabelText("loading")).toBeVisible();
  expect(router.replace).toHaveBeenCalledWith("/account");

  mockMobileAuthStatus = "error";
  rerender(<AccountAuthCallbackScreen />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in"));

  mockMobileAuthStatus = "signed-out";
  rerender(<AccountAuthCallbackScreen />);
  act(() => {
    jest.advanceTimersByTime(15_000);
  });
  expect(router.replace).toHaveBeenCalledWith("/sign-in");

  mockMobileAuthStatus = "signed-in";
  render(<AdminAuthCallbackScreen />);
  expect(router.replace).toHaveBeenCalledWith("/admin");
});
