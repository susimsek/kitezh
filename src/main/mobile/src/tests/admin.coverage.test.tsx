import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { Alert } from "react-native";
import * as adminApi from "@/api/admin-api";
import AdminScreen from "../app/admin";

jest.mock("@/api/admin-api", () => ({
  getAdminDashboard: jest.fn(),
  getAdminServerInfo: jest.fn(),
  getAdminWhoAmI: jest.fn(),
  createAdminUser: jest.fn(),
  createAdminClient: jest.fn(),
  createAdminClientScope: jest.fn(),
  createAdminRole: jest.fn(),
  createAdminGroup: jest.fn(),
  createAdminIdentityProvider: jest.fn(),
  updateAdminClient: jest.fn(),
  updateAdminClientScope: jest.fn(),
  updateAdminRole: jest.fn(),
  updateAdminGroup: jest.fn(),
  updateAdminIdentityProvider: jest.fn(),
  updateAdminUser: jest.fn(),
  deleteAdminUser: jest.fn(),
  deleteAdminClient: jest.fn(),
  deleteAdminClientScope: jest.fn(),
  deleteAdminRole: jest.fn(),
  deleteAdminGroup: jest.fn(),
  deleteAdminIdentityProvider: jest.fn(),
  setAdminUserEnabled: jest.fn(),
  unlockAdminUser: jest.fn(),
  rotateAdminKey: jest.fn(),
  listAdminUsers: jest.fn(),
  listAdminClients: jest.fn(),
  listAdminClientScopes: jest.fn(),
  listAdminRoles: jest.fn(),
  getAdminRoleDetail: jest.fn(),
  listAdminAvailableRoleUsers: jest.fn(),
  listAdminGroupUsers: jest.fn(),
  listAdminAvailableGroupUsers: jest.fn(),
  addAdminGroupUser: jest.fn(),
  removeAdminGroupUser: jest.fn(),
  assignAdminRoleUser: jest.fn(),
  removeAdminRoleUser: jest.fn(),
  listAdminGroups: jest.fn(),
  listAdminIdentityProviders: jest.fn(),
  listAdminSessions: jest.fn(),
  listAdminConsents: jest.fn(),
  listAdminKeys: jest.fn(),
  listAdminEvents: jest.fn(),
  deleteAdminSession: jest.fn(),
  revokeAdminConsent: jest.fn(),
  deleteAdminEvents: jest.fn(),
  getAdminEventSettings: jest.fn(),
  updateAdminEventSettings: jest.fn(),
  getNativeAdminLoginSettings: jest.fn(),
  getAdminCibaPolicy: jest.fn(),
  getAdminOfflineAccessPolicy: jest.fn(),
  getAdminEmailSettings: jest.fn(),
  getAdminLocalizationSettings: jest.fn(),
  AdminApiError: class AdminApiError extends Error {
    readonly status: number;

    constructor(mockStatus: number) {
      super("mock admin API error");
      this.status = mockStatus;
    }
  },
}));
jest.mock("@/auth/MobileAuthProvider", () => ({
  ...(() => {
    const session = { accessToken: "access" };
    const mockRefreshSession = jest.fn(async () => session);
    const mockAuthState = {
      session,
      signIn: jest.fn(),
      signOut: jest.fn(),
      status: "signed-in",
      refreshSession: mockRefreshSession,
    };
    return {
      mockAuthState,
      mockRefreshSession,
      MobileAuthProvider: ({ children }: { children: React.ReactNode }) =>
        children,
      useMobileAuth: () => mockAuthState,
    };
  })(),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({
    dictionary: new Proxy({}, { get: (_target, key) => String(key) }),
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
jest.mock("@/components/MobileNoticeProvider", () => ({
  useMobileNotice: () => ({ showNotice: mockShowNotice }),
}));

const mockShowNotice = jest.fn();
jest.mock("@/components/BrandMark", () => ({
  BrandMark: () => {
    const React = jest.requireActual<typeof import("react")>("react");
    const { Text: NativeText } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(NativeText, null, "Brand");
  },
}));
jest.mock("@/components/AppIcon", () => ({
  AppIcon: () => null,
}));
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});

const emptyPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

const adminAccessAll = {
  isAdmin: true,
  queryClients: true,
  viewClients: true,
  manageClients: true,
  queryUsers: true,
  viewUsers: true,
  manageUsers: true,
  impersonateUsers: true,
  queryGroups: true,
  viewGroups: true,
  manageGroups: true,
  queryOrganizations: true,
  viewOrganizations: true,
  manageOrganizations: true,
  viewRoles: true,
  manageRoles: true,
  viewSessions: true,
  manageSessions: true,
  viewConsents: true,
  manageConsents: true,
  viewEvents: true,
  manageEvents: true,
  viewKeys: true,
  manageKeys: true,
};

async function refreshTokenFromCall(call: readonly unknown[] | undefined) {
  const options = call?.at(-1);
  if (
    !options ||
    typeof options !== "object" ||
    !("refreshAccessToken" in options)
  )
    return undefined;
  return (
    options as { refreshAccessToken?: () => Promise<string | null> }
  ).refreshAccessToken?.();
}

async function expectRefreshCallbackHandlesExpiredSession(
  call: readonly unknown[] | undefined,
) {
  const { mockRefreshSession } = jest.requireMock(
    "@/auth/MobileAuthProvider",
  );
  await expect(refreshTokenFromCall(call)).resolves.toBe("access");
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(call)).resolves.toBeNull();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(adminApi.getNativeAdminLoginSettings).mockReset();
  jest.mocked(adminApi.getAdminCibaPolicy).mockReset();
  jest.mocked(adminApi.getAdminOfflineAccessPolicy).mockReset();
  jest.mocked(adminApi.getAdminEmailSettings).mockReset();
  jest.mocked(adminApi.getAdminLocalizationSettings).mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");
  mockAuthState.session = { accessToken: "access" };
  mockAuthState.status = "signed-in";
  mockRefreshSession.mockReset().mockResolvedValue({ accessToken: "access" });
  jest.mocked(adminApi.getAdminDashboard).mockResolvedValue({
    clients: 2,
    users: 3,
    sessions: 4,
    consents: 5,
  });
  for (const request of Object.values(adminApi)) {
    if (
      typeof request === "function" &&
      "mockResolvedValue" in request &&
      ![
        adminApi.getNativeAdminLoginSettings,
        adminApi.getAdminCibaPolicy,
        adminApi.getAdminOfflineAccessPolicy,
        adminApi.getAdminEmailSettings,
        adminApi.getAdminLocalizationSettings,
      ].includes(request as never)
    ) {
      request.mockResolvedValue(emptyPage);
    }
  }
  jest.mocked(adminApi.getAdminDashboard).mockResolvedValue({
    clients: 2,
    users: 3,
    sessions: 4,
    consents: 5,
  });
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValue({
    username: "admin",
    avatarUrl: null,
    authorities: ["ROLE_ADMIN"],
    access: adminAccessAll,
  });
  jest.mocked(adminApi.getAdminServerInfo).mockResolvedValue({
    issuer: "https://issuer.example.test",
    discoveryEndpoint: "https://issuer.example.test/.well-known/openid-configuration",
    authorizationEndpoint: "https://issuer.example.test/oauth2/authorize",
    tokenEndpoint: "https://issuer.example.test/oauth2/token",
    introspectionEndpoint: "https://issuer.example.test/oauth2/introspect",
    revocationEndpoint: "https://issuer.example.test/oauth2/revoke",
    jwksEndpoint: "https://issuer.example.test/oauth2/jwks",
    userInfoEndpoint: "https://issuer.example.test/userinfo",
    endSessionEndpoint: "https://issuer.example.test/connect/logout",
    sessionTimeout: "PT30M",
    activeSigningKey: {
      kid: "fixture-key",
      type: "RSA",
      algorithm: "RS256",
      use: "sig",
      createdAt: "2026-10-17T00:00:00Z",
    },
  });
  jest.mocked(adminApi.createAdminUser).mockResolvedValue(undefined);
  jest.mocked(adminApi.getAdminEventSettings).mockResolvedValue({
    eventsEnabled: true,
    adminEventsEnabled: true,
    adminEventsDetailsEnabled: false,
    eventsExpirationDays: 30,
  });
  jest
    .mocked(adminApi.updateAdminEventSettings)
    .mockImplementation(async (_token, settings) => settings);
});

it("hydrates backend capabilities before showing only authorized admin tabs and actions", async () => {
  const readOnlyAccess = { ...adminAccessAll };
  for (const key of Object.keys(readOnlyAccess) as (keyof typeof readOnlyAccess)[]) {
    readOnlyAccess[key] = false;
  }
  readOnlyAccess.viewUsers = true;
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "viewer",
    avatarUrl: null,
    authorities: ["ROLE_USER_VIEWER"],
    access: readOnlyAccess,
  });
  jest.mocked(adminApi.listAdminUsers).mockResolvedValueOnce({
    ...emptyPage,
    content: [
      {
        id: 71,
        username: "read-only-user",
        firstName: null,
        lastName: null,
        email: "viewer@example.com",
        enabled: true,
        locked: false,
        effectiveRoles: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });

  render(<AdminScreen />);
  expect(
    await screen.findByTestId("admin-tab-users", {}, { timeout: 10000 }),
  ).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();
  expect(screen.queryByTestId("admin-tab-clients")).toBeNull();
  fireEvent.press(screen.getByTestId("admin-tab-users"));
  expect(
    await screen.findByText("read-only-user", {}, { timeout: 10000 }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "adminCreate" })).toBeNull();
  expect(screen.queryByRole("button", { name: "adminEdit" })).toBeNull();
  expect(screen.queryByRole("button", { name: "adminUserDelete" })).toBeNull();
});

