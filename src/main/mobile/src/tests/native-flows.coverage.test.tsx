import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { Alert, StyleSheet } from "react-native";
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
let mockSocialAuthRequestConfig: {
  codeChallenge: string | null;
  state: string | null;
} = {
  codeChallenge: "c".repeat(43),
  state: "s".repeat(32),
};
let mockSocialAuthCodeVerifier: string | null = "v".repeat(43);
let mockMobileDiscoveryStatus = "ready";

jest.mock("@/api/account-api", () => ({
  AccountApiError: class AccountApiError extends Error {
    status = 0;
    kind = "offline";
    data = undefined;
    problem = undefined;
  },
  changeAccountPassword: jest.fn(),
  createPersonalAccessToken: jest.fn(),
  deleteAccount: jest.fn(),
  generateRecoveryCodes: jest.fn(),
  getMfaStatus: jest.fn(),
  getRecoveryCodesStatus: jest.fn(),
  listAccountSessions: jest.fn(),
  listPersonalAccessTokens: jest.fn(),
  listSocialLinks: jest.fn(),
  startNativeSocialLink: jest.fn(),
  completeNativeSocialLink: jest.fn(),
  mutateMfa: jest.fn(),
  signOutAccountSession: jest.fn(),
  revokePersonalAccessToken: jest.fn(),
  signOutOtherAccountSessions: jest.fn(),
  startMfaSetup: jest.fn(),
  unlinkSocialProvider: jest.fn(),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@/auth/storage", () => ({
  clearOAuthTransaction: jest.fn(),
  consumeOAuthTransaction: jest.fn(),
  saveOAuthTransaction: jest.fn(),
}));
jest.mock("expo-auth-session", () => ({
  AuthRequest: class {
    codeVerifier = mockSocialAuthCodeVerifier;

    async getAuthRequestConfigAsync() {
      return mockSocialAuthRequestConfig;
    }
  },
}));
jest.mock("@/api/public-api", () => ({
  PublicApiError: class PublicApiError extends Error {
    kind = "unknown";
  },
  getCaptchaSettings: jest.fn(),
  registerAccount: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock("@/auth/MobileAuthProvider", () => {
  const session = { accessToken: "test-access-token" };
  const mockSignOut = jest.fn();
  const mockRefreshSession = jest.fn(async () => session);
  const mockAuthState = {
    session,
    signIn: jest.fn(),
    signOut: mockSignOut,
    status: mockMobileAuthStatus,
    refreshSession: mockRefreshSession,
  };
  return {
    MobileAuthProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    mockSignOut,
    mockRefreshSession,
    mockAuthState,
    useMobileAuth: jest.fn(() => ({
      ...mockAuthState,
      status: mockMobileAuthStatus,
      discoveryStatus: mockMobileDiscoveryStatus,
    })),
  };
});
jest.mock("@/i18n/LocaleProvider", () => {
  const dictionary = new Proxy({}, { get: (_target, key) => String(key) });
  return {
    useLocale: () => ({ dictionary, resolvedLocale: "en" }),
  };
});
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({
    palette: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));
jest.mock("@/theme/tokens", () => ({
  radii: { sm: 4, md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 48 },
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
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ token: "reset-token" }),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
  openAuthSessionAsync: jest.fn(async () => ({
    type: "success",
    url: `kitezh://social-link/callback?state=${"s".repeat(32)}&code=${"c".repeat(43)}`,
  })),
}));

const { mockAuthState, mockRefreshSession, mockSignOut } = jest.requireMock(
  "@/auth/MobileAuthProvider",
);
const { mockShowNotice } = jest.requireMock(
  "@/components/MobileNoticeProvider",
);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockRefreshSession.mockResolvedValue({ accessToken: "test-access-token" });
  mockAuthState.session = { accessToken: "test-access-token" };
  mockSocialAuthRequestConfig = {
    codeChallenge: "c".repeat(43),
    state: "s".repeat(32),
  };
  mockSocialAuthCodeVerifier = "v".repeat(43);
  jest.mocked(accountApi.listPersonalAccessTokens).mockResolvedValue([]);
  mockMobileAuthStatus = "signed-in";
  mockMobileDiscoveryStatus = "ready";
});

afterEach(() => jest.useRealTimers());

it("waits for auth restoration before redirecting a signed-out security screen", async () => {
  const { router } = jest.requireMock("expo-router");
  mockAuthState.session = null;
  mockMobileAuthStatus = "loading";

  const screenResult = render(<SecurityScreen />);
  expect(await screen.findByLabelText("loading")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();

  mockMobileAuthStatus = "signed-out";
  screenResult.rerender(<SecurityScreen />);

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in"));
  expect(accountApi.listAccountSessions).not.toHaveBeenCalled();
  expect(accountApi.listPersonalAccessTokens).not.toHaveBeenCalled();
});

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
  expect(await screen.findByText("currentSession")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findAllByText("passwordRequired")).toHaveLength(3);

  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(accountApi.changeAccountPassword).toHaveBeenCalledWith(
      "test-access-token",
      { currentPassword: "old-secret", newPassword: "a-long-new-secret" },
      expect.any(Object),
    ),
  );
  expect(await screen.findByText("passwordSaved")).toBeTruthy();
  const options = jest.mocked(accountApi.changeAccountPassword).mock.calls[0]?.[2];
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(options?.refreshAccessToken?.()).resolves.toBeNull();
});

