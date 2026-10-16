import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Alert } from "react-native";
import * as accountApi from "@/api/account-api";
import AccountScreen from "../app/account";
import ApplicationsScreen from "../app/applications";

jest.mock("@/api/account-api", () => {
  const actual =
    jest.requireActual<typeof import("@/api/account-api")>("@/api/account-api");
  return {
    AccountApiError: actual.AccountApiError,
    getAccountProfile: jest.fn(),
    updateAccountProfile: jest.fn(),
    listAccountApplications: jest.fn(),
    listCibaRequests: jest.fn(),
    decideCibaRequest: jest.fn(),
    listOfflineSessions: jest.fn(),
    revokeAccountApplication: jest.fn(),
    revokeOfflineSession: jest.fn(),
  };
});
jest.mock("@/auth/MobileAuthProvider", () => {
  const session = { accessToken: "access" };
  const mockRefreshSession = jest.fn(async () => session);
  return {
    MobileAuthProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    mockRefreshSession,
    useMobileAuth: () => ({
      session,
      signIn: jest.fn(),
      signOut: jest.fn(),
      status: "signed-in",
      refreshSession: mockRefreshSession,
    }),
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
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
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
}));
const { mockShowNotice } = jest.requireMock(
  "@/components/MobileNoticeProvider",
);
const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockShowNotice.mockClear();
  mockRefreshSession.mockReset().mockResolvedValue({ accessToken: "access" });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [],
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
});

it("loads and saves the account profile, including email validation", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest
    .mocked(accountApi.updateAccountProfile)
    .mockImplementation(async (_token, request) => ({
      username: "alice",
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      pendingEmail: null,
      emailVerified: true,
      preferredLocale: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    }));

  render(<AccountScreen />);
  const email = await screen.findByPlaceholderText("email");
  fireEvent.change(email, { target: { value: "invalid-email" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("invalidEmail")).toBeVisible();
  fireEvent.change(email, { target: { value: "updated@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("emailReauthRequired")).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText("currentPassword"), {
    target: { value: "current-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));

  await waitFor(() =>
    expect(accountApi.updateAccountProfile).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({
        email: "updated@example.test",
        currentPassword: "current-secret",
      }),
      expect.any(Object),
    ),
  );
});

it("renders connected applications and offline sessions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid", "profile"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });

  render(<ApplicationsScreen />);

  expect(await screen.findByText("Account Console")).toBeVisible();
  expect(screen.getByText("CLI")).toBeVisible();
  expect(screen.getByText("offlineExpires: offlineNoExpiry")).toBeVisible();
  for (const request of [
    accountApi.listAccountApplications,
    accountApi.listOfflineSessions,
    accountApi.listCibaRequests,
  ]) {
    const options = jest.mocked(request).mock.calls[0]?.at(-1);
    expect(options).toEqual(
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    );
    await expect(
      (
        options as { refreshAccessToken: () => Promise<string | null> }
      ).refreshAccessToken(),
    ).resolves.toBe("access");
  }
});

it("shows CIBA decisions and blocks approval when step-up is required", async () => {
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve account sign-in",
        authorizedScopes: "openid profile",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
      {
        authReqId: "request-2",
        userCode: "WXYZ-5678",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: true,
        stepUpRequired: true,
      },
      {
        authReqId: "request-3",
        userCode: "STEP-1234",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: true,
      },
      {
        authReqId: "request-4",
        userCode: "MFA-5678",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: true,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
  });
  jest.mocked(accountApi.decideCibaRequest).mockResolvedValue(undefined);

  render(<ApplicationsScreen />);

  expect(await screen.findByText("Approve account sign-in")).toBeVisible();
  expect(screen.getByText(/ABCD-1234/)).toBeVisible();
  expect(screen.getByText("cibaMfaAndStepUpRequired")).toBeVisible();
  expect(screen.getByText("cibaStepUpRequired")).toBeVisible();
  expect(screen.getByText("cibaMfaRequired")).toBeVisible();
  const approveButtons = screen.getAllByRole("button", { name: "cibaApprove" });
  expect(approveButtons[1]).toBeDisabled();
  fireEvent.click(approveButtons[0]);
  await waitFor(() =>
    expect(accountApi.decideCibaRequest).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ authReqId: "request-1" }),
      "approve",
      expect.any(Object),
    ),
  );
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "cibaApproved",
    }),
  );
});