it("keeps management actions hidden for read-only resource viewers", async () => {
  const viewOnlyAccess = { ...adminAccessAll, isAdmin: false };
  for (const key of Object.keys(viewOnlyAccess) as (keyof typeof viewOnlyAccess)[]) {
    if (key.startsWith("manage")) viewOnlyAccess[key] = false;
  }
  viewOnlyAccess.viewClients = true;
  viewOnlyAccess.viewRoles = true;
  viewOnlyAccess.viewGroups = true;
  viewOnlyAccess.viewSessions = true;
  viewOnlyAccess.viewConsents = true;
  viewOnlyAccess.viewEvents = true;
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "viewer",
    avatarUrl: null,
    authorities: ["ROLE_RESOURCE_VIEWER"],
    access: viewOnlyAccess,
  });
  const page = <T,>(content: T[]) => ({
    ...emptyPage,
    content,
    totalElements: content.length,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminClients).mockResolvedValue(
    page([
      {
        id: "client-view",
        clientId: "viewer-app",
        clientName: "Viewer App",
        scopes: [],
        enabled: true,
        serviceAccountEnabled: false,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminClientScopes).mockResolvedValue(
    page([
      {
        id: "scope-view",
        name: "viewer.read",
        displayName: "Viewer read",
        description: null,
        builtIn: false,
        displayOnConsentScreen: true,
        includeInTokenScope: true,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminRoles).mockResolvedValue(
    page([{ name: "ROLE_VIEWER", description: "Read only" }]),
  );
  jest.mocked(adminApi.listAdminGroups).mockResolvedValue(
    page([
      {
        id: 9,
        name: "ReadOnly",
        path: "/ReadOnly",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue(
    page([
      {
        id: "session-view",
        username: "viewer-user",
        createdAt: "2026-01-01",
        lastAccessedAt: "2026-01-02",
        expiresAt: "2026-01-03",
        authorizationCount: 1,
        active: true,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue(
    page([
      {
        clientId: "viewer-app",
        clientName: "Viewer App",
        principalName: "viewer-user",
        userId: 10,
        authorities: ["openid"],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
      },
    ]),
  );

  render(<AdminScreen />);
  expect(await screen.findByRole("tab", { name: "adminClients" })).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();

  const readOnlyResources = [
    ["adminClients", "Viewer App"],
    ["adminClientScopes", "viewer.read"],
    ["adminRoles", "ROLE_VIEWER"],
    ["adminGroups", "ReadOnly"],
    ["adminSessions", "viewer-user"],
    ["adminConsents", "Viewer App"],
  ];
  for (const [tab, row] of readOnlyResources) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(row)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "adminCreate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "adminEdit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "adminDelete" })).toBeNull();
  }
  expect(screen.queryByTestId("admin-tab-keys")).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminEvents" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.queryByRole("button", { name: "adminDeleteEvents" })).toBeNull();
});

it("keeps retry hidden when a read-only user cannot view consents", async () => {
  const viewOnlyAccess = { ...adminAccessAll, isAdmin: false, manageConsents: false };
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "viewer",
    avatarUrl: null,
    authorities: ["ROLE_RESOURCE_VIEWER"],
    access: viewOnlyAccess,
  });
  jest
    .mocked(adminApi.listAdminConsents)
    .mockRejectedValue(new adminApi.AdminApiError(403));

  render(<AdminScreen />);
  await screen.findByRole("tab", { name: "adminClients" });
  fireEvent.press(screen.getByRole("tab", { name: "adminConsents" }));

  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "adminRetry" })).toBeNull();
});

it("keeps Admin navigation hidden while whoami capabilities are loading", async () => {
  let resolveIdentity!: (identity: Awaited<ReturnType<typeof adminApi.getAdminWhoAmI>>) => void;
  jest.mocked(adminApi.getAdminWhoAmI).mockImplementationOnce(
    () => new Promise((resolve) => { resolveIdentity = resolve; }),
  );
  render(<AdminScreen />);
  expect(screen.getByLabelText("loading")).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-list")).toBeNull();
  await waitFor(() => expect(adminApi.getAdminWhoAmI).toHaveBeenCalled());
  await act(async () => {
    resolveIdentity({
      username: "admin",
      avatarUrl: null,
      authorities: ["ROLE_ADMIN"],
      access: adminAccessAll,
    });
  });
  expect(await screen.findByTestId("admin-tab-dashboard")).toBeTruthy();
});

it.each([
  [401, "apiUnauthorized"],
  [403, "adminForbidden"],
])("shows localized retry state when whoami returns %s", async (status, message) => {
  jest
    .mocked(adminApi.getAdminWhoAmI)
    .mockRejectedValueOnce(new adminApi.AdminApiError(status));
  render(<AdminScreen />);
  expect(await screen.findByText(message)).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-access-retry"));
  expect(await screen.findByTestId("admin-tab-dashboard")).toBeTruthy();
});

it.each([
  ["offline", Object.assign(new adminApi.AdminApiError(0), { kind: "offline" }), "adminApiOfflineError"],
  ["timeout", Object.assign(new adminApi.AdminApiError(0), { kind: "timeout" }), "adminApiTimeoutError"],
  ["unexpected", new Error("whoami failed"), "adminLoadError"],
] as const)("shows a retryable %s whoami error", async (_kind, failure, message) => {
  jest.mocked(adminApi.getAdminWhoAmI).mockRejectedValueOnce(failure);

  render(<AdminScreen />);
  expect(await screen.findByText(message)).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-access-retry"));
  expect(await screen.findByTestId("admin-tab-dashboard")).toBeTruthy();
  expect(adminApi.getAdminWhoAmI).toHaveBeenCalledTimes(2);
});

it("fails closed when admin capabilities are missing and supports query-only users", async () => {
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "unconfigured",
    avatarUrl: null,
    authorities: [],
    access: null as never,
  });
  const view = render(<AdminScreen />);
  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();

  const queryOnlyAccess = {
    ...adminAccessAll,
    isAdmin: false,
    viewUsers: false,
    queryUsers: true,
  };
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "query-only",
    avatarUrl: null,
    authorities: ["ROLE_USER_QUERY"],
    access: queryOnlyAccess,
  });
  view.unmount();
  render(<AdminScreen />);
  expect(await screen.findByTestId("admin-tab-users")).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();
  expect(adminApi.listAdminUsers).toHaveBeenCalled();
});

it("loads and saves localized native audit event settings with validation", async () => {
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await screen.findByText("adminEventSettingsTitle")).toBeTruthy();
  expect(adminApi.getAdminEventSettings).toHaveBeenCalledWith(
    "access",
    expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  );

  fireEvent.changeText(
    screen.getByLabelText("adminEventRetentionDays"),
    "3651",
  );
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  expect(await screen.findByText("adminEventRetentionValidation")).toBeTruthy();
  expect(adminApi.updateAdminEventSettings).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText("adminEventRetentionDays"), "90");
  fireEvent.valueChange(
    screen.getByRole("switch", { name: "adminEventDetailsEnabled" }),
    true,
  );
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  await waitFor(() =>
    expect(adminApi.updateAdminEventSettings).toHaveBeenCalledWith(
      "access",
      {
        eventsEnabled: true,
        adminEventsEnabled: true,
        adminEventsDetailsEnabled: true,
        eventsExpirationDays: 90,
      },
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
  await expectRefreshCallbackHandlesExpiredSession(
    adminApi.updateAdminEventSettings.mock.calls.at(-1),
  );
});

it("shows audit settings as read-only to event viewers without admin access", async () => {
  jest.mocked(adminApi.getAdminWhoAmI).mockResolvedValueOnce({
    username: "event-viewer",
    avatarUrl: null,
    authorities: ["ROLE_EVENT_VIEWER"],
    access: { ...adminAccessAll, isAdmin: false, manageEvents: false },
  });

  render(<AdminScreen />);
  await screen.findByRole("tab", { name: "adminEvents" });
  fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));

  expect(await screen.findByText("adminEventSettingsTitle")).toBeTruthy();
  expect(screen.queryByTestId("admin-event-settings-save")).toBeNull();
  expect(screen.queryByText("adminLoginPolicyTitle")).toBeNull();
  expect(screen.queryByText("adminPolicyTitle")).toBeNull();
  expect(screen.queryByText("adminEmailSettingsTitle")).toBeNull();
  expect(screen.queryByText("adminLocalizationSettingsTitle")).toBeNull();

  const recordingSwitch = screen.getByRole("switch", {
    name: "adminEventRecordingEnabled",
  });
  expect(recordingSwitch.props.disabled).toBe(true);
  fireEvent.valueChange(recordingSwitch, false);
  expect(adminApi.updateAdminEventSettings).not.toHaveBeenCalled();
});

it("passes refresh callbacks to all administrator settings panels", async () => {
  const { mockRefreshSession } = jest.requireMock(
    "@/auth/MobileAuthProvider",
  );
  jest.mocked(adminApi.getNativeAdminLoginSettings).mockResolvedValue({
    userRegistration: true,
    forgotPassword: true,
    rememberMe: true,
    loginWithEmail: true,
    verifyEmail: false,
    sessionTimeoutMinutes: 30,
    passwordMinimumLength: 12,
    bruteForceEnabled: true,
    bruteForceMaxFailures: 5,
    otpEnabled: true,
    otpRequired: false,
    passkeys: true,
  });
  jest.mocked(adminApi.getAdminCibaPolicy).mockResolvedValue({
    requestLifespanSeconds: 120,
    pollingIntervalSeconds: 5,
    deliveryMode: "poll",
    userVerification: "preferred",
    mfaRequired: false,
    stepUpRequired: false,
    stepUpAcr: null,
  });
  jest.mocked(adminApi.getAdminOfflineAccessPolicy).mockResolvedValue({
    idleTimeout: "P30D",
    maxLifespan: null,
    maxLimited: false,
    revokedBefore: null,
  });
  jest.mocked(adminApi.getAdminEmailSettings).mockResolvedValue({
    enabled: false,
    fromAddress: "admin@example.test",
    baseUrl: "https://example.test",
    host: "smtp.example.test",
    port: 587,
    username: "mailer",
    passwordConfigured: false,
    smtpAuth: false,
    starttls: true,
    ssl: false,
  });
  jest.mocked(adminApi.getAdminLocalizationSettings).mockResolvedValue({
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
    availableLocales: ["en", "tr"],
    availableBundles: ["messages"],
  });
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const settingsRequests = [
    adminApi.getNativeAdminLoginSettings,
    adminApi.getAdminCibaPolicy,
    adminApi.getAdminOfflineAccessPolicy,
    adminApi.getAdminEmailSettings,
    adminApi.getAdminLocalizationSettings,
  ];
  for (const request of settingsRequests) {
    await waitFor(() => expect(request).toHaveBeenCalled());
    await expectRefreshCallbackHandlesExpiredSession(request.mock.calls.at(-1));
  }

  expect(mockRefreshSession).toHaveBeenCalled();
});

it("keeps audit settings permission failures localized and retryable", async () => {
  jest
    .mocked(adminApi.getAdminEventSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403));

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByTestId("admin-event-settings-retry"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await screen.findByText("adminEventSettingsTitle")).toBeTruthy();
  expect(adminApi.getAdminEventSettings).toHaveBeenCalledTimes(2);
});