it("creates, reveals, copies, hides, and revokes personal access tokens", async () => {
  const token = {
    id: "pat-1",
    name: "Codex",
    description: "Workstation",
    scope: "mcp.read",
    createdAt: "2026-10-17T10:00:00Z",
    expiresAt: null,
  };
  jest
    .mocked(accountApi.listPersonalAccessTokens)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([token])
    .mockResolvedValueOnce([]);
  jest.mocked(accountApi.createPersonalAccessToken).mockResolvedValue({
    ...token,
    token: "secret-pat-value",
  });
  jest.mocked(accountApi.revokePersonalAccessToken).mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const clipboard = jest.requireMock("expo-clipboard") as {
    setStringAsync: jest.Mock;
  };

  render(<SecurityScreen />);
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "personalAccessTokenNever" }));
  fireEvent.changeText(screen.getByLabelText("personalAccessTokenName"), {
    target: { value: "Codex" },
  });
  fireEvent.changeText(
    screen.getByLabelText("personalAccessTokenDescription"),
    { target: { value: "Workstation" } },
  );
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("secret-pat-value")).toBeTruthy();
  expect(accountApi.createPersonalAccessToken).toHaveBeenCalledWith(
    "test-access-token",
    { name: "Codex", description: "Workstation", expiration: "never" },
    expect.any(Object),
  );

  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCopy" }));
  await waitFor(() =>
    expect(clipboard.setStringAsync).toHaveBeenCalledWith("secret-pat-value"),
  );
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenHide" }));
  expect(screen.queryByText("secret-pat-value")).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenRevoke" }));
  const revokeActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    revokeActions?.find((action) => action.style === "destructive")?.onPress?.();
  });
  await waitFor(() =>
    expect(accountApi.revokePersonalAccessToken).toHaveBeenCalledWith(
      "test-access-token",
      "pat-1",
      expect.any(Object),
    ),
  );
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "personalAccessTokenRevoked",
  });
  const createOptions = jest.mocked(accountApi.createPersonalAccessToken).mock
    .calls[0]?.[2];
  const revokeOptions = jest.mocked(accountApi.revokePersonalAccessToken).mock
    .calls[0]?.[2];
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(createOptions?.refreshAccessToken?.()).resolves.toBeNull();
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(revokeOptions?.refreshAccessToken?.()).resolves.toBeNull();
});

it("keeps the final security form action clear of the persistent tab bar", async () => {
  render(<SecurityScreen />);

  const scrollView = screen.getByTestId("security-content");
  const contentStyle = StyleSheet.flatten(
    scrollView.props.contentContainerStyle,
  );

  expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(96);
});

it("validates a required token name and custom expiration date", async () => {
  render(<SecurityScreen />);
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("personalAccessTokenNameRequired")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("personalAccessTokenName"), {
    target: { value: "Automation" },
  });
  fireEvent.press(screen.getByTestId("pat-expiration-custom"));
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("personalAccessTokenCustomDateRequired")).toBeTruthy();

  fireEvent.changeText(screen.getByTestId("personalAccessTokenCustomDate"), {
    target: { value: "2026-02-31" },
  });
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("personalAccessTokenCustomDateInvalid")).toBeTruthy();

  const customDate = screen.getByTestId("personalAccessTokenCustomDate");
  const today = new Date().toISOString().slice(0, 10);
  const outsideMaximum = new Date(`${today}T00:00:00.000Z`);
  outsideMaximum.setUTCFullYear(outsideMaximum.getUTCFullYear() + 2);
  for (const invalidDate of ["not-a-date", today, outsideMaximum.toISOString().slice(0, 10)]) {
    fireEvent.changeText(customDate, { target: { value: invalidDate } });
    fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
    expect(await screen.findByText("personalAccessTokenCustomDateInvalid")).toBeTruthy();
  }
  expect(accountApi.createPersonalAccessToken).not.toHaveBeenCalled();
});

it("retries token loading and validates size limits before reporting create failures", async () => {
  jest
    .mocked(accountApi.listPersonalAccessTokens)
    .mockRejectedValueOnce(new Error("temporarily unavailable"))
    .mockResolvedValueOnce([]);
  jest
    .mocked(accountApi.createPersonalAccessToken)
    .mockRejectedValueOnce(new Error("create failed"));

  render(<SecurityScreen />);
  expect(await screen.findByText("personalAccessTokensError")).toBeTruthy();
  fireEvent.press(screen.getByText("sessionsRetry"));
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("personalAccessTokenName"), {
    target: { value: "n".repeat(101) },
  });
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("personalAccessTokenNameTooLong")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("personalAccessTokenName"), {
    target: { value: "Automation" },
  });
  fireEvent.changeText(screen.getByLabelText("personalAccessTokenDescription"), {
    target: { value: "d".repeat(501) },
  });
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));
  expect(await screen.findByText("personalAccessTokenDescriptionTooLong")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("personalAccessTokenDescription"), {
    target: { value: "" },
  });
  fireEvent.press(screen.getByTestId("pat-expiration-custom"));
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const customDate = tomorrow.toISOString().slice(0, 10);
  fireEvent.changeText(screen.getByTestId("personalAccessTokenCustomDate"), {
    target: { value: customDate },
  });
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));

  expect(await screen.findByText("personalAccessTokenCreateError")).toBeTruthy();
  expect(accountApi.createPersonalAccessToken).toHaveBeenCalledWith(
    "test-access-token",
    {
      name: "Automation",
      description: null,
      expiration: "custom",
      customExpirationDate: customDate,
    },
    expect.any(Object),
  );
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "personalAccessTokenCreateError",
  });
});

it("shows a newly created token only in its reveal panel and reports clipboard failures", async () => {
  const createdToken = {
    id: "pat-copy-error",
    name: "Automation",
    description: null,
    scope: "mcp.read",
    createdAt: "2026-10-17T10:00:00Z",
    expiresAt: null,
    token: "one-time-secret",
  };
  jest.mocked(accountApi.createPersonalAccessToken).mockResolvedValue(createdToken);
  const clipboard = jest.requireMock("expo-clipboard") as {
    setStringAsync: jest.Mock;
  };
  clipboard.setStringAsync.mockRejectedValueOnce(new Error("clipboard unavailable"));

  render(<SecurityScreen />);
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("personalAccessTokenName"), {
    target: { value: "Automation" },
  });
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCreate" }));

  expect(await screen.findByText("one-time-secret")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenCopy" }));
  expect(await screen.findByText("personalAccessTokenCopyError")).toBeTruthy();
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "personalAccessTokenCopyError",
  });

  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenDismiss" }));
  expect(screen.queryByText("one-time-secret")).toBeNull();
});

