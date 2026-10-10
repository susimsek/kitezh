import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Alert } from "react-native";
import * as accountApi from "@/api/account-api";
import AccountScreen from "./account";
import ApplicationsScreen from "./applications";

jest.mock("@/api/account-api", () => ({
  getAccountProfile: jest.fn(),
  updateAccountProfile: jest.fn(),
  listAccountApplications: jest.fn(),
  listOfflineSessions: jest.fn(),
  revokeAccountApplication: jest.fn(),
  revokeOfflineSession: jest.fn(),
}));
jest.mock("@/auth/MobileAuthProvider", () => ({
  MobileAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useMobileAuth: (() => {
    const session = { accessToken: "access" };
    const refreshSession = async () => session;
    return () => ({
      session,
      signIn: jest.fn(),
      signOut: jest.fn(),
      status: "signed-in",
      refreshSession,
    });
  })(),
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

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockShowNotice.mockClear();
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