it.each([
  ["offline", "adminEventSettingsOfflineError"],
  ["timeout", "adminEventSettingsTimeoutError"],
] as const)(
  "shows a localized audit settings %s error",
  async (kind, messageKey) => {
    const failure = Object.assign(new adminApi.AdminApiError(0), { kind });
    jest.mocked(adminApi.getAdminEventSettings).mockRejectedValueOnce(failure);

    render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
    await act(async () => {
      fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText(messageKey)).toBeTruthy();
    expect(screen.getByTestId("admin-event-settings-retry")).toBeTruthy();
  },
);

it("loads dashboard and navigates through every mobile administration tab", async () => {
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  expect(await screen.findByText("2")).toBeTruthy();
  const tabList = screen.getByTestId("admin-tab-list");
  expect(tabList.props.horizontal).toBe(true);
  expect(tabList.props.scrollEnabled).toBe(true);
  expect(tabList.props.directionalLockEnabled).toBe(true);
  const groupsTab = screen.getByTestId("admin-tab-groups");
  expect(groupsTab.props.accessibilityRole).toBe("tab");
  expect(groupsTab.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ flexShrink: 0 })]),
  );
  const tabs = [
    ["adminUsers", adminApi.listAdminUsers],
    ["adminClients", adminApi.listAdminClients],
    ["adminClientScopes", adminApi.listAdminClientScopes],
    ["adminRoles", adminApi.listAdminRoles],
    ["adminGroups", adminApi.listAdminGroups],
    ["adminIdentityProviders", adminApi.listAdminIdentityProviders],
    ["adminSessions", adminApi.listAdminSessions],
    ["adminConsents", adminApi.listAdminConsents],
    ["adminKeys", adminApi.listAdminKeys],
    ["adminEvents", adminApi.listAdminEvents],
  ];
  for (const [tab, request] of tabs) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    await waitFor(() => expect(screen.getAllByText(tab)).toHaveLength(2));
    await waitFor(() => expect(request).toHaveBeenCalled());
  }
  fireEvent.press(screen.getByRole("tab", { name: "adminServerInfo" }));
  expect(await screen.findByTestId("admin-server-info-content")).toBeTruthy();
  expect(screen.getByText("https://issuer.example.test")).toBeTruthy();
  expect(screen.getByText("fixture-key · RS256 · RSA")).toBeTruthy();
  expect(adminApi.getAdminServerInfo).toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await screen.findByText("adminEventSettingsTitle")).toBeTruthy();
  expect(adminApi.getAdminEventSettings).toHaveBeenCalled();
  expect(adminApi.getAdminDashboard).toHaveBeenCalled();
});

it("keeps server information fail-closed and offers a retry after 403", async () => {
  jest
    .mocked(adminApi.getAdminServerInfo)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403));
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminServerInfo" }));
  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  expect(screen.getByTestId("admin-server-info-retry")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-server-info-retry"));
  expect(await screen.findByTestId("admin-server-info-content")).toBeTruthy();
});

it("uses server metadata fallbacks and expired refresh callbacks", async () => {
  const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");
  jest.mocked(adminApi.getAdminServerInfo).mockResolvedValueOnce({
    issuer: "https://issuer.example.test",
    discoveryEndpoint: "https://issuer.example.test/.well-known/openid-configuration",
    authorizationEndpoint: "https://issuer.example.test/oauth2/authorize",
    tokenEndpoint: "https://issuer.example.test/oauth2/token",
    introspectionEndpoint: "https://issuer.example.test/oauth2/introspect",
    revocationEndpoint: "https://issuer.example.test/oauth2/revoke",
    jwksEndpoint: "https://issuer.example.test/oauth2/jwks",
    userInfoEndpoint: "https://issuer.example.test/userinfo",
    endSessionEndpoint: "https://issuer.example.test/connect/logout",
    sessionTimeout: null,
    activeSigningKey: null,
  } as unknown as adminApi.AdminServerInfo);
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(adminApi.getAdminWhoAmI.mock.calls.at(-1))).resolves.toBeNull();
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(adminApi.getAdminDashboard.mock.calls.at(-1))).resolves.toBeNull();

  fireEvent.press(screen.getByRole("tab", { name: "adminServerInfo" }));
  expect(await screen.findByTestId("admin-server-info-content")).toBeTruthy();
  expect(screen.getByText("—")).toBeTruthy();
  expect(screen.getByText("adminNotConfigured")).toBeTruthy();
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(adminApi.getAdminServerInfo.mock.calls.at(-1))).resolves.toBeNull();

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(adminApi.getAdminEventSettings.mock.calls.at(-1))).resolves.toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  await waitFor(() => expect(adminApi.updateAdminEventSettings).toHaveBeenCalled());
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(adminApi.updateAdminEventSettings.mock.calls.at(-1))).resolves.toBeNull();
});

it.each([
  [new adminApi.AdminApiError(401), "apiUnauthorized"],
  [Object.assign(new adminApi.AdminApiError(0), { kind: "offline" }), "adminApiOfflineError"],
  [Object.assign(new adminApi.AdminApiError(0), { kind: "timeout" }), "adminApiTimeoutError"],
  [new Error("metadata service unavailable"), "adminLoadError"],
] as const)("shows a recoverable server-info %s error", async (failure, message) => {
  jest.mocked(adminApi.getAdminServerInfo).mockRejectedValueOnce(failure);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminServerInfo" }));

  expect(await screen.findByText(message)).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-server-info-retry"));
  expect(await screen.findByTestId("admin-server-info-content")).toBeTruthy();
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new Error("dashboard unavailable"), "adminLoadError"],
])("shows a recoverable dashboard error for %s", async (failure, message) => {
  jest.mocked(adminApi.getAdminDashboard).mockRejectedValueOnce(failure);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  expect(await screen.findByText(message)).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "adminRetry" }));

  expect(await screen.findByText("2")).toBeTruthy();
});

it("manages role membership through the paged native admin API", async () => {
  jest.mocked(adminApi.listAdminRoles).mockResolvedValue({
    ...emptyPage,
    content: [{ name: "ROLE_AUDITOR", description: "Audit access" }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.getAdminRoleDetail).mockResolvedValue({
    name: "ROLE_AUDITOR",
    description: "Audit access",
    userCount: 1,
    protectedRole: false,
    users: {
      ...emptyPage,
      content: [{ id: 3, username: "member", enabled: true }],
      totalElements: 1,
      totalPages: 1,
    },
    compositeRoles: [],
    compositeClientRoles: [],
  });
  jest.mocked(adminApi.listAdminAvailableRoleUsers).mockResolvedValue({
    ...emptyPage,
    content: [{ id: 42, username: "candidate", enabled: true }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.assignAdminRoleUser).mockResolvedValue({} as never);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminRoles" }));
  fireEvent.press(
    await screen.findByRole("button", { name: "adminRoleManageUsers" }),
  );

  expect(await screen.findByText("member")).toBeTruthy();
  expect(await screen.findByText("candidate")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminRoleAssignUser" }));
  await waitFor(() =>
    expect(adminApi.assignAdminRoleUser).toHaveBeenCalledWith(
      "access",
      "ROLE_AUDITOR",
      42,
      0,
      10,
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "‹ back" }));
  expect(await screen.findByTestId("admin-tab-roles")).toBeTruthy();
});

it("manages native group memberships through the existing paged API", async () => {
  jest.mocked(adminApi.listAdminGroups).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 3,
        name: "Operators",
        path: "/Operators",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 1,
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminGroupUsers).mockResolvedValue({
    ...emptyPage,
    content: [{ id: 5, username: "member", enabled: true }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue({
    ...emptyPage,
    content: [{ id: 42, username: "candidate", enabled: true }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.addAdminGroupUser).mockResolvedValue({} as never);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminGroups" }));
  fireEvent.press(
    await screen.findByRole("button", { name: "adminManageGroupMembers" }),
  );

  expect(screen.queryByRole("button", { name: "adminCreate" })).toBeNull();
  expect(await screen.findByText("member")).toBeTruthy();
  expect(await screen.findByText("candidate")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminAddGroupUser" }));
  await waitFor(() =>
    expect(adminApi.addAdminGroupUser).toHaveBeenCalledWith(
      "access",
      3,
      42,
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
  const groupCalls = adminApi.listAdminGroups.mock.calls.length;
  fireEvent.press(screen.getByRole("button", { name: "‹ back" }));
  await waitFor(() =>
    expect(adminApi.listAdminGroups).toHaveBeenCalledTimes(groupCalls + 1),
  );
});

it("confirms group member removal before calling the protected endpoint", async () => {
  jest.mocked(adminApi.listAdminGroups).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 3,
        name: "Operators",
        path: "/Operators",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 1,
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminGroupUsers).mockResolvedValue({
    ...emptyPage,
    content: [{ id: 5, username: "member", enabled: true }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue(emptyPage);
  jest.mocked(adminApi.removeAdminGroupUser).mockResolvedValue({} as never);
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminGroups" }));
  fireEvent.press(
    await screen.findByRole("button", { name: "adminManageGroupMembers" }),
  );
  fireEvent.press(
    await screen.findByRole("button", { name: "adminRemoveGroupUser" }),
  );

  await waitFor(() =>
    expect(adminApi.removeAdminGroupUser).toHaveBeenCalledWith(
      "access",
      3,
      5,
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
});

it("supplies a forced token refresh callback to every admin resource query", async () => {
  const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await screen.findByText("2");
  const dashboardCall = adminApi.getAdminDashboard.mock.calls.at(-1);
  await expect(refreshTokenFromCall(dashboardCall)).resolves.toBe("access");
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(refreshTokenFromCall(dashboardCall)).resolves.toBeNull();

  const resources = [
    ["adminUsers", adminApi.listAdminUsers],
    ["adminClients", adminApi.listAdminClients],
    ["adminClientScopes", adminApi.listAdminClientScopes],
    ["adminRoles", adminApi.listAdminRoles],
    ["adminGroups", adminApi.listAdminGroups],
    ["adminIdentityProviders", adminApi.listAdminIdentityProviders],
    ["adminSessions", adminApi.listAdminSessions],
    ["adminConsents", adminApi.listAdminConsents],
    ["adminKeys", adminApi.listAdminKeys],
    ["adminEvents", adminApi.listAdminEvents],
  ] as const;

  for (const [tab, request] of resources) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    await expect(refreshTokenFromCall(request.mock.calls.at(-1))).resolves.toBe(
      "access",
    );
    mockRefreshSession.mockResolvedValueOnce(null);
    await expect(refreshTokenFromCall(request.mock.calls.at(-1))).resolves.toBeNull();
  }
});

it("filters session administration and switches between active and expired pages", async () => {
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: "session-active",
        username: "alex",
        createdAt: "2026-01-01",
        lastAccessedAt: "2026-01-02",
        expiresAt: "2026-02-01",
        authorizationCount: 1,
        active: true,
      },
    ],
    totalElements: 11,
    totalPages: 2,
  });

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminSessions" }));
  expect(await screen.findByText("alex")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("adminSearchSessions"), {
    target: { value: "alex" },
  });
  await waitFor(() =>
    expect(adminApi.listAdminSessions).toHaveBeenCalledWith(
      "access",
      "alex",
      "active",
      "",
      0,
      10,
      expect.any(Object),
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "adminNext" }));
  await waitFor(() =>
    expect(adminApi.listAdminSessions).toHaveBeenCalledWith(
      "access",
      "alex",
      "active",
      "",
      1,
      10,
      expect.any(Object),
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "adminPrevious" }));

  fireEvent.press(screen.getByRole("button", { name: "adminExpired" }));
  await waitFor(() =>
    expect(adminApi.listAdminSessions).toHaveBeenCalledWith(
      "access",
      "alex",
      "expired",
      "",
      0,
      10,
      expect.any(Object),
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "adminActive" }));
  await waitFor(() =>
    expect(adminApi.listAdminSessions).toHaveBeenLastCalledWith(
      "access",
      "alex",
      "active",
      "",
      0,
      10,
      expect.any(Object),
    ),
  );
});

it("shows loading, signed-out, and authentication-error states", async () => {
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  mockAuthState.session = null;
  mockAuthState.status = "loading";
  const view = render(<AdminScreen />);
  expect(screen.getByLabelText("loading")).toBeTruthy();

  mockAuthState.status = "signed-out";
  view.rerender(<AdminScreen />);
  expect(screen.queryByText("authError")).toBeNull();
  mockAuthState.status = "error";
  view.rerender(<AdminScreen />);
  expect(screen.getByText("authError")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "signIn" }));
  expect(mockAuthState.signIn).toHaveBeenCalledTimes(1);
});

it("signs out from the administration header", async () => {
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("button", { name: "signOut" }));
  expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
});

it("clears failed admin capabilities before signing out", async () => {
  jest.mocked(adminApi.getAdminWhoAmI).mockRejectedValueOnce(
    new adminApi.AdminApiError(0),
  );
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  render(<AdminScreen />);

  expect(await screen.findByText("adminLoadError")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "signOut" }));

  expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();
});

it("renders section-specific load errors when mobile admin requests fail", async () => {
  const failures = [
    ["adminUsers", adminApi.listAdminUsers, "adminUsersLoadError"],
    ["adminClients", adminApi.listAdminClients, "adminClientsLoadError"],
    [
      "adminClientScopes",
      adminApi.listAdminClientScopes,
      "adminClientScopesLoadError",
    ],
    ["adminRoles", adminApi.listAdminRoles, "adminRolesLoadError"],
    ["adminGroups", adminApi.listAdminGroups, "adminGroupsLoadError"],
    [
      "adminIdentityProviders",
      adminApi.listAdminIdentityProviders,
      "adminIdentityProvidersLoadError",
    ],
    ["adminSessions", adminApi.listAdminSessions, "adminSessionsLoadError"],
    ["adminConsents", adminApi.listAdminConsents, "adminConsentsLoadError"],
    ["adminKeys", adminApi.listAdminKeys, "adminLoadError"],
    ["adminEvents", adminApi.listAdminEvents, "adminLoadError"],
  ] as const;
  for (const [, request] of failures) {
    jest.mocked(request).mockRejectedValue(new Error("offline"));
  }

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await screen.findByText("2");
  for (const [tab, , message] of failures) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(message)).toBeTruthy();
  }
});