it("loads a profile after retrying a failed profile request", async () => {
  jest
    .mocked(accountApi.getAccountProfile)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      username: "alice",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.test",
      pendingEmail: null,
      emailVerified: true,
      preferredLocale: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

  render(<AccountScreen />);
  expect(await screen.findByText("profileLoadError")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "profileLoadError" }));
  expect(await screen.findByPlaceholderText("email")).toBeVisible();
});

it("retries loading the profile after the current session expires", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  mockRefreshSession
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ accessToken: "access" });

  render(<AccountScreen />);
  fireEvent.click(
    await screen.findByRole("button", { name: "profileLoadError" }),
  );
  expect(await screen.findByPlaceholderText("email")).toBeVisible();
  await waitFor(() =>
    expect(accountApi.getAccountProfile).toHaveBeenCalledTimes(1),
  );
});

it("reports profile save failures and routes to native account sections", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest
    .mocked(accountApi.updateAccountProfile)
    .mockRejectedValue(new Error("offline"));

  render(<AccountScreen />);
  fireEvent.change(await screen.findByPlaceholderText("firstName"), {
    target: { value: "Taylor" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("profileSaveError")).toBeVisible();

  const { router } = jest.requireMock("expo-router");
  for (const route of [
    "settings",
    "security",
    "applications",
    "mfa",
    "socialLinks",
  ]) {
    fireEvent.click(screen.getByRole("button", { name: route }));
    expect(router.push).toHaveBeenCalledWith(
      `/${route === "socialLinks" ? "social-links" : route}`,
    );
  }
  fireEvent.click(screen.getByRole("button", { name: "continue" }));
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("maps server profile validation to the matching native fields", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest.mocked(accountApi.updateAccountProfile).mockRejectedValue(
    new accountApi.AccountApiError(422, "invalid profile", {
      violations: [
        { field: "firstName", message: "firstNameRejected" },
        { field: "email", message: "emailRejected" },
      ],
    }),
  );

  render(<AccountScreen />);
  fireEvent.change(await screen.findByPlaceholderText("firstName"), {
    target: { value: "Taylor" },
  });
  fireEvent.change(screen.getByPlaceholderText("email"), {
    target: { value: "alice@example.test" },
  });
  const save = screen.getByRole("button", { name: "save" });
  fireEvent.click(save);
  fireEvent.click(save);

  expect(await screen.findByText("firstNameRejected")).toBeVisible();
  expect(screen.getByText("emailRejected")).toBeVisible();
  expect(screen.queryByText("profileSaveError")).not.toBeInTheDocument();
  expect(accountApi.updateAccountProfile).toHaveBeenCalledTimes(1);
});

it("shows application errors and recovers after retry", async () => {
  jest
    .mocked(accountApi.listAccountApplications)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      content: [
        {
          clientId: "console",
          clientName: "Account Console",
          scopes: ["openid"],
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      number: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });

  render(<ApplicationsScreen />);
  expect(await screen.findByText("applicationsError")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "sessionsRetry" })[0]);
  expect(await screen.findByText("Account Console")).toBeVisible();
  expect(screen.getByText("offlineSessionsEmpty")).toBeVisible();
});

it("reports all application sections when refreshing the session fails", async () => {
  mockRefreshSession.mockRejectedValueOnce(new Error("session refresh failed"));

  render(<ApplicationsScreen />);

  expect(await screen.findByText("applicationsError")).toBeVisible();
  expect(screen.getByText("offlineSessionsError")).toBeVisible();
  expect(screen.getByText("cibaLoadError")).toBeVisible();
});

it("shows independent offline and CIBA loading failures", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  jest
    .mocked(accountApi.listOfflineSessions)
    .mockRejectedValueOnce(new Error("offline sessions unavailable"));
  jest
    .mocked(accountApi.listCibaRequests)
    .mockRejectedValueOnce(new Error("pending requests unavailable"));

  render(<ApplicationsScreen />);

  expect(await screen.findByText("applicationsEmpty")).toBeVisible();
  await waitFor(() => {
    expect(accountApi.listOfflineSessions).toHaveBeenCalled();
    expect(accountApi.listCibaRequests).toHaveBeenCalled();
    expect(screen.getByText("offlineSessionsError")).toBeVisible();
    expect(screen.getByText("cibaLoadError")).toBeVisible();
  });
});

