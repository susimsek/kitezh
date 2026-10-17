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
    const mockAuthState = {
      session,
      signIn: jest.fn(),
      signOut: jest.fn(),
      status: "signed-in",
      refreshSession: async () => session,
    };
    return {
      mockAuthState,
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  mockAuthState.session = { accessToken: "access" };
  mockAuthState.status = "signed-in";
  jest.mocked(adminApi.getAdminDashboard).mockResolvedValue({
    clients: 2,
    users: 3,
    sessions: 4,
    consents: 5,
  });
  for (const request of Object.values(adminApi)) {
    if (typeof request === "function" && "mockResolvedValue" in request) {
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
  expect(await screen.findByTestId("admin-tab-users")).toBeTruthy();
  expect(screen.queryByTestId("admin-tab-dashboard")).toBeNull();
  expect(screen.queryByTestId("admin-tab-clients")).toBeNull();
  fireEvent.press(screen.getByTestId("admin-tab-users"));
  expect(await screen.findByText("read-only-user")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "adminCreate" })).toBeNull();
  expect(screen.queryByRole("button", { name: "adminEdit" })).toBeNull();
  expect(screen.queryByRole("button", { name: "adminUserDelete" })).toBeNull();
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
  render(<AdminScreen />);
  await screen.findByTestId("admin-tab-dashboard");
  await screen.findByText("2");
  await expect(
    refreshTokenFromCall(adminApi.getAdminDashboard.mock.calls.at(-1)),
  ).resolves.toBe("access");

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
        details: null,
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
    await waitFor(() => expect(screen.queryByText("adminSave")).toBeNull());
  }
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
  await expect(
    refreshTokenFromCall(adminApi.setAdminUserEnabled.mock.calls.at(-1)),
  ).resolves.toBe("access");
  fireEvent.press(screen.getByRole("button", { name: "adminUserUnlock" }));
  await waitFor(() =>
    expect(adminApi.unlockAdminUser).toHaveBeenCalledWith(
      "access",
      17,
      expect.any(Object),
    ),
  );
  await expect(
    refreshTokenFromCall(adminApi.unlockAdminUser.mock.calls.at(-1)),
  ).resolves.toBe("access");

  fireEvent.press(screen.getByRole("tab", { name: "adminKeys" }));
  expect(await screen.findByText("active-key")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminRotateKey" }));
  await waitFor(() =>
    expect(adminApi.rotateAdminKey).toHaveBeenCalledWith(
      "access",
      expect.any(Object),
    ),
  );
  await expect(
    refreshTokenFromCall(adminApi.rotateAdminKey.mock.calls.at(-1)),
  ).resolves.toBe("access");
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
    await expect(
      refreshTokenFromCall(scenario.remove.mock.calls.at(-1)),
    ).resolves.toBe("access");
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
    await expect(
      refreshTokenFromCall(scenario.remove.mock.calls.at(-1)),
    ).resolves.toBe("access");
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