it("keeps the last empty page visible when a later admin search fails", async () => {
  const resources = [
    ["adminUsers", "adminSearchUsers", "adminNoUsers", "adminUsersLoadError", adminApi.listAdminUsers],
    ["adminClients", "adminSearchClients", "adminNoClients", "adminClientsLoadError", adminApi.listAdminClients],
    ["adminClientScopes", "adminSearchClientScopes", "adminNoClientScopes", "adminClientScopesLoadError", adminApi.listAdminClientScopes],
    ["adminRoles", "adminSearchRoles", "adminNoRoles", "adminRolesLoadError", adminApi.listAdminRoles],
    ["adminGroups", "adminSearchGroups", "adminNoGroups", "adminGroupsLoadError", adminApi.listAdminGroups],
    ["adminIdentityProviders", "adminSearchIdentityProviders", "adminNoIdentityProviders", "adminIdentityProvidersLoadError", adminApi.listAdminIdentityProviders],
    ["adminSessions", "adminSearchSessions", "adminNoSessions", "adminSessionsLoadError", adminApi.listAdminSessions],
    ["adminConsents", "adminSearchConsents", "adminNoConsents", "adminConsentsLoadError", adminApi.listAdminConsents],
    ["adminKeys", "adminSearchKeys", "adminNoKeys", "adminLoadError", adminApi.listAdminKeys],
    ["adminEvents", "adminSearchEvents", "adminNoEvents", "adminLoadError", adminApi.listAdminEvents],
  ] as const;
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  for (const [tab, searchLabel, emptyMessage, errorMessage, request] of resources) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(emptyMessage)).toBeTruthy();
    const calls = jest.mocked(request).mock.calls.length;
    jest.mocked(request).mockRejectedValueOnce(new Error("search unavailable"));

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(searchLabel), "query");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(jest.mocked(request)).toHaveBeenCalledTimes(calls + 1);
    expect(screen.getByText(emptyMessage)).toBeTruthy();
    expect(screen.queryByText(errorMessage)).toBeNull();
  }
});

it("renders forbidden states for protected mobile admin resources", async () => {
  const forbidden = new adminApi.AdminApiError(403);
  const failures = [
    ["adminUsers", adminApi.listAdminUsers],
    ["adminClients", adminApi.listAdminClients],
    ["adminClientScopes", adminApi.listAdminClientScopes],
    ["adminRoles", adminApi.listAdminRoles],
    ["adminGroups", adminApi.listAdminGroups],
    ["adminIdentityProviders", adminApi.listAdminIdentityProviders],
    ["adminSessions", adminApi.listAdminSessions],
    ["adminConsents", adminApi.listAdminConsents],
    ["adminKeys", adminApi.listAdminKeys],
    ["adminEvents", adminApi.listAdminEvents],
  ] as const;
  for (const [, request] of failures) {
    jest.mocked(request).mockRejectedValue(forbidden);
  }

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await screen.findByText("2");
  for (const [tab, request] of failures) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText("adminForbidden")).toBeTruthy();
    if (tab === "adminUsers") {
      fireEvent.press(screen.getByRole("button", { name: "adminRetry" }));
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      expect(screen.getByText("adminForbidden")).toBeTruthy();
    }
  }
});