it("shows a recoverable error when a personal access token cannot be revoked", async () => {
  const token = {
    id: "pat-revoke-error",
    name: "Automation",
    description: null,
    scope: "mcp.read",
    createdAt: "2026-10-17T10:00:00Z",
    expiresAt: null,
  };
  jest
    .mocked(accountApi.listPersonalAccessTokens)
    .mockResolvedValueOnce([token]);
  jest
    .mocked(accountApi.revokePersonalAccessToken)
    .mockRejectedValueOnce(new Error("revoke failed"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SecurityScreen />);
  expect(await screen.findByText("Automation")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenRevoke" }));
  const actions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    actions?.find((action) => action.style === "destructive")?.onPress?.();
  });

  expect(await screen.findByText("personalAccessTokenRevokeError")).toBeTruthy();
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "personalAccessTokenRevokeError",
  });
});

it("shows the in-progress state while a personal access token is being revoked", async () => {
  const token = {
    id: "pat-revoke-pending",
    name: "Pending revoke",
    description: null,
    scope: "mcp.read",
    createdAt: "2026-10-17T10:00:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
  };
  let finishRevoke!: () => void;
  jest
    .mocked(accountApi.listPersonalAccessTokens)
    .mockResolvedValueOnce([token])
    .mockResolvedValueOnce([]);
  jest.mocked(accountApi.revokePersonalAccessToken).mockReturnValue(
    new Promise<void>((resolve) => {
      finishRevoke = resolve;
    }),
  );
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SecurityScreen />);
  expect(await screen.findByText("Pending revoke")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "personalAccessTokenRevoke" }));
  const actions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    actions?.find((action) => action.style === "destructive")?.onPress?.();
  });

  expect(await screen.findByLabelText("loading")).toBeTruthy();
  expect(screen.getByTestId("pat-revoke").props.accessibilityState.disabled).toBe(true);
  await act(async () => finishRevoke());
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();
});

it("disables session revocation and account deletion while their requests are pending", async () => {
  jest.mocked(accountApi.listAccountSessions)
    .mockResolvedValueOnce({
      content: [
        {
          id: "session-pending-revoke",
          createdAt: "2026-01-01T10:00:00Z",
          lastAccessedAt: "2026-01-02T10:00:00Z",
          expiresAt: "2026-02-01T10:00:00Z",
          current: false,
          clients: [{ clientId: "browser", clientName: "Browser" }],
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
    .mockResolvedValueOnce({
      content: [],
      number: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
  let finishSessionRevoke!: () => void;
  let finishAccountDelete!: () => void;
  jest.mocked(accountApi.signOutAccountSession).mockReturnValue(
    new Promise<void>((resolve) => {
      finishSessionRevoke = resolve;
    }),
  );
  jest.mocked(accountApi.deleteAccount).mockReturnValue(
    new Promise<void>((resolve) => {
      finishAccountDelete = resolve;
    }),
  );
  let alertActions:
    | { onPress?: () => void; style?: string }[]
    | undefined;
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, actions) => {
    alertActions = actions;
  });

  render(<SecurityScreen />);
  expect(await screen.findByText("Browser")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "signOutSession" }));
  await act(async () => {
    alertActions?.find((action) => action.style === "destructive")?.onPress?.();
  });
  const sessionAction = screen.getByRole("button", { name: "signOutSession" });
  await waitFor(() =>
    expect(sessionAction.props.accessibilityState.disabled).toBe(true),
  );
  expect(screen.getAllByLabelText("loading").length).toBeGreaterThan(0);
  await act(async () => finishSessionRevoke());

  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword").at(-1)!, {
    target: { value: "confirm-password" },
  });
  fireEvent.press(screen.getByRole("button", { name: "deleteAccount" }));
  await act(async () => {
    alertActions?.find((action) => action.style === "destructive")?.onPress?.();
  });
  const deleteAction = screen.getByRole("button", { name: "deleteAccount" });
  await waitFor(() =>
    expect(deleteAction.props.accessibilityState.disabled).toBe(true),
  );
  expect(screen.getAllByLabelText("loading").length).toBeGreaterThan(0);
  await act(async () => finishAccountDelete());
  expect(mockSignOut).toHaveBeenCalled();
});