it("shows all application sections as retryable when the session expires", async () => {
  jest
    .mocked(accountApi.listAccountApplications)
    .mockRejectedValueOnce(new Error("application service unavailable"));
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  render(<ApplicationsScreen />);
  expect(await screen.findByText("applicationsError")).toBeVisible();
  mockRefreshSession.mockResolvedValueOnce(null);

  fireEvent.click(screen.getAllByRole("button", { name: "sessionsRetry" })[0]!);

  expect(await screen.findByText("applicationsError")).toBeVisible();
  expect(screen.getByText("offlineSessionsError")).toBeVisible();
  expect(screen.getByText("cibaLoadError")).toBeVisible();
});

it("reports expired-session failures for application, offline, and CIBA actions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve sign-in",
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  expect(await screen.findByText("Account Console")).toBeVisible();
  const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "revokeApplication" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeApplicationError",
    }),
  );

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "revokeOfflineSession" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeOfflineSessionError",
    }),
  );

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: "cibaDeny" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "cibaDecisionError",
    }),
  );
  expect(accountApi.revokeAccountApplication).not.toHaveBeenCalled();
  expect(accountApi.revokeOfflineSession).not.toHaveBeenCalled();
  expect(accountApi.decideCibaRequest).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledTimes(2);
});

it("reports API failures for application, offline-session, and CIBA actions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve sign-in",
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  jest
    .mocked(accountApi.revokeAccountApplication)
    .mockRejectedValueOnce(new Error("application revoke rejected"));
  jest
    .mocked(accountApi.revokeOfflineSession)
    .mockRejectedValueOnce(new Error("offline revoke rejected"));
  jest
    .mocked(accountApi.decideCibaRequest)
    .mockRejectedValueOnce(new Error("CIBA decision rejected"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  expect(await screen.findByText("Account Console")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "revokeApplication" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeApplicationError",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "revokeOfflineSession" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeOfflineSessionError",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "cibaDeny" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "cibaDecisionError",
    }),
  );
  expect(accountApi.revokeAccountApplication).toHaveBeenCalledTimes(1);
  expect(accountApi.revokeOfflineSession).toHaveBeenCalledTimes(1);
  expect(accountApi.decideCibaRequest).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(2);
});

it("confirms, serializes, and reports application and offline-session revocations", async () => {
  const application = {
    clientId: "admin-console",
    clientName: "Admin Console",
    scopes: ["openid"],
    createdAt: "invalid-date",
  };
  const offlineSession = {
    id: "offline-7",
    clientId: "cli",
    clientName: "CLI",
    issuedAt: "invalid-date",
    expiresAt: null,
  };
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [application],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [offlineSession],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  let completeApplication!: () => void;
  let completeOffline!: () => void;
  jest.mocked(accountApi.revokeAccountApplication).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeApplication = resolve;
      }),
  );
  jest.mocked(accountApi.revokeOfflineSession).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeOffline = resolve;
      }),
  );
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title: unknown,
    _message: unknown,
    buttons: { onPress?: () => void }[],
  ) => {
    buttons[1]?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  const revokeApplication = await screen.findByRole("button", {
    name: "revokeApplication",
  });
  fireEvent.click(revokeApplication);
  await waitFor(() =>
    expect(accountApi.revokeAccountApplication).toHaveBeenCalledWith(
      "access",
      "admin-console",
      expect.any(Object),
    ),
  );
  await waitFor(() => expect(revokeApplication).toBeDisabled());
  expect(
    revokeApplication.querySelector('[role="progressbar"]'),
  ).not.toBeNull();
  fireEvent.click(revokeApplication);
  expect(accountApi.revokeAccountApplication).toHaveBeenCalledTimes(1);
  completeApplication();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "revokeApplicationSuccess",
    }),
  );

  const revokeOffline = await screen.findByRole("button", {
    name: "revokeOfflineSession",
  });
  fireEvent.click(revokeOffline);
  await waitFor(() =>
    expect(accountApi.revokeOfflineSession).toHaveBeenCalledWith(
      "access",
      "offline-7",
      expect.any(Object),
    ),
  );
  await waitFor(() => expect(revokeOffline).toBeDisabled());
  fireEvent.click(revokeOffline);
  expect(accountApi.revokeOfflineSession).toHaveBeenCalledTimes(1);
  completeOffline();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "revokeOfflineSessionSuccess",
    }),
  );
  expect(alert).toHaveBeenCalledTimes(2);
});