describe.each([
  ["adminKeys", adminApi.listAdminKeys, "adminNoKeys"],
  ["adminEvents", adminApi.listAdminEvents, "adminNoEvents"],
] as const)("native %s read errors", (tab, request, emptyMessage) => {
  it.each([
    ["expired session", new adminApi.AdminApiError(401), "apiUnauthorized"],
    ["forbidden", new adminApi.AdminApiError(403), "adminForbidden"],
    [
      "offline",
      Object.assign(new adminApi.AdminApiError(0), { kind: "offline" }),
      "adminApiOfflineError",
    ],
    [
      "timeout",
      Object.assign(new adminApi.AdminApiError(0), { kind: "timeout" }),
      "adminApiTimeoutError",
    ],
  ] as const)("shows a localized %s state and retries", async (_kind, failure, message) => {
    jest.mocked(request).mockRejectedValueOnce(failure);
    render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
    await screen.findByText("2");

    await act(async () => {
      fireEvent.press(screen.getByRole("tab", { name: tab }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText(message)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "adminRetry" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText(emptyMessage)).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
  });
});

it("renders populated mobile admin resources and supports filtered pagination", async () => {
  const page = <T,>(content: T[]) => ({
    ...emptyPage,
    content,
    totalElements: content.length,
    totalPages: 2,
  });
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue(
    page([
      {
        id: 17,
        username: "disabled-user",
        firstName: "Riley",
        lastName: "Smith",
        email: null,
        enabled: false,
        locked: true,
        effectiveRoles: [],
      },
      {
        id: 18,
        username: "minimal-user",
        firstName: null,
        lastName: null,
        email: null,
        enabled: true,
        locked: false,
        effectiveRoles: ["ROLE_USER"],
      },
    ]),
  );
  jest.mocked(adminApi.listAdminClients).mockResolvedValue(
    page([
      {
        id: "client-1",
        clientId: "orders-app",
        clientName: "Orders App",
        scopes: [],
        enabled: false,
        serviceAccountEnabled: false,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminClientScopes).mockResolvedValue(
    page([
      {
        id: "scope-1",
        name: "orders.read",
        displayName: null,
        description: "Read orders",
        builtIn: false,
        displayOnConsentScreen: true,
        includeInTokenScope: true,
      },
      {
        id: "scope-2",
        name: "profile",
        displayName: "Profile",
        description: null,
        builtIn: true,
        displayOnConsentScreen: false,
        includeInTokenScope: false,
      },
    ]),
  );
  jest
    .mocked(adminApi.listAdminRoles)
    .mockResolvedValue(page([{ name: "ROLE_AUDITOR", description: null }]));
  jest.mocked(adminApi.listAdminGroups).mockResolvedValue(
    page([
      {
        id: 3,
        name: "Operators",
        path: "/Operations/Operators",
        parentId: 2,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
      {
        id: 4,
        name: "Support",
        path: "",
        parentId: null,
        roles: [],
        effectiveRoles: ["ROLE_SUPPORT"],
        defaultGroup: true,
        userCount: 2,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminIdentityProviders).mockResolvedValue(
    page([
      {
        id: "provider-1",
        registrationId: "github",
        providerType: "oidc",
        displayName: "GitHub",
        alias: "github-login",
        enabled: false,
        configured: false,
        hideOnLogin: true,
        mapperCount: 0,
      },
      {
        id: "provider-2",
        registrationId: "empty-display",
        providerType: "saml",
        displayName: "",
        alias: "empty-display-alias",
        enabled: true,
        configured: true,
        hideOnLogin: false,
        mapperCount: 2,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue(
    page([
      {
        id: "session-1",
        username: "riley",
        createdAt: "2026-01-01",
        lastAccessedAt: "2026-01-02",
        expiresAt: "2026-01-03",
        authorizationCount: 0,
        active: false,
      },
    ]),
  );
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue(
    page([
      {
        clientId: "orders-app",
        clientName: "Orders App",
        principalName: "riley",
        userId: 17,
        authorities: [],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
      },
    ]),
  );
  jest.mocked(adminApi.listAdminKeys).mockResolvedValue(
    page([
      {
        id: "key-1",
        kid: "inactive-key",
        type: "RSA",
        algorithm: "RS256",
        use: "sig",
        active: false,
        createdAt: "2026-01-01",
      },
    ]),
  );
  jest.mocked(adminApi.listAdminEvents).mockResolvedValue(
    page([
      {
        id: "event-1",
        actor: "riley",
        action: "user.updated",
        targetType: "user",
        targetId: "17",
        details: "Updated profile fields",
        occurredAt: "2026-01-02",
      },
    ]),
  );

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await screen.findByText("2");
  const resources = [
    ["adminUsers", "disabled-user"],
    ["adminClients", "Orders App"],
    ["adminClientScopes", "orders.read"],
    ["adminRoles", "ROLE_AUDITOR"],
    ["adminGroups", "Operators"],
    ["adminIdentityProviders", "GitHub"],
    ["adminSessions", "riley"],
    ["adminConsents", "Orders App"],
    ["adminKeys", "inactive-key"],
    ["adminEvents", "user.updated"],
  ];
  for (const [tab, content] of resources) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(content)).toBeTruthy();
  }
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("minimal-user")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "adminClientScopes" }));
  expect(await screen.findByText("adminBuiltIn")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "adminGroups" }));
  expect(await screen.findByText("ROLE_SUPPORT")).toBeTruthy();
  expect(screen.getByText("Support")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "adminIdentityProviders" }));
  expect(await screen.findByText("empty-display-alias")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "adminEvents" }));
  expect(await screen.findByText("Updated profile fields")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  fireEvent.changeText(screen.getByLabelText("adminSearchUsers"), {
    target: { value: "disabled" },
  });
  await waitFor(() =>
    expect(adminApi.listAdminUsers).toHaveBeenCalledWith(
      "access",
      "disabled",
      0,
      10,
      expect.any(Object),
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "adminNext" }));
  await waitFor(() =>
    expect(adminApi.listAdminUsers).toHaveBeenCalledWith(
      "access",
      "disabled",
      1,
      10,
      expect.any(Object),
    ),
  );

  const paginatedResources = [
    [
      "adminUsers",
      "adminSearchUsers",
      adminApi.listAdminUsers,
      "disabled-user",
    ],
    [
      "adminClients",
      "adminSearchClients",
      adminApi.listAdminClients,
      "Orders App",
    ],
    [
      "adminClientScopes",
      "adminSearchClientScopes",
      adminApi.listAdminClientScopes,
      "orders.read",
    ],
    ["adminRoles", "adminSearchRoles", adminApi.listAdminRoles, "ROLE_AUDITOR"],
    ["adminGroups", "adminSearchGroups", adminApi.listAdminGroups, "Operators"],
    [
      "adminIdentityProviders",
      "adminSearchIdentityProviders",
      adminApi.listAdminIdentityProviders,
      "GitHub",
    ],
    [
      "adminSessions",
      "adminSearchSessions",
      adminApi.listAdminSessions,
      "riley",
    ],
    [
      "adminConsents",
      "adminSearchConsents",
      adminApi.listAdminConsents,
      "Orders App",
    ],
    ["adminKeys", "adminSearchKeys", adminApi.listAdminKeys, "inactive-key"],
    [
      "adminEvents",
      "adminSearchEvents",
      adminApi.listAdminEvents,
      "user.updated",
    ],
  ] as const;
  for (const [
    tab,
    searchLabel,
    listRequest,
    visibleRow,
  ] of paginatedResources) {
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(visibleRow)).toBeTruthy();
    const request = listRequest as jest.Mock;
    const searchCalls = request.mock.calls.length;
    fireEvent.changeText(screen.getByLabelText(searchLabel), {
      target: { value: "filter-term" },
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(searchCalls + 1));
    expect(JSON.stringify(request.mock.calls.at(-1))).toContain("filter-term");

    const nextCalls = request.mock.calls.length;
    request.mockResolvedValueOnce({
      ...(await request.mock.results.at(-1)?.value),
      number: 1,
      totalPages: 2,
    });
    fireEvent.press(screen.getByRole("button", { name: "adminNext" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(nextCalls + 1));
    const nextCall = JSON.stringify(request.mock.calls.at(-1));
    expect(nextCall.includes('"page":1') || nextCall.includes(",1,")).toBe(
      true,
    );

    const previousCalls = request.mock.calls.length;
    fireEvent.press(screen.getByRole("button", { name: "adminPrevious" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledTimes(previousCalls + 1),
    );
    const previousCall = JSON.stringify(request.mock.calls.at(-1));
    expect(
      previousCall.includes('"page":0') || previousCall.includes(",0,"),
    ).toBe(true);
    const { mockRefreshSession } = jest.requireMock(
      "@/auth/MobileAuthProvider",
    );
    mockRefreshSession.mockResolvedValueOnce(null);
    await expect(
      refreshTokenFromCall(request.mock.calls.at(-1)),
    ).resolves.toBeNull();
  }
});

it("creates a mobile admin user after validating the required password", async () => {
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 7,
        username: "alice",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.test",
        enabled: true,
        locked: false,
        effectiveRoles: ["ROLE_USER"],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("alice")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminCreate" }));
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  expect(screen.getByText("adminPasswordValidation")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "bob" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminPassword"), {
    target: { value: "a-long-password" },
  });
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  await waitFor(() =>
    expect(adminApi.createAdminUser).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ username: "bob", password: "a-long-password" }),
      expect.any(Object),
    ),
  );
  await expect(
    refreshTokenFromCall(adminApi.createAdminUser.mock.calls.at(-1)),
  ).resolves.toBe("access");
});

it("shows field-level email errors and clears them when the value changes", async () => {
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  await waitFor(() => expect(adminApi.listAdminUsers).toHaveBeenCalled());
  fireEvent.press(screen.getByRole("button", { name: "adminCreate" }));
  fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "mobile-admin" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminPassword"), {
    target: { value: "a-valid-password" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminEmail"), {
    target: { value: "invalid-address" },
  });
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  expect(await screen.findByText("invalidEmail")).toBeTruthy();
  expect(adminApi.createAdminUser).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByPlaceholderText("adminEmail"), {
    target: { value: "admin@example.test" },
  });
  await waitFor(() => expect(screen.queryByText("invalidEmail")).toBeNull());
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  await waitFor(() => expect(adminApi.createAdminUser).toHaveBeenCalled());
});

it("hydrates an existing user editor and prevents duplicate saves while pending", async () => {
  const user = {
    id: 12,
    username: "locked-user",
    firstName: "Taylor",
    lastName: "Jones",
    email: null,
    enabled: false,
    locked: true,
    effectiveRoles: ["ROLE_ADMIN", "ROLE_USER"],
  };
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [user],
    totalElements: 1,
    totalPages: 1,
  });
  let completeUpdate!: () => void;
  jest.mocked(adminApi.updateAdminUser).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeUpdate = resolve;
      }),
  );

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("locked-user")).toBeTruthy();
  expect(screen.getByText("Taylor Jones")).toBeTruthy();
  expect(screen.getByText("adminUserLocked")).toBeTruthy();
  expect(screen.getByText("adminUserDisabled")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminEdit" }));

  expect(screen.getByPlaceholderText("adminUsername").props.value).toBe(
    "locked-user",
  );
  expect(screen.getByPlaceholderText("adminEmail").props.value).toBe("");
  expect(screen.getByPlaceholderText("adminRolesInput").props.value).toBe(
    "ROLE_ADMIN,ROLE_USER",
  );
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  const saveButton = screen.getByRole("button", { name: "adminSave" });
  await waitFor(() =>
    expect(saveButton.props.accessibilityState.disabled).toBe(true),
  );
  expect(screen.getByLabelText("Loading")).toBeTruthy();
  fireEvent.press(saveButton);
  expect(adminApi.updateAdminUser).toHaveBeenCalledTimes(1);
  expect(adminApi.updateAdminUser).toHaveBeenCalledWith(
    "access",
    12,
    expect.objectContaining({
      username: "locked-user",
      email: null,
      roles: ["ROLE_ADMIN", "ROLE_USER"],
    }),
    expect.any(Object),
  );
  await expect(
    refreshTokenFromCall(adminApi.updateAdminUser.mock.calls.at(-1)),
  ).resolves.toBe("access");

  await act(async () => completeUpdate());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "adminSave" })).toBeNull(),
  );
});

it("creates each native admin resource through its typed editor flow", async () => {
  const scenarios = [
    {
      tab: "adminClients",
      values: [
        ["adminClientId", "mobile-client"],
        ["adminClientName", "Mobile client"],
      ],
      mutation: adminApi.createAdminClient,
    },
    {
      tab: "adminClientScopes",
      values: [["adminName", "mobile.read"]],
      mutation: adminApi.createAdminClientScope,
    },
    {
      tab: "adminRoles",
      values: [["adminName", "ROLE_MOBILE"]],
      mutation: adminApi.createAdminRole,
    },
    {
      tab: "adminGroups",
      values: [["adminName", "Mobile Operators"]],
      mutation: adminApi.createAdminGroup,
    },
    {
      tab: "adminIdentityProviders",
      values: [
        ["adminProviderRegistrationId", "mobile-idp"],
        ["adminDisplayName", "Mobile IdP"],
        ["adminProviderAlias", "mobile-login"],
      ],
      mutation: adminApi.createAdminIdentityProvider,
    },
  ] as const;

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    fireEvent.press(await screen.findByRole("button", { name: "adminCreate" }));
    for (const [label, value] of scenario.values) {
      fireEvent.changeText(screen.getByPlaceholderText(label), {
        target: { value },
      });
    }
    fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
    await waitFor(() => expect(scenario.mutation).toHaveBeenCalledTimes(1));
    await expect(
      refreshTokenFromCall(scenario.mutation.mock.calls.at(-1)),
    ).resolves.toBe("access");
    const { mockRefreshSession } = jest.requireMock(
      "@/auth/MobileAuthProvider",
    );
    mockRefreshSession.mockResolvedValueOnce(null);
    await expect(
      refreshTokenFromCall(scenario.mutation.mock.calls.at(-1)),
    ).resolves.toBeNull();
    await waitFor(() => expect(screen.queryByText("adminSave")).toBeNull());
  }
});