it("rejects short, mismatched, and reused passwords before calling the API", async () => {
  render(<SecurityScreen />);
  await screen.findByText("currentSession");
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "short" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "different" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordMinLength")).toBeTruthy();
  expect(screen.getByText("passwordMismatch")).toBeTruthy();

  const reusedPassword = "same-long-secret";
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: reusedPassword },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: reusedPassword },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: reusedPassword },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordDifferent")).toBeTruthy();
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
  expect(await screen.findByText("Browser")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "signOutOthers" }));
  expect(await screen.findByText("signOutOthersError")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "signOutSession" }));
  const sessionActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    sessionActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("signOutSessionError")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "deleteAccount" }));
  const emptyDeleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    emptyDeleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeTruthy();
  fireEvent.changeText(
    screen.getAllByPlaceholderText("currentPassword").at(-1)!,
    {
      target: { value: "confirm-password" },
    },
  );
  fireEvent.press(screen.getByRole("button", { name: "deleteAccount" }));
  const deleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    deleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeTruthy();
  expect(accountApi.deleteAccount).toHaveBeenCalledWith(
    "test-access-token",
    "confirm-password",
    expect.any(Object),
  );
  const otherSessionsOptions = jest.mocked(accountApi.signOutOtherAccountSessions)
    .mock.calls[0]?.[1];
  const sessionOptions = jest.mocked(accountApi.signOutAccountSession).mock
    .calls[0]?.[2];
  const deleteOptions = jest.mocked(accountApi.deleteAccount).mock.calls[0]?.[2];
  for (const options of [otherSessionsOptions, sessionOptions, deleteOptions]) {
    mockRefreshSession.mockResolvedValueOnce(null);
    await expect(options?.refreshAccessToken?.()).resolves.toBeNull();
  }
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
  fireEvent.press(await screen.findByRole("button", { name: "mfaSetup" }));
  expect(await screen.findByText("mfaSecret: test-secret")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "mfaEnable" }));
  fireEvent.changeText(screen.getByLabelText("mfaCode"), {
    target: { value: "123456" },
  });
  fireEvent.press(screen.getByRole("button", { name: "mfaEnable" }));
  await waitFor(() =>
    expect(accountApi.mutateMfa).toHaveBeenCalledWith(
      "test-access-token",
      "enable",
      "123456",
      expect.any(Object),
    ),
  );
  const setupOptions = jest.mocked(accountApi.startMfaSetup).mock.calls[0]?.[1];
  const mutationOptions = jest.mocked(accountApi.mutateMfa).mock.calls[0]?.[3];
  await expect(setupOptions?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
  await expect(mutationOptions?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it("reports an expired session when starting MFA setup", async () => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: false,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });

  render(<MfaScreen />);
  await screen.findByRole("button", { name: "mfaSetup" });
  mockRefreshSession.mockResolvedValueOnce(null);

  fireEvent.press(screen.getByRole("button", { name: "mfaSetup" }));
  expect(await screen.findByText("mfaSetupError")).toBeTruthy();
  expect(accountApi.startMfaSetup).not.toHaveBeenCalled();
});

it("reports an expired session before generating recovery codes", async () => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: true,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest.mocked(accountApi.getRecoveryCodesStatus).mockResolvedValue({
    remaining: 2,
  });

  render(<MfaScreen />);
  await screen.findByRole("button", { name: "recoveryCodesGenerate" });
  mockRefreshSession.mockResolvedValueOnce(null);

  fireEvent.press(screen.getByRole("button", { name: "recoveryCodesGenerate" }));
  expect(await screen.findByText("recoveryCodesError")).toBeTruthy();
  expect(accountApi.generateRecoveryCodes).not.toHaveBeenCalled();
});

it("waits for auth restoration before redirecting the signed-out MFA screen", async () => {
  const { router } = jest.requireMock("expo-router");
  mockAuthState.session = null;
  mockMobileAuthStatus = "loading";

  const screenResult = render(<MfaScreen />);
  expect(await screen.findByLabelText("loading")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();

  mockMobileAuthStatus = "signed-out";
  screenResult.rerender(<MfaScreen />);

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in"));
  expect(accountApi.getMfaStatus).not.toHaveBeenCalled();
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

  fireEvent.press(await screen.findByText("sessionsRetry"));
  expect(await screen.findByText("mfaUnavailable")).toBeTruthy();
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
  expect(await screen.findByText("recoveryCodesRemaining: 2")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "recoveryCodesGenerate" }),
  );
  expect(await screen.findByText("first-code")).toBeTruthy();
  expect(screen.getByText("second-code")).toBeTruthy();
  const recoveryOptions = jest.mocked(accountApi.generateRecoveryCodes).mock
    .calls[0]?.[1];
  await expect(recoveryOptions?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );

  fireEvent.changeText(screen.getByLabelText("mfaCode"), {
    target: { value: "123" },
  });
  fireEvent.press(screen.getByRole("button", { name: "mfaDisable" }));
  expect(await screen.findByText("mfaInvalidCode")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("mfaCode"), {
    target: { value: "123456" },
  });
  fireEvent.press(screen.getByRole("button", { name: "mfaDisable" }));
  await waitFor(() => expect(accountApi.mutateMfa).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("mfaInvalidCode")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("mfaCode"), {
    target: { value: "654321" },
  });
  fireEvent.press(screen.getByRole("button", { name: "mfaDisable" }));
  await waitFor(() =>
    expect(accountApi.mutateMfa).toHaveBeenLastCalledWith(
      "test-access-token",
      "disable",
      "654321",
      expect.any(Object),
    ),
  );
  const mutationOptions = jest.mocked(accountApi.mutateMfa).mock.calls.at(-1)
    ?.[3];
  await expect(mutationOptions?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it.each([
  ["network failure", new Error("offline"), "mfaError"],
  [
    "server failure",
    Object.assign(new accountApi.AccountApiError(), { status: 500 }),
    "apiOffline",
  ],
])("shows the retry error for an MFA mutation %s", async (_scenario, failure, message) => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: true,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest.mocked(accountApi.getRecoveryCodesStatus).mockResolvedValue({
    remaining: 2,
  });
  jest.mocked(accountApi.mutateMfa).mockRejectedValueOnce(failure);

  render(<MfaScreen />);
  await screen.findByText("recoveryCodesRemaining: 2");
  fireEvent.changeText(screen.getByLabelText("mfaCode"), {
    target: { value: "123456" },
  });
  fireEvent.press(screen.getByRole("button", { name: "mfaDisable" }));

  expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.getByText("sessionsRetry")).toBeTruthy();
  expect(accountApi.mutateMfa).toHaveBeenCalledWith(
    "test-access-token",
    "disable",
    "123456",
    expect.any(Object),
  );
});

it.each([
  [401, "unauthorized", "apiUnauthorized"],
  [403, "forbidden", "apiForbidden"],
  [0, "offline", "apiOffline"],
  [0, "timeout", "apiTimeout"],
] as const)(
  "localizes MFA API failure %s as %s",
  async (status, kind, message) => {
    const failure = new accountApi.AccountApiError();
    Object.assign(failure, { kind, status });
    jest.mocked(accountApi.getMfaStatus).mockRejectedValue(failure);

    render(<MfaScreen />);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("sessionsRetry")).toBeTruthy();
  },
);

