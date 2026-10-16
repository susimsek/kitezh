import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as accountApi from "@/api/account-api";
import * as publicApi from "@/api/public-api";
import MfaScreen from "../app/mfa";
import RegisterScreen from "../app/register";
import ResetPasswordScreen from "../app/reset-password";
import SecurityScreen from "../app/security";
import SocialLinksScreen from "../app/social-links";
import ForgotPasswordScreen from "../app/forgot-password";
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

it("rejects short, mismatched, and reused passwords before calling the API", async () => {
  render(<SecurityScreen />);
  await screen.findByText("currentSession");
  fireEvent.change(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("newPassword"), {
    target: { value: "short" },
  });
  fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "different" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordMinLength")).toBeVisible();
  expect(screen.getByText("passwordMismatch")).toBeVisible();

  const reusedPassword = "same-long-secret";
  fireEvent.change(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: reusedPassword },
  });
  fireEvent.change(screen.getByPlaceholderText("newPassword"), {
    target: { value: reusedPassword },
  });
  fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: reusedPassword },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordDifferent")).toBeVisible();
  expect(accountApi.changeAccountPassword).not.toHaveBeenCalled();
});

it("reports session and account-removal failures and confirms revocation actions", async () => {
  jest.mocked(accountApi.listAccountSessions).mockResolvedValue({
    content: [
      {
        id: "current-session",
        createdAt: "not-a-date",
        lastAccessedAt: "2026-01-02T10:00:00Z",
        expiresAt: "2026-02-01T10:00:00Z",
        current: true,
        clients: [],
      },
      {
        id: "old-session",
        createdAt: "2026-01-01T10:00:00Z",
        lastAccessedAt: "2026-01-02T10:00:00Z",
        expiresAt: "2026-02-01T10:00:00Z",
        current: false,
        clients: [{ clientId: "browser", clientName: "Browser" }],
      },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 20,
  });
  jest
    .mocked(accountApi.signOutOtherAccountSessions)
    .mockRejectedValueOnce(new Error("offline"));
  jest
    .mocked(accountApi.signOutAccountSession)
    .mockRejectedValueOnce(new Error("offline"));
  jest
    .mocked(accountApi.deleteAccount)
    .mockRejectedValueOnce(new Error("offline"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SecurityScreen />);
  expect(await screen.findByText("Browser")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "signOutOthers" }));
  expect(await screen.findByText("signOutOthersError")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "signOutSession" }));
  const sessionActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    sessionActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("signOutSessionError")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "deleteAccount" }));
  const emptyDeleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    emptyDeleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeVisible();
  fireEvent.change(screen.getAllByPlaceholderText("currentPassword").at(-1)!, {
    target: { value: "confirm-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "deleteAccount" }));
  const deleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    deleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeVisible();
  expect(accountApi.deleteAccount).toHaveBeenCalledWith(
    "test-access-token",
    "confirm-password",
    expect.any(Object),
  );
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

it("retries an unavailable MFA status and reports when MFA cannot be enabled", async () => {
  jest
    .mocked(accountApi.getMfaStatus)
    .mockRejectedValueOnce(new Error("temporary network error"))
    .mockResolvedValueOnce({
      enabled: false,
      available: false,
      required: false,
      issuer: "Kitezh",
      algorithm: "SHA1",
      digits: 6,
      periodSeconds: 30,
    });

  render(<MfaScreen />);

  fireEvent.click(await screen.findByText("sessionsRetry"));
  expect(await screen.findByText("mfaUnavailable")).toBeVisible();
  expect(accountApi.getMfaStatus).toHaveBeenCalledTimes(2);
  expect(mockRefreshSession).toHaveBeenNthCalledWith(2, true);

  const options = jest.mocked(accountApi.getMfaStatus).mock.calls[1]?.[1];
  await expect(options?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
});

it("regenerates recovery codes and handles invalid and successful MFA disable codes", async () => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: true,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest
    .mocked(accountApi.getRecoveryCodesStatus)
    .mockResolvedValue({ remaining: 2 });
  jest.mocked(accountApi.generateRecoveryCodes).mockResolvedValue({
    codes: ["first-code", "second-code"],
    remaining: 2,
  });
  const invalidCode = new accountApi.AccountApiError();
  invalidCode.status = 400;
  jest.mocked(accountApi.mutateMfa).mockRejectedValueOnce(invalidCode);
  jest.mocked(accountApi.mutateMfa).mockResolvedValue(undefined);

  render(<MfaScreen />);
  expect(await screen.findByText("recoveryCodesRemaining: 2")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "recoveryCodesGenerate" }),
  );
  expect(await screen.findByText("first-code")).toBeVisible();
  expect(screen.getByText("second-code")).toBeVisible();

  fireEvent.change(screen.getByLabelText("mfaCode"), {
    target: { value: "123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "mfaDisable" }));
  expect(await screen.findAllByText("mfaCode")).toHaveLength(2);

  fireEvent.change(screen.getByLabelText("mfaCode"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "mfaDisable" }));
  await waitFor(() => expect(accountApi.mutateMfa).toHaveBeenCalledTimes(1));
  expect(await screen.findAllByText("mfaCode")).toHaveLength(2);

  fireEvent.change(screen.getByLabelText("mfaCode"), {
    target: { value: "654321" },
  });
  fireEvent.click(screen.getByRole("button", { name: "mfaDisable" }));
  await waitFor(() =>
    expect(accountApi.mutateMfa).toHaveBeenLastCalledWith(
      "test-access-token",
      "disable",
      "654321",
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

it("starts an enabled social-provider link flow and reloads its status", async () => {
  jest
    .mocked(accountApi.listSocialLinks)
    .mockResolvedValueOnce([
      {
        provider: "github",
        displayName: "GitHub",
        iconKey: "github",
        linked: false,
        configured: true,
        enabled: true,
      },
    ])
    .mockResolvedValueOnce([
      {
        provider: "github",
        displayName: "GitHub",
        iconKey: "github",
        linked: true,
        configured: true,
        enabled: true,
      },
    ]);

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialNotConnected")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://kitezh.onrender.com/account/social-links/github/start",
    ),
  );
  expect(await screen.findByText("socialConnected")).toBeVisible();
});

it("retries social-link loading and reports browser and unlink failures", async () => {
  jest
    .mocked(accountApi.listSocialLinks)
    .mockRejectedValueOnce(new Error("social links unavailable"))
    .mockResolvedValueOnce([
      {
        provider: "github",
        displayName: "GitHub",
        iconKey: "github",
        linked: false,
        configured: true,
        enabled: true,
      },
    ]);
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockRejectedValueOnce(new Error("browser unavailable"));

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialLinksError")).toBeVisible();
  fireEvent.click(screen.getByText("sessionsRetry"));
  expect(await screen.findByText("socialNotConnected")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "socialConnect" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "browserError",
    }),
  );

  jest.mocked(accountApi.listSocialLinks).mockResolvedValueOnce([
    {
      provider: "google",
      displayName: "Google",
      iconKey: "google",
      linked: true,
      configured: true,
      enabled: true,
    },
  ]);
  jest
    .mocked(accountApi.unlinkSocialProvider)
    .mockRejectedValueOnce(new Error("unlink rejected"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  }) as never);
  fireEvent.click(screen.getByRole("button", { name: "back" }));
  expect(jest.requireMock("expo-router").router.back).toHaveBeenCalled();
  // The link flow stays on this screen; refresh the mocked links before removal.
  fireEvent.click(screen.getByRole("button", { name: "socialConnect" }));
  await waitFor(() =>
    expect(accountApi.listSocialLinks).toHaveBeenCalledTimes(3),
  );
  fireEvent.click(screen.getByRole("button", { name: "socialRemove" }));
  const actions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    actions?.find((action) => action.style === "destructive")?.onPress?.();
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "socialRemoveError",
  });
});