it("shows distinct role and parent validation messages in admin editors", async () => {
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  fireEvent.press(await screen.findByRole("button", { name: "adminCreate" }));
  fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "roleless-user" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminPassword"), {
    target: { value: "valid-long-password" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminRolesInput"), {
    target: { value: "" },
  });
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  expect(await screen.findByText("adminUserRoleRequired")).toBeTruthy();
  expect(adminApi.createAdminUser).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "cancel" }));
  fireEvent.press(screen.getByRole("tab", { name: "adminRoles" }));
  fireEvent.press(await screen.findByRole("button", { name: "adminCreate" }));
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  expect(await screen.findByText("adminRoleNameFormat")).toBeTruthy();
  expect(adminApi.createAdminRole).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "cancel" }));
  fireEvent.press(screen.getByRole("tab", { name: "adminGroups" }));
  fireEvent.press(await screen.findByRole("button", { name: "adminCreate" }));
  fireEvent.changeText(screen.getByPlaceholderText("adminName"), {
    target: { value: "Mobile Operators" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminParentId"), {
    target: { value: "1.5" },
  });
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  expect(await screen.findByText("adminRequired")).toBeTruthy();
  expect(adminApi.createAdminGroup).not.toHaveBeenCalled();
});

it("hydrates and updates each editable native admin resource", async () => {
  const page = <T,>(content: T[]) => ({
    ...emptyPage,
    content,
    totalElements: content.length,
    totalPages: 1,
  });
  const scenarios = [
    {
      tab: "adminClients",
      name: "Orders Client",
      list: adminApi.listAdminClients,
      update: adminApi.updateAdminClient,
      item: {
        id: "client-22",
        clientId: "orders-client",
        clientName: "Orders Client",
        scopes: ["openid", "profile"],
        enabled: true,
        serviceAccountEnabled: false,
      },
      expectedId: "client-22",
    },
    {
      tab: "adminClientScopes",
      name: "orders.read",
      list: adminApi.listAdminClientScopes,
      update: adminApi.updateAdminClientScope,
      item: {
        id: "scope-22",
        name: "orders.read",
        displayName: "Orders read",
        description: "Read order data",
        builtIn: false,
        displayOnConsentScreen: true,
        includeInTokenScope: true,
      },
      expectedId: "scope-22",
    },
    {
      tab: "adminRoles",
      name: "ROLE_ORDERS",
      list: adminApi.listAdminRoles,
      update: adminApi.updateAdminRole,
      item: { name: "ROLE_ORDERS", description: "Orders access" },
      expectedId: "ROLE_ORDERS",
    },
    {
      tab: "adminGroups",
      name: "Order Operators",
      list: adminApi.listAdminGroups,
      update: adminApi.updateAdminGroup,
      item: {
        id: 22,
        name: "Order Operators",
        path: "/Operations/Order Operators",
        parentId: 2,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
      expectedId: 22,
    },
    {
      tab: "adminIdentityProviders",
      name: "GitHub Enterprise",
      list: adminApi.listAdminIdentityProviders,
      update: adminApi.updateAdminIdentityProvider,
      item: {
        id: "provider-22",
        registrationId: "github-enterprise",
        providerType: "oidc",
        displayName: "GitHub Enterprise",
        alias: "github-enterprise",
        enabled: true,
        configured: true,
        hideOnLogin: false,
        mapperCount: 1,
      },
      expectedId: "provider-22",
    },
  ] as const;
  for (const scenario of scenarios) {
    jest.mocked(scenario.list).mockResolvedValue(page([scenario.item]));
  }

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.name)).toBeTruthy();
    fireEvent.press(await screen.findByRole("button", { name: "adminEdit" }));
    fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
    await waitFor(() =>
      expect(scenario.update).toHaveBeenCalledWith(
        "access",
        scenario.expectedId,
        expect.any(Object),
        expect.any(Object),
      ),
    );
    await expect(
      refreshTokenFromCall(scenario.update.mock.calls.at(-1)),
    ).resolves.toBe("access");
    await waitFor(() => expect(screen.queryByText("adminSave")).toBeNull());
  }
});

it("keeps client, role, and group editors open after update failures", async () => {
  const page = <T,>(content: T[]) => ({
    ...emptyPage,
    content,
    totalElements: content.length,
    totalPages: 1,
  });
  const scenarios = [
    {
      tab: "adminClients",
      row: "Update Client",
      list: adminApi.listAdminClients,
      update: adminApi.updateAdminClient,
      item: {
        id: "client-update-failure",
        clientId: "update-client",
        clientName: "Update Client",
        scopes: ["openid"],
        enabled: true,
        serviceAccountEnabled: false,
      },
      expectedId: "client-update-failure",
    },
    {
      tab: "adminRoles",
      row: "ROLE_UPDATE_FAILURE",
      list: adminApi.listAdminRoles,
      update: adminApi.updateAdminRole,
      item: { name: "ROLE_UPDATE_FAILURE", description: "" },
      expectedId: "ROLE_UPDATE_FAILURE",
    },
    {
      tab: "adminGroups",
      row: "Update Operators",
      list: adminApi.listAdminGroups,
      update: adminApi.updateAdminGroup,
      item: {
        id: 73,
        name: "Update Operators",
        path: "/Update Operators",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
      expectedId: 73,
    },
  ] as const;
  for (const scenario of scenarios) {
    jest.mocked(scenario.list).mockResolvedValue(page([scenario.item]));
    jest.mocked(scenario.update).mockRejectedValueOnce(new Error("offline"));
  }

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    fireEvent.press(await screen.findByRole("button", { name: "adminEdit" }));
    expect(screen.getByRole("button", { name: "adminSave" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

    await waitFor(() =>
      expect(scenario.update).toHaveBeenCalledWith(
        "access",
        scenario.expectedId,
        expect.any(Object),
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: "adminActionError",
      }),
    );
    expect(screen.getByRole("button", { name: "adminSave" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "cancel" }));
  }
});

it("confirms role and group deletion and reports failures", async () => {
  const alert = jest.mocked(Alert.alert);
  jest.mocked(adminApi.listAdminRoles).mockResolvedValue({
    ...emptyPage,
    content: [{ name: "ROLE_REMOVE", description: "" }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminGroups).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 74,
        name: "Remove Operators",
        path: "/Remove Operators",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.deleteAdminRole).mockRejectedValueOnce(
    new adminApi.AdminApiError(403),
  );
  jest.mocked(adminApi.deleteAdminGroup).mockRejectedValueOnce(
    new Error("offline"),
  );

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  const cases = [
    {
      tab: "adminRoles",
      row: "ROLE_REMOVE",
      remove: adminApi.deleteAdminRole,
      expectedError: "adminForbidden",
    },
    {
      tab: "adminGroups",
      row: "Remove Operators",
      remove: adminApi.deleteAdminGroup,
      expectedError: "adminActionError",
    },
  ] as const;

  for (const scenario of cases) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    fireEvent.press(await screen.findByRole("button", { name: "adminDelete" }));
    const actions = alert.mock.calls.at(-1)?.[2];
    expect(actions?.[0]).toMatchObject({ text: "cancel", style: "cancel" });
    const confirm = actions?.find((action) => action.style === "destructive");
    expect(confirm).toBeTruthy();
    await act(async () => confirm?.onPress?.());
    await waitFor(() =>
      expect(scenario.remove).toHaveBeenCalledWith(
        "access",
        scenario.tab === "adminRoles" ? "ROLE_REMOVE" : 74,
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: scenario.expectedError,
      }),
    );
  }
});

it("enables and unlocks users and rotates signing keys", async () => {
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 17,
        username: "locked-user",
        firstName: "Riley",
        lastName: "Smith",
        email: null,
        enabled: false,
        locked: true,
        effectiveRoles: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminKeys).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: "key-1",
        kid: "active-key",
        type: "RSA",
        algorithm: "RS256",
        use: "sig",
        active: true,
        createdAt: "2026-01-01",
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("locked-user")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminUserEnable" }));
  await waitFor(() =>
    expect(adminApi.setAdminUserEnabled).toHaveBeenCalledWith(
      "access",
      17,
      true,
      expect.any(Object),
    ),
  );
  await expectRefreshCallbackHandlesExpiredSession(
    adminApi.setAdminUserEnabled.mock.calls.at(-1),
  );
  fireEvent.press(screen.getByRole("button", { name: "adminUserUnlock" }));
  await waitFor(() =>
    expect(adminApi.unlockAdminUser).toHaveBeenCalledWith(
      "access",
      17,
      expect.any(Object),
    ),
  );
  await expectRefreshCallbackHandlesExpiredSession(
    adminApi.unlockAdminUser.mock.calls.at(-1),
  );

  fireEvent.press(screen.getByRole("tab", { name: "adminKeys" }));
  expect(await screen.findByText("active-key")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminRotateKey" }));
  await waitFor(() =>
    expect(adminApi.rotateAdminKey).toHaveBeenCalledWith(
      "access",
      expect.any(Object),
    ),
  );
  await expectRefreshCallbackHandlesExpiredSession(
    adminApi.rotateAdminKey.mock.calls.at(-1),
  );
});

it.each([
  ["enable", adminApi.setAdminUserEnabled, "adminUserEnable"],
  ["unlock", adminApi.unlockAdminUser, "adminUserUnlock"],
] as const)("shows a generic action error when user %s fails", async (_action, request, button) => {
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 18,
        username: "action-error-user",
        firstName: "Action",
        lastName: "Error",
        email: null,
        enabled: false,
        locked: true,
        effectiveRoles: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(request).mockRejectedValueOnce(new Error("offline"));

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("action-error-user")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: button }));

  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "adminUserActionError",
  });
});