it("shows field-level MFA validation details returned by the server", async () => {
  jest.mocked(accountApi.getMfaStatus).mockResolvedValue({
    enabled: true,
    available: true,
    required: false,
    issuer: "Kitezh",
    algorithm: "SHA1",
    digits: 6,
    periodSeconds: 30,
  });
  jest.mocked(accountApi.getRecoveryCodesStatus).mockResolvedValue({
    remaining: 2,
  });
  const invalidCode = new accountApi.AccountApiError();
  Object.assign(invalidCode, {
    problem: { violations: [{ field: "code", message: "serverInvalidTotp" }] },
    status: 400,
  });
  jest.mocked(accountApi.mutateMfa).mockRejectedValue(invalidCode);

  render(<MfaScreen />);
  await screen.findByText("recoveryCodesRemaining: 2");
  fireEvent.changeText(screen.getByLabelText("mfaCode"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "mfaDisable" }));

  expect(await screen.findByText("serverInvalidTotp")).toBeTruthy();
});

it("confirms linked social-provider removal and refreshes native link status", async () => {
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
  jest.mocked(accountApi.unlinkSocialProvider).mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialConnected")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "socialRemove" }));
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
  expect(await screen.findByText("socialNotConnected")).toBeTruthy();
});

it("starts a native PKCE social-provider link flow and reloads its status", async () => {
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
  jest.mocked(accountApi.startNativeSocialLink).mockResolvedValue({
    authorizationUrl:
      "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
    state: "s".repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  jest.mocked(accountApi.completeNativeSocialLink).mockResolvedValue({
    provider: "github",
    linked: true,
  });
  const storage = jest.requireMock("@/auth/storage") as {
    consumeOAuthTransaction: jest.Mock;
  };
  storage.consumeOAuthTransaction.mockResolvedValue({
    clientId: "mobile-account-console",
    codeVerifier: "v".repeat(43),
    createdAt: Date.now(),
    redirectUri: "kitezh://social-link/callback",
    state: "s".repeat(32),
  });

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialNotConnected")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(accountApi.startNativeSocialLink).toHaveBeenCalledWith(
      "test-access-token",
      "github",
      { state: "s".repeat(32), codeChallenge: "c".repeat(43) },
      expect.any(Object),
    ),
  );
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
    "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
    "kitezh://social-link/callback",
  );
  expect(accountApi.completeNativeSocialLink).toHaveBeenCalledWith(
    "test-access-token",
    { code: "c".repeat(43), codeVerifier: "v".repeat(43) },
    expect.any(Object),
  );
  expect(jest.requireMock("@/auth/storage").saveOAuthTransaction).toHaveBeenCalledWith(
    "account",
    expect.objectContaining({
      clientId: "mobile-account-console",
      codeVerifier: "v".repeat(43),
      redirectUri: "kitezh://social-link/callback",
      state: "s".repeat(32),
    }),
  );
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "socialLinkSuccess",
  });
  const listOptions = jest.mocked(accountApi.listSocialLinks).mock.calls[0]?.[1];
  const startOptions = jest.mocked(accountApi.startNativeSocialLink).mock
    .calls[0]?.[3];
  const completeOptions = jest.mocked(accountApi.completeNativeSocialLink).mock
    .calls[0]?.[2];
  for (const options of [listOptions, startOptions, completeOptions]) {
    await expect(options?.refreshAccessToken?.()).resolves.toBe(
      "test-access-token",
    );
  }
  expect(await screen.findByText("socialConnected")).toBeTruthy();
});

it("rejects a social-link completion that does not confirm the provider link", async () => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValueOnce([
    {
      provider: "github",
      displayName: "GitHub",
      iconKey: "github",
      linked: false,
      configured: true,
      enabled: true,
    },
  ]);
  jest.mocked(accountApi.startNativeSocialLink).mockResolvedValueOnce({
    authorizationUrl:
      "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
    state: "s".repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  jest.mocked(accountApi.completeNativeSocialLink).mockResolvedValueOnce({
    provider: "github",
    linked: false,
  });
  jest
    .mocked(jest.requireMock("@/auth/storage").consumeOAuthTransaction)
    .mockResolvedValueOnce({
      clientId: "mobile-account-console",
      codeVerifier: "v".repeat(43),
      createdAt: Date.now(),
      redirectUri: "kitezh://social-link/callback",
      state: "s".repeat(32),
    });

  render(<SocialLinksScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(accountApi.completeNativeSocialLink).toHaveBeenCalledWith(
      "test-access-token",
      { code: "c".repeat(43), codeVerifier: "v".repeat(43) },
      expect.any(Object),
    ),
  );
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "socialLinkError",
  });
  expect(mockShowNotice).not.toHaveBeenCalledWith({
    kind: "success",
    message: "socialLinkSuccess",
  });
  expect(jest.requireMock("@/auth/storage").clearOAuthTransaction).toHaveBeenCalledWith(
    "account",
  );
});

it("keeps social connect disabled when a provider is unavailable", async () => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "linkedin",
      displayName: "LinkedIn",
      iconKey: "linkedin",
      linked: false,
      configured: false,
      enabled: true,
    },
    {
      provider: "microsoft",
      displayName: "Microsoft",
      iconKey: "microsoft",
      linked: false,
      configured: true,
      enabled: false,
    },
  ]);

  render(<SocialLinksScreen />);
  expect(await screen.findAllByText("socialNotConfigured")).toHaveLength(2);
  const connectButtons = screen.getAllByRole("button", {
    name: "socialConnect",
  });
  expect(connectButtons).toHaveLength(2);
  expect(
    connectButtons.every((button) => button.props.accessibilityState.disabled),
  ).toBe(true);
  fireEvent.press(connectButtons[0]);
  fireEvent.press(connectButtons[1]);
  expect(accountApi.startNativeSocialLink).not.toHaveBeenCalled();
});