it("shows server password validation errors in the matching fields", async () => {
  const validationError = Object.assign(new accountApi.AccountApiError(), {
    problem: {
      violations: [
        { field: "newPassword", message: "passwordPolicyRejected" },
        { field: "unknownField", message: "ignored" },
      ],
    },
  });
  jest
    .mocked(accountApi.changeAccountPassword)
    .mockRejectedValueOnce(validationError);

  render(<SecurityScreen />);
  await screen.findByText("sessionsEmpty");
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

  expect(await screen.findByText("passwordPolicyRejected")).toBeVisible();
  expect(screen.queryByText("passwordSaveError")).toBeNull();
});

it("maps legacy password validation data to the matching security fields", async () => {
  const validationError = Object.assign(new accountApi.AccountApiError(), {
    data: {
      violations: [
        { field: "currentPassword", message: "currentPasswordRejected" },
        { field: "confirmPassword", message: "confirmPasswordRejected" },
        null,
        { field: "newPassword", message: 12 },
      ],
    },
  });
  jest
    .mocked(accountApi.changeAccountPassword)
    .mockRejectedValueOnce(validationError);

  render(<SecurityScreen />);
  await screen.findByText("sessionsEmpty");
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

  expect(await screen.findByText("currentPasswordRejected")).toBeVisible();
  expect(screen.getByText("confirmPasswordRejected")).toBeVisible();
  expect(screen.queryByText("passwordSaveError")).toBeNull();
});