it("confirms and deletes native resources from their mobile resource lists", async () => {
  const page = <T,>(content: T[]) => ({
    ...emptyPage,
    content,
    totalElements: content.length,
    totalPages: 1,
  });
  const scenarios = [
    {
      tab: "adminClients",
      name: "Delete Client",
      list: adminApi.listAdminClients,
      remove: adminApi.deleteAdminClient,
      item: {
        id: "client-delete",
        clientId: "delete-client",
        clientName: "Delete Client",
        scopes: [],
        enabled: true,
        serviceAccountEnabled: false,
      },
      id: "client-delete",
    },
    {
      tab: "adminClientScopes",
      name: "delete.scope",
      list: adminApi.listAdminClientScopes,
      remove: adminApi.deleteAdminClientScope,
      item: {
        id: "scope-delete",
        name: "delete.scope",
        displayName: null,
        description: null,
        builtIn: false,
        displayOnConsentScreen: false,
        includeInTokenScope: false,
      },
      id: "scope-delete",
    },
    {
      tab: "adminRoles",
      name: "ROLE_DELETE",
      list: adminApi.listAdminRoles,
      remove: adminApi.deleteAdminRole,
      item: { name: "ROLE_DELETE", description: null },
      id: "ROLE_DELETE",
    },
    {
      tab: "adminGroups",
      name: "Delete Operators",
      list: adminApi.listAdminGroups,
      remove: adminApi.deleteAdminGroup,
      item: {
        id: 42,
        name: "Delete Operators",
        path: "/Delete Operators",
        parentId: null,
        roles: [],
        effectiveRoles: [],
        defaultGroup: false,
        userCount: 0,
      },
      id: 42,
    },
    {
      tab: "adminIdentityProviders",
      name: "Delete Provider",
      list: adminApi.listAdminIdentityProviders,
      remove: adminApi.deleteAdminIdentityProvider,
      item: {
        id: "provider-delete",
        registrationId: "delete-provider",
        providerType: "oidc",
        displayName: "Delete Provider",
        alias: "delete-provider",
        enabled: true,
        configured: true,
        hideOnLogin: false,
        mapperCount: 0,
      },
      id: "provider-delete",
    },
  ] as const;
  for (const scenario of scenarios) {
    jest.mocked(scenario.list).mockResolvedValue(page([scenario.item]));
  }

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.name)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "adminDelete" }));
    const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const confirm = actions?.find((action) => action.style === "destructive");
    expect(confirm?.onPress).toBeDefined();
    await act(async () => confirm?.onPress?.());
    await waitFor(() =>
      expect(scenario.remove).toHaveBeenCalledWith(
        "access",
        scenario.id,
        expect.any(Object),
      ),
    );
    await expectRefreshCallbackHandlesExpiredSession(
      scenario.remove.mock.calls.at(-1),
    );
  }
});

it("deletes mobile users, events, sessions, and consent through confirmed actions", async () => {
  const alert = jest.mocked(Alert.alert);
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 53,
        username: "remove-user",
        firstName: "Remove",
        lastName: "User",
        email: null,
        enabled: true,
        locked: false,
        effectiveRoles: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminEvents).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: "event-remove",
        actor: "admin",
        action: "user.removed",
        targetType: "user",
        targetId: "53",
        details: null,
        occurredAt: "2026-05-01",
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: "session-remove",
        username: "remove-user",
        createdAt: "2026-05-01",
        lastAccessedAt: "2026-05-02",
        expiresAt: "2026-06-01",
        authorizationCount: 1,
        active: true,
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        clientId: "mobile-client",
        clientName: "Mobile Client",
        principalName: "remove-user",
        userId: 53,
        authorities: ["profile"],
        createdAt: "2026-05-01",
        updatedAt: "2026-05-02",
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });

  const scenarios = [
    {
      tab: "adminUsers",
      row: "remove-user",
      action: "adminUserDelete",
      remove: adminApi.deleteAdminUser,
      id: 53,
    },
    {
      tab: "adminEvents",
      row: "user.removed",
      action: "adminDeleteEvents",
      remove: adminApi.deleteAdminEvents,
      id: undefined,
    },
    {
      tab: "adminSessions",
      row: "2026-05-02",
      action: "adminSessionDelete",
      remove: adminApi.deleteAdminSession,
      id: "session-remove",
    },
    {
      tab: "adminConsents",
      row: "Mobile Client",
      action: "adminConsentRevoke",
      remove: adminApi.revokeAdminConsent,
      id: undefined,
    },
  ] as const;

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const scenario of scenarios) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: scenario.action }));
    const actions = alert.mock.calls.at(-1)?.[2];
    const confirm = actions?.find((action) => action.style === "destructive");
    expect(confirm?.onPress).toBeDefined();
    await act(async () => confirm?.onPress?.());
    await waitFor(() => expect(scenario.remove).toHaveBeenCalled());
    await expectRefreshCallbackHandlesExpiredSession(
      scenario.remove.mock.calls.at(-1),
    );
  }

  expect(adminApi.deleteAdminUser).toHaveBeenCalledWith(
    "access",
    53,
    expect.any(Object),
  );
  expect(adminApi.deleteAdminEvents).toHaveBeenCalledWith(
    "access",
    expect.any(Object),
  );
  expect(adminApi.deleteAdminSession).toHaveBeenCalledWith(
    "access",
    "session-remove",
    expect.any(Object),
  );
  expect(adminApi.revokeAdminConsent).toHaveBeenCalledWith(
    "access",
    "mobile-client",
    "remove-user",
    expect.any(Object),
  );
});

it("reports forbidden and unexpected failures from destructive admin actions", async () => {
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: 53,
        username: "remove-user",
        firstName: "Remove",
        lastName: "User",
        email: null,
        enabled: true,
        locked: false,
        effectiveRoles: [],
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminKeys).mockResolvedValue({
    ...emptyPage,
    content: [
      {
        id: "key-1",
        kid: "active-key",
        type: "RSA",
        algorithm: "RS256",
        use: "sig",
        active: true,
        createdAt: "2026-01-01",
      },
    ],
    totalElements: 1,
    totalPages: 1,
  });
  const forbidden = new adminApi.AdminApiError(403);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("remove-user")).toBeTruthy();
  jest.mocked(adminApi.deleteAdminUser).mockRejectedValueOnce(forbidden);
  fireEvent.press(screen.getByRole("button", { name: "adminUserDelete" }));
  await act(async () => {
    jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)?.[2]
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminForbidden",
    }),
  );

  jest
    .mocked(adminApi.deleteAdminUser)
    .mockRejectedValueOnce(new Error("offline"));
  fireEvent.press(screen.getByRole("button", { name: "adminUserDelete" }));
  await act(async () => {
    jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)?.[2]
      ?.find((action) => action.style === "destructive")
      ?.onPress?.();
  });
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminUserActionError",
    }),
  );

  fireEvent.press(screen.getByRole("tab", { name: "adminKeys" }));
  expect(await screen.findByText("active-key")).toBeTruthy();
  jest.mocked(adminApi.rotateAdminKey).mockRejectedValueOnce(forbidden);
  fireEvent.press(screen.getByRole("button", { name: "adminRotateKey" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminForbidden",
    }),
  );
});

it("maps forbidden responses across admin selections and actions", async () => {
  const alert = jest.mocked(Alert.alert);
  const forbidden = new adminApi.AdminApiError(403);
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: 54,
      username: "restricted-user",
      firstName: "Restricted",
      lastName: "User",
      email: null,
      enabled: true,
      locked: true,
      effectiveRoles: [],
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminClients).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "restricted-client",
      clientId: "restricted-client",
      clientName: "Restricted Client",
      scopes: [],
      enabled: true,
      serviceAccountEnabled: false,
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminEvents).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "restricted-event",
      actor: "admin",
      action: "user.updated",
      targetType: "user",
      targetId: "54",
      details: null,
      occurredAt: "2026-05-01",
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "restricted-session",
      username: "restricted-user",
      createdAt: "2026-05-01",
      lastAccessedAt: "2026-05-02",
      expiresAt: "2026-06-01",
      authorizationCount: 1,
      active: true,
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue({
    ...emptyPage,
    content: [{
      clientId: "restricted-client",
      clientName: "Restricted Client",
      principalName: "restricted-user",
      userId: 54,
      authorities: ["profile"],
      createdAt: "2026-05-01",
      updatedAt: "2026-05-02",
    }],
    totalElements: 1,
    totalPages: 1,
  });

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  const directActions = [
    {
      tab: "adminUsers",
      row: "restricted-user",
      action: "adminUserDisable",
      request: adminApi.setAdminUserEnabled,
    },
    {
      tab: "adminUsers",
      row: "restricted-user",
      action: "adminUserUnlock",
      request: adminApi.unlockAdminUser,
    },
  ] as const;
  for (const scenario of directActions) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    jest.mocked(scenario.request).mockRejectedValueOnce(forbidden);
    fireEvent.press(screen.getByRole("button", { name: scenario.action }));
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: "adminForbidden",
      }),
    );
  }

  const confirmedActions = [
    {
      tab: "adminClients",
      row: "Restricted Client",
      action: "adminDelete",
      request: adminApi.deleteAdminClient,
    },
    {
      tab: "adminEvents",
      row: "user.updated",
      action: "adminDeleteEvents",
      request: adminApi.deleteAdminEvents,
    },
    {
      tab: "adminSessions",
      row: "2026-05-02",
      action: "adminSessionDelete",
      request: adminApi.deleteAdminSession,
    },
    {
      tab: "adminConsents",
      row: "Restricted Client",
      action: "adminConsentRevoke",
      request: adminApi.revokeAdminConsent,
    },
  ] as const;
  for (const scenario of confirmedActions) {
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    jest.mocked(scenario.request).mockRejectedValueOnce(forbidden);
    fireEvent.press(screen.getByRole("button", { name: scenario.action }));
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(
      (button) => button.style === "destructive",
    );
    await act(async () => confirm?.onPress?.());
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: "adminForbidden",
      }),
    );
  }
});

it("shows a loading state while each admin table is waiting for its first page", async () => {
  const tables = [
    ["users", adminApi.listAdminUsers, "adminNoUsers"],
    ["clients", adminApi.listAdminClients, "adminNoClients"],
    ["scopes", adminApi.listAdminClientScopes, "adminNoClientScopes"],
    ["roles", adminApi.listAdminRoles, "adminNoRoles"],
    ["groups", adminApi.listAdminGroups, "adminNoGroups"],
    [
      "identity-providers",
      adminApi.listAdminIdentityProviders,
      "adminNoIdentityProviders",
    ],
    ["keys", adminApi.listAdminKeys, "adminNoKeys"],
    ["events", adminApi.listAdminEvents, "adminNoEvents"],
    ["sessions", adminApi.listAdminSessions, "adminNoSessions"],
    ["consents", adminApi.listAdminConsents, "adminNoConsents"],
  ] as const;

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  for (const [section, listRequest, emptyMessage] of tables) {
    let finishRequest!: (page: typeof emptyPage) => void;
    const pendingPage = new Promise<typeof emptyPage>((resolve) => {
      finishRequest = resolve;
    });
    const request = listRequest as jest.Mock;
    request.mockImplementationOnce(() => pendingPage);

    fireEvent.press(screen.getByTestId(`admin-tab-${section}`));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.getByLabelText("loading")).toBeTruthy();

    await act(async () => finishRequest(emptyPage));
    expect(await screen.findByText(emptyMessage)).toBeTruthy();
  }
});