it("clears the saved transaction when a social provider link is cancelled", async () => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "github",
      displayName: "GitHub",
      iconKey: "github",
      linked: false,
      configured: true,
      enabled: true,
    },
  ]);
  jest.mocked(accountApi.startNativeSocialLink).mockResolvedValue({
    authorizationUrl:
      "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
    state: "s".repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
    type: "cancel",
  } as never);

  render(<SocialLinksScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(jest.requireMock("@/auth/storage").clearOAuthTransaction).toHaveBeenCalledWith(
      "account",
    ),
  );
  expect(mockShowNotice).not.toHaveBeenCalled();
  expect(accountApi.completeNativeSocialLink).not.toHaveBeenCalled();
});

it("rejects a social-link callback with a mismatched state", async () => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "github",
      displayName: "GitHub",
      iconKey: "github",
      linked: false,
      configured: true,
      enabled: true,
    },
  ]);
  jest.mocked(accountApi.startNativeSocialLink).mockResolvedValue({
    authorizationUrl:
      "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
    state: "s".repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockResolvedValueOnce({
      type: "success",
      url: `kitezh://social-link/callback?state=mismatched-state&code=${"c".repeat(43)}`,
    } as never);
  jest
    .mocked(jest.requireMock("@/auth/storage").consumeOAuthTransaction)
    .mockResolvedValueOnce({
      clientId: "mobile-account-console",
      codeVerifier: "v".repeat(43),
      createdAt: Date.now(),
      redirectUri: "kitezh://social-link/callback",
      state: "s".repeat(32),
    });

  render(<SocialLinksScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "socialLinkError",
    }),
  );
  expect(accountApi.completeNativeSocialLink).not.toHaveBeenCalled();
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
    .mocked(accountApi.startNativeSocialLink)
    .mockRejectedValueOnce(new Error("authorization server unavailable"));

  render(<SocialLinksScreen />);
  expect(await screen.findByText("socialLinksError")).toBeTruthy();
  fireEvent.press(screen.getByText("sessionsRetry"));
  expect(await screen.findByText("socialNotConnected")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "socialConnect" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "socialLinkError",
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
  fireEvent.press(screen.getByRole("button", { name: "back" }));
  expect(jest.requireMock("expo-router").router.back).toHaveBeenCalled();
  // The link flow stays on this screen; refresh the mocked links before removal.
  fireEvent.press(screen.getByRole("button", { name: "socialConnect" }));
  await waitFor(() =>
    expect(accountApi.listSocialLinks).toHaveBeenCalledTimes(3),
  );
  fireEvent.press(screen.getByRole("button", { name: "socialRemove" }));
  const actions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    actions?.find((action) => action.style === "destructive")?.onPress?.();
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "socialRemoveError",
  });
});

it("rejects a native social-link request when its PKCE state is incomplete", async () => {
  mockSocialAuthRequestConfig = { codeChallenge: "", state: "s".repeat(32) };
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "github",
      displayName: "GitHub",
      iconKey: "github",
      linked: false,
      configured: true,
      enabled: true,
    },
  ]);

  render(<SocialLinksScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "socialLinkError",
    }),
  );
  expect(accountApi.startNativeSocialLink).not.toHaveBeenCalled();
  expect(jest.requireMock("@/auth/storage").clearOAuthTransaction).toHaveBeenCalledWith(
    "account",
  );
});