it("keeps security actions safe when the session expires before submission", async () => {
  jest.mocked(accountApi.listAccountSessions).mockResolvedValue({
    content: [
      {
        id: "other-session",
        createdAt: "2026-01-01T10:00:00Z",
        lastAccessedAt: "2026-01-02T10:00:00Z",
        expiresAt: "2026-02-01T10:00:00Z",
        current: false,
        clients: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SecurityScreen />);
  expect(
    await screen.findByRole("button", { name: "signOutSession" }),
  ).toBeVisible();
  const enterValidPassword = () => {
    fireEvent.change(screen.getAllByPlaceholderText("currentPassword")[0]!, {
      target: { value: "old-secret" },
    });
    fireEvent.change(screen.getByPlaceholderText("newPassword"), {
      target: { value: "a-long-new-secret" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
      target: { value: "a-long-new-secret" },
    });
  };
  enterValidPassword();
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordSaveError")).toBeVisible();

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "signOutOthers" }));
  expect(await screen.findByText("signOutOthersError")).toBeVisible();

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "signOutSession" }));
  const revokeActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    revokeActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("signOutSessionError")).toBeVisible();

  fireEvent.change(screen.getAllByPlaceholderText("currentPassword").at(-1)!, {
    target: { value: "confirm-password" },
  });
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "deleteAccount" }));
  const deleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    deleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeVisible();
  expect(accountApi.changeAccountPassword).not.toHaveBeenCalled();
  expect(accountApi.signOutOtherAccountSessions).not.toHaveBeenCalled();
  expect(accountApi.signOutAccountSession).not.toHaveBeenCalled();
  expect(accountApi.deleteAccount).not.toHaveBeenCalled();
});

it("retries a failed native session list and supplies a refresh callback", async () => {
  jest
    .mocked(accountApi.listAccountSessions)
    .mockRejectedValueOnce(new Error("session list unavailable"))
    .mockResolvedValueOnce({
      content: [
        {
          id: "current-session",
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

  render(<SecurityScreen />);
  fireEvent.click(await screen.findByText("sessionsRetry"));
  expect(await screen.findByText("currentSession")).toBeVisible();
  const options = jest.mocked(accountApi.listAccountSessions).mock
    .calls[1]?.[1];
  expect(options).toEqual(
    expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  );
  await expect(options?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
});

it("validates and completes native account registration", async () => {
  jest
    .mocked(publicApi.getCaptchaSettings)
    .mockResolvedValue({ enabled: false });
  jest.mocked(publicApi.registerAccount).mockRejectedValueOnce(
    Object.assign(new Error("validation failed"), {
      problem: {
        violations: [{ field: "email", message: "Invalid email address" }],
      },
    }),
  );
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
  expect(await screen.findByText("Invalid email address")).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText("email"), {
    target: { value: "alice@example.test" },
  });
  jest.mocked(publicApi.registerAccount).mockResolvedValueOnce(undefined);
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

it("falls back to browser registration when captcha settings are unavailable", async () => {
  jest
    .mocked(publicApi.getCaptchaSettings)
    .mockRejectedValueOnce(new Error("captcha settings unavailable"));
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockRejectedValueOnce(new Error("browser could not open"));

  render(<RegisterScreen />);

  const continueButton = await screen.findByRole("button", {
    name: "continueInBrowser",
  });
  fireEvent.click(continueButton);
  expect(await screen.findByText("browserError")).toBeVisible();

  fireEvent.click(continueButton);
  await waitFor(() =>
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(2),
  );
  expect(screen.queryByText("browserError")).not.toBeInTheDocument();
});

it("validates and completes a deep-link password reset", async () => {
  jest.mocked(publicApi.resetPassword).mockResolvedValue(undefined);
  const { router } = jest.requireMock("expo-router");

  render(<ResetPasswordScreen />);
  fireEvent.click(screen.getByRole("button", { name: "back" }));
  expect(router.back).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("resetError")).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.change(screen.getByPlaceholderText("mfaCode"), {
    target: { value: " 123456 " },
  });
  jest
    .mocked(publicApi.resetPassword)
    .mockRejectedValueOnce(new Error("reset token expired"));
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("resetError")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(publicApi.resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "a-long-reset-secret",
      otpCode: "123456",
    }),
  );
  expect(await screen.findByText("resetSuccess")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
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