it("shows and clears a field-level validation error returned by the admin API", async () => {
  const serverError = Object.assign(new adminApi.AdminApiError(400), {
    problem: {
      violations: [{ field: "username", message: "username already exists" }],
    },
  });
  jest.mocked(adminApi.createAdminUser).mockRejectedValueOnce(serverError);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  await waitFor(() => expect(adminApi.listAdminUsers).toHaveBeenCalled());
  fireEvent.press(screen.getByRole("button", { name: "adminCreate" }));
  fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "existing-user" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("adminPassword"), {
    target: { value: "a-valid-password" },
  });
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  expect(await screen.findByText("username already exists")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "new-user" },
  });
  await waitFor(() =>
    expect(screen.queryByText("username already exists")).toBeNull(),
  );
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [
    Object.assign(new adminApi.AdminApiError(400), {
      problem: { violations: [] },
    }),
    "adminActionError",
  ],
  [new Error("unexpected save failure"), "adminActionError"],
] as const)(
  "keeps the user editor open and reports save failures: %s",
  async (failure, message) => {
    jest.mocked(adminApi.createAdminUser).mockRejectedValueOnce(failure);

    render(<AdminScreen />);
    await screen.findByTestId("admin-tab-dashboard");
    fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
    fireEvent.press(
      await screen.findByRole("button", { name: "adminCreate" }),
    );
    fireEvent.changeText(screen.getByPlaceholderText("adminUsername"), {
      target: { value: "save-failure-user" },
    });
    fireEvent.changeText(screen.getByPlaceholderText("adminPassword"), {
      target: { value: "a-valid-password" },
    });
    fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message }),
    );
    expect(screen.getByPlaceholderText("adminUsername")).toBeTruthy();
  },
);

it("cancels a new admin resource editor and returns to the empty list", async () => {
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  fireEvent.press(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("adminNoUsers")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminCreate" }));
  expect(screen.getByPlaceholderText("adminUsername")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "cancel" }));

  expect(screen.queryByPlaceholderText("adminUsername")).toBeNull();
  expect(screen.getByText("adminNoUsers")).toBeTruthy();
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [Object.assign(new adminApi.AdminApiError(0), { kind: "offline" }), "adminEventSettingsOfflineError"],
  [Object.assign(new adminApi.AdminApiError(0), { kind: "timeout" }), "adminEventSettingsTimeoutError"],
  [new Error("settings update failed"), "adminEventSettingsSaveError"],
] as const)("localizes event settings save failures as %s", async (failure, message) => {
  jest.mocked(adminApi.updateAdminEventSettings).mockRejectedValue(failure);

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await screen.findByText("adminEventSettingsTitle")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message,
    }),
  );
});

it("reports denied and unexpected errors from event, session, and consent actions", async () => {
  jest.mocked(adminApi.listAdminEvents).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "event-delete-error",
      actor: "admin",
      action: "user.removed",
      targetType: "user",
      targetId: "53",
      details: null,
      occurredAt: "2026-05-01",
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "session-delete-error",
      username: "remove-user",
      createdAt: "2026-05-01",
      lastAccessedAt: "2026-05-02",
      expiresAt: "2026-06-01",
      authorizationCount: 1,
      active: true,
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue({
    ...emptyPage,
    content: [{
      clientId: "mobile-client",
      clientName: "Mobile Client",
      principalName: "remove-user",
      userId: 53,
      authorities: ["profile"],
      createdAt: "2026-05-01",
      updatedAt: "2026-05-02",
    }],
    totalElements: 1,
    totalPages: 1,
  });
  const denied = new adminApi.AdminApiError(403);
  const scenarios = [
    {
      tab: "adminEvents",
      row: "user.removed",
      action: "adminDeleteEvents",
      request: adminApi.deleteAdminEvents,
      fallbackMessage: "adminActionError",
    },
    {
      tab: "adminSessions",
      row: "2026-05-02",
      action: "adminSessionDelete",
      request: adminApi.deleteAdminSession,
      fallbackMessage: "adminSessionActionError",
    },
    {
      tab: "adminConsents",
      row: "Mobile Client",
      action: "adminConsentRevoke",
      request: adminApi.revokeAdminConsent,
      fallbackMessage: "adminConsentActionError",
    },
  ] as const;
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  for (const scenario of scenarios) {
    jest.mocked(scenario.request).mockRejectedValueOnce(denied);
    jest.mocked(scenario.request).mockRejectedValueOnce(new Error("offline"));
    fireEvent.press(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeTruthy();
    for (const message of ["adminForbidden", scenario.fallbackMessage]) {
      fireEvent.press(screen.getByRole("button", { name: scenario.action }));
      const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
      const confirm = buttons?.find((button) => button.style === "destructive");
      await act(async () => confirm?.onPress?.());
      await waitFor(() =>
        expect(mockShowNotice).toHaveBeenLastCalledWith({
          kind: "error",
          message,
        }),
      );
    }
  }
});

it("fails safely when the session expires before admin mutations", async () => {
  const { mockRefreshSession } = jest.requireMock(
    "@/auth/MobileAuthProvider",
  );
  jest.mocked(adminApi.listAdminUsers).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: 71,
      username: "locked-user",
      firstName: "Locked",
      lastName: "User",
      email: null,
      enabled: true,
      locked: true,
      effectiveRoles: [],
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminEvents).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "event-expired-session",
      actor: "admin",
      action: "user.updated",
      targetType: "user",
      targetId: "71",
      details: null,
      occurredAt: "2026-05-01",
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminSessions).mockResolvedValue({
    ...emptyPage,
    content: [{
      id: "session-expired-token",
      username: "locked-user",
      createdAt: "2026-05-01",
      lastAccessedAt: "2026-05-02",
      expiresAt: "2026-06-01",
      authorizationCount: 1,
      active: true,
    }],
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(adminApi.listAdminConsents).mockResolvedValue({
    ...emptyPage,
    content: [{
      clientId: "expired-session-client",
      clientName: "Expired Session Client",
      principalName: "locked-user",
      userId: 71,
      authorities: ["profile"],
      createdAt: "2026-05-01",
      updatedAt: "2026-05-02",
    }],
    totalElements: 1,
    totalPages: 1,
  });

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");

  const failures = [
    {
      tab: "adminUsers",
      row: "locked-user",
      action: "adminUserUnlock",
      expectedNotice: "adminUserActionError",
      invoke: () => fireEvent.press(screen.getByRole("button", { name: "adminUserUnlock" })),
    },
    {
      tab: "adminUsers",
      row: "locked-user",
      action: "adminUserDisable",
      expectedNotice: "adminUserActionError",
      invoke: () => fireEvent.press(screen.getByRole("button", { name: "adminUserDisable" })),
    },
  ];
  for (const failure of failures) {
    fireEvent.press(screen.getByRole("tab", { name: failure.tab }));
    expect(await screen.findByText(failure.row)).toBeTruthy();
    mockRefreshSession.mockResolvedValueOnce(null);
    failure.invoke();
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: failure.expectedNotice,
      }),
    );
  }

  await act(async () => {
    fireEvent.press(screen.getByRole("tab", { name: "adminSettings" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "adminSave" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminEventSettingsSaveError",
    }),
  );

  const confirmedActions = [
    {
      tab: "adminEvents",
      row: "user.updated",
      action: "adminDeleteEvents",
      message: "adminActionError",
    },
    {
      tab: "adminSessions",
      row: "2026-05-02",
      action: "adminSessionDelete",
      message: "adminSessionActionError",
    },
    {
      tab: "adminConsents",
      row: "Expired Session Client",
      action: "adminConsentRevoke",
      message: "adminConsentActionError",
    },
  ] as const;
  for (const action of confirmedActions) {
    fireEvent.press(screen.getByRole("tab", { name: action.tab }));
    expect(await screen.findByText(action.row)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: action.action }));
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const confirm = buttons?.find((button) => button.style === "destructive");
    mockRefreshSession.mockResolvedValueOnce(null);
    await act(async () => confirm?.onPress?.());
    await waitFor(() =>
      expect(mockShowNotice).toHaveBeenLastCalledWith({
        kind: "error",
        message: action.message,
      }),
    );
  }

  expect(adminApi.unlockAdminUser).not.toHaveBeenCalled();
  expect(adminApi.setAdminUserEnabled).not.toHaveBeenCalled();
  expect(adminApi.updateAdminEventSettings).not.toHaveBeenCalled();
});

it("does not request admin table data after the session refresh expires", async () => {
  const { mockRefreshSession } = jest.requireMock(
    "@/auth/MobileAuthProvider",
  );
  const resources = [
    ["adminUsers", adminApi.listAdminUsers, "adminNoUsers"],
    ["adminClients", adminApi.listAdminClients, "adminNoClients"],
    ["adminClientScopes", adminApi.listAdminClientScopes, "adminNoClientScopes"],
    ["adminRoles", adminApi.listAdminRoles, "adminNoRoles"],
    ["adminGroups", adminApi.listAdminGroups, "adminNoGroups"],
    [
      "adminIdentityProviders",
      adminApi.listAdminIdentityProviders,
      "adminNoIdentityProviders",
    ],
    ["adminSessions", adminApi.listAdminSessions, "adminNoSessions"],
    ["adminConsents", adminApi.listAdminConsents, "adminNoConsents"],
    ["adminKeys", adminApi.listAdminKeys, "adminNoKeys"],
    ["adminEvents", adminApi.listAdminEvents, "adminNoEvents"],
  ] as const;

  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  for (const [tab, request, emptyMessage] of resources) {
    const callCount = jest.mocked(request).mock.calls.length;
    mockRefreshSession.mockResolvedValueOnce(null);
    fireEvent.press(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(emptyMessage)).toBeTruthy();
    expect(jest.mocked(request)).toHaveBeenCalledTimes(callCount);
  }
});