it.each([
  ["a mismatched state", "different-state", "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque"],
  ["an untrusted authorization URL", "s".repeat(32), "https://attacker.example/authorize"],
])("rejects social-link start responses with %s", async (_description, state, authorizationUrl) => {
  jest.mocked(accountApi.listSocialLinks).mockResolvedValue([
    {
      provider: "github",
      displayName: "GitHub",
      iconKey: "github",
      linked: false,
      configured: true,
      enabled: true,
    },
  ]);
  jest.mocked(accountApi.startNativeSocialLink).mockResolvedValueOnce({
    authorizationUrl,
    state,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  render(<SocialLinksScreen />);
  fireEvent.press(await screen.findByRole("button", { name: "socialConnect" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "socialLinkError",
    }),
  );
  expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  expect(jest.requireMock("@/auth/storage").clearOAuthTransaction).toHaveBeenCalledWith(
    "account",
  );
});

it("shows the social-link authentication loading state before restoring a session", async () => {
  const { router } = jest.requireMock("expo-router");
  mockAuthState.session = null;
  mockMobileAuthStatus = "loading";

  render(<SocialLinksScreen />);

  expect(await screen.findByLabelText("loading")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  expect(accountApi.listSocialLinks).not.toHaveBeenCalled();
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
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  expect(await screen.findByText("passwordPolicyRejected")).toBeTruthy();
  expect(screen.queryByText("passwordSaveError")).toBeNull();
});

it("maps legacy password validation data to the matching security fields", async () => {
  const validationError = Object.assign(new accountApi.AccountApiError(), {
    data: {
      violations: [
        { field: "currentPassword", message: "currentPasswordRejected" },
        { field: "confirmPassword", message: "confirmPasswordRejected" },
        null,
        {},
        { field: "newPassword" },
        { field: "newPassword", message: 12 },
      ],
    },
  });
  jest
    .mocked(accountApi.changeAccountPassword)
    .mockRejectedValueOnce(validationError);

  render(<SecurityScreen />);
  await screen.findByText("sessionsEmpty");
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  expect(await screen.findByText("currentPasswordRejected")).toBeTruthy();
  expect(screen.getByText("confirmPasswordRejected")).toBeTruthy();
  expect(screen.queryByText("passwordSaveError")).toBeNull();
});

it("falls back to a generic password error for malformed validation data", async () => {
  const malformedError = Object.assign(new accountApi.AccountApiError(), {
    data: { violations: "unexpected-server-shape" },
  });
  jest
    .mocked(accountApi.changeAccountPassword)
    .mockRejectedValueOnce(malformedError);

  render(<SecurityScreen />);
  await screen.findByText("sessionsEmpty");
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  expect(await screen.findByText("passwordSaveError")).toBeTruthy();
});

it("uses the generic password error when legacy validation data has no violations", async () => {
  const malformedError = Object.assign(new accountApi.AccountApiError(), {
    data: {},
  });
  jest
    .mocked(accountApi.changeAccountPassword)
    .mockRejectedValueOnce(malformedError);

  render(<SecurityScreen />);
  await screen.findByText("sessionsEmpty");
  fireEvent.changeText(screen.getAllByPlaceholderText("currentPassword")[0]!, {
    target: { value: "old-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-new-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  expect(await screen.findByText("passwordSaveError")).toBeTruthy();
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
  ).toBeTruthy();
  const enterValidPassword = () => {
    fireEvent.changeText(
      screen.getAllByPlaceholderText("currentPassword")[0]!,
      {
        target: { value: "old-secret" },
      },
    );
    fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
      target: { value: "a-long-new-secret" },
    });
    fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
      target: { value: "a-long-new-secret" },
    });
  };
  enterValidPassword();
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordSaveError")).toBeTruthy();

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "signOutOthers" }));
  expect(await screen.findByText("signOutOthersError")).toBeTruthy();

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "signOutSession" }));
  const revokeActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    revokeActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("signOutSessionError")).toBeTruthy();

  fireEvent.changeText(
    screen.getAllByPlaceholderText("currentPassword").at(-1)!,
    {
      target: { value: "confirm-password" },
    },
  );
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "deleteAccount" }));
  const deleteActions = alert.mock.calls.at(-1)?.[2];
  await act(async () => {
    deleteActions
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  expect(await screen.findByText("deleteAccountError")).toBeTruthy();
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
  fireEvent.press(await screen.findByText("sessionsRetry"));
  expect(await screen.findByText("currentSession")).toBeTruthy();
  const options = jest.mocked(accountApi.listAccountSessions).mock
    .calls[1]?.[1];
  expect(options).toEqual(
    expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  );
  await expect(options?.refreshAccessToken?.()).resolves.toBe(
    "test-access-token",
  );
});

it("retries token and session reads after the session refresh is unavailable", async () => {
  jest.mocked(accountApi.listAccountSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  mockRefreshSession
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null);

  render(<SecurityScreen />);
  expect(await screen.findByText("personalAccessTokensError")).toBeTruthy();
  expect(await screen.findByText("sessionsError")).toBeTruthy();

  fireEvent.press(screen.getAllByRole("button", { name: "sessionsRetry" })[0]!);
  expect(await screen.findByText("personalAccessTokensEmpty")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "sessionsRetry" }));
  expect(await screen.findByText("sessionsEmpty")).toBeTruthy();
  expect(accountApi.listPersonalAccessTokens).toHaveBeenCalledTimes(1);
  expect(accountApi.listAccountSessions).toHaveBeenCalledTimes(1);
  const tokenOptions = jest.mocked(accountApi.listPersonalAccessTokens).mock
    .calls[0]?.[1];
  const sessionOptions = jest.mocked(accountApi.listAccountSessions).mock
    .calls[0]?.[1];
  mockRefreshSession.mockResolvedValue(null);
  await expect(tokenOptions?.refreshAccessToken?.()).resolves.toBeNull();
  await expect(sessionOptions?.refreshAccessToken?.()).resolves.toBeNull();
});

it("pages active sessions with a single in-flight request", async () => {
  let resolvePage!: (
    value: Awaited<ReturnType<typeof accountApi.listAccountSessions>>,
  ) => void;
  const pendingPage = new Promise<
    Awaited<ReturnType<typeof accountApi.listAccountSessions>>
  >((resolve) => {
    resolvePage = resolve;
  });
  jest
    .mocked(accountApi.listAccountSessions)
    .mockResolvedValueOnce({
      content: [
        {
          id: "session-page-1",
          createdAt: "2026-01-01T10:00:00Z",
          lastAccessedAt: "2026-01-02T10:00:00Z",
          expiresAt: "2026-02-01T10:00:00Z",
          current: true,
          clients: [{ clientId: "account", clientName: "First session" }],
        },
      ],
      totalElements: 21,
      totalPages: 2,
      number: 0,
      size: 20,
    })
    .mockReturnValueOnce(pendingPage);

  render(<SecurityScreen />);
  expect(await screen.findByText("currentSession")).toBeTruthy();
  const previous = screen.getByRole("button", { name: "accountPreviousPage" });
  fireEvent.press(previous);
  expect(accountApi.listAccountSessions).toHaveBeenCalledTimes(1);

  const next = screen.getByRole("button", { name: "accountNextPage" });
  fireEvent.press(next);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "accountNextPage" }).props
        .accessibilityState.disabled,
    ).toBe(true),
  );
  fireEvent.press(screen.getByRole("button", { name: "accountNextPage" }));
  expect(accountApi.listAccountSessions).toHaveBeenCalledTimes(2);

  await act(async () => {
    resolvePage({
      content: [
        {
          id: "session-page-2",
          createdAt: "2026-01-03T10:00:00Z",
          lastAccessedAt: "2026-01-03T11:00:00Z",
          expiresAt: "2026-02-03T10:00:00Z",
          current: false,
          clients: [{ clientId: "web", clientName: "Second session" }],
        },
      ],
      totalElements: 21,
      totalPages: 2,
      number: 1,
      size: 20,
    });
    await pendingPage;
  });
  expect(await screen.findByText("Second session")).toBeTruthy();
  expect(accountApi.listAccountSessions.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({ page: 1 }),
  );
});

it("returns to the last valid page when the account session list shrinks", async () => {
  jest
    .mocked(accountApi.listAccountSessions)
    .mockResolvedValueOnce({
      content: [
        {
          id: "session-page-one",
          createdAt: "2026-01-01T10:00:00Z",
          lastAccessedAt: "2026-01-02T10:00:00Z",
          expiresAt: "2026-02-01T10:00:00Z",
          current: false,
          clients: [{ clientId: "web", clientName: "Last valid session" }],
        },
      ],
      totalElements: 21,
      totalPages: 2,
      number: 0,
      size: 20,
    })
    .mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 1,
      number: 1,
      size: 20,
    })
    .mockResolvedValueOnce({
      content: [
        {
          id: "session-page-one",
          createdAt: "2026-01-01T10:00:00Z",
          lastAccessedAt: "2026-01-02T10:00:00Z",
          expiresAt: "2026-02-01T10:00:00Z",
          current: false,
          clients: [{ clientId: "web", clientName: "Last valid session" }],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });

  render(<SecurityScreen />);
  expect(await screen.findByText("Last valid session")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "accountNextPage" }));

  await waitFor(() =>
    expect(accountApi.listAccountSessions).toHaveBeenCalledTimes(3),
  );
  expect(accountApi.listAccountSessions.mock.calls.map((call) => call[1]?.page)).toEqual([
    0,
    1,
    0,
  ]);
  expect(await screen.findByText("Last valid session")).toBeTruthy();
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
  fireEvent.press(create);
  expect(await screen.findByText("registrationError")).toBeTruthy();
  for (const [label, value] of [
    ["username", "alice"],
    ["firstName", "Alice"],
    ["lastName", "Example"],
    ["email", "alice@example.test"],
    ["newPassword", "a-long-password"],
    ["confirmPassword", "a-long-password"],
  ]) {
    fireEvent.changeText(screen.getByPlaceholderText(label), {
      target: { value },
    });
  }
  fireEvent.press(create);
  expect(await screen.findByText("Invalid email address")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("email"), {
    target: { value: "alice@example.test" },
  });
  jest.mocked(publicApi.registerAccount).mockResolvedValueOnce(undefined);
  fireEvent.press(create);
  await waitFor(() =>
    expect(publicApi.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "alice",
        email: "alice@example.test",
        locale: "en",
      }),
    ),
  );
  expect(await screen.findByText("registrationSuccess")).toBeTruthy();
});

it("blocks registration when native CAPTCHA settings are unavailable", async () => {
  jest
    .mocked(publicApi.getCaptchaSettings)
    .mockRejectedValueOnce(new Error("captcha settings unavailable"));

  render(<RegisterScreen />);

  expect(
    await screen.findByText("registrationCaptchaSettingsUnavailable"),
  ).toBeTruthy();
  expect(publicApi.registerAccount).not.toHaveBeenCalled();
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
});

it("validates and completes a deep-link password reset", async () => {
  jest.mocked(publicApi.resetPassword).mockResolvedValue(undefined);
  const { router } = jest.requireMock("expo-router");

  render(<ResetPasswordScreen />);
  fireEvent.press(screen.getByRole("button", { name: "back" }));
  expect(router.back).toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("passwordMinLength")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("newPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("confirmPassword"), {
    target: { value: "a-long-reset-secret" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("mfaCode"), {
    target: { value: " 123456 " },
  });
  jest
    .mocked(publicApi.resetPassword)
    .mockRejectedValueOnce(new Error("reset token expired"));
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("resetError")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(publicApi.resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "a-long-reset-secret",
      otpCode: "123456",
    }),
  );
  expect(await screen.findByText("resetSuccess")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
});

it("validates password-reset requests, reports failures, and navigates after success", async () => {
  const publicApi =
    jest.requireMock<typeof import("@/api/public-api")>("@/api/public-api");
  const { router } = jest.requireMock("expo-router");
  render(<ForgotPasswordScreen />);

  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotError")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("username"), {
    target: { value: " alice " },
  });
  jest
    .mocked(publicApi.requestPasswordReset)
    .mockRejectedValueOnce(new Error("offline"));
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotError")).toBeTruthy();

  jest.mocked(publicApi.requestPasswordReset).mockResolvedValueOnce(undefined);
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(await screen.findByText("forgotSent")).toBeTruthy();
  expect(publicApi.requestPasswordReset).toHaveBeenLastCalledWith(
    "alice",
    "en",
  );
  fireEvent.press(screen.getByRole("button", { name: "signIn" }));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
  fireEvent.press(screen.getByRole("button", { name: "back" }));
  expect(router.back).toHaveBeenCalled();
});

it("routes account and admin auth callbacks by state and times out signed-out sessions", async () => {
  jest.useFakeTimers();
  const { router } = jest.requireMock("expo-router");
  const { rerender } = render(<AccountAuthCallbackScreen />);
  expect(screen.getByLabelText("loading")).toBeTruthy();
  expect(router.replace).toHaveBeenCalledWith("/account");

  mockMobileAuthStatus = "error";
  rerender(<AccountAuthCallbackScreen />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign-in"));

  mockMobileAuthStatus = "signed-out";
  mockMobileDiscoveryStatus = "loading";
  router.replace.mockClear();
  rerender(<AccountAuthCallbackScreen />);
  act(() => {
    jest.advanceTimersByTime(15_000);
  });
  expect(router.replace).not.toHaveBeenCalledWith("/sign-in");

  mockMobileDiscoveryStatus = "ready";
  rerender(<AccountAuthCallbackScreen />);
  act(() => {
    jest.advanceTimersByTime(15_000);
  });
  expect(router.replace).toHaveBeenCalledWith("/sign-in");

  mockMobileAuthStatus = "signed-in";
  render(<AdminAuthCallbackScreen />);
  expect(router.replace).toHaveBeenCalledWith("/admin");
});
