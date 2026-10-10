import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Alert } from "react-native";
import * as adminApi from "@/api/admin-api";
import AdminScreen from "./admin";

jest.mock("@/api/admin-api", () => ({
  getAdminDashboard: jest.fn(),
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
  listAdminGroups: jest.fn(),
  listAdminIdentityProviders: jest.fn(),
  listAdminSessions: jest.fn(),
  listAdminConsents: jest.fn(),
  listAdminKeys: jest.fn(),
  listAdminEvents: jest.fn(),
  deleteAdminSession: jest.fn(),
  revokeAdminConsent: jest.fn(),
  deleteAdminEvents: jest.fn(),
  AdminApiError: class AdminApiError extends Error {
    constructor(readonly status: number) {
      super("mock admin API error");
    }
  },
}));
jest.mock("react-native", () => {
  const actual =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { ...actual, Alert: { ...actual.Alert, alert: jest.fn() } };
});
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
  BrandMark: () => <span>Brand</span>,
}));
jest.mock("@/components/AppIcon", () => ({
  AppIcon: () => null,
}));
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

const emptyPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
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
  jest.mocked(adminApi.createAdminUser).mockResolvedValue(undefined);
});

it("loads dashboard and navigates through every mobile administration tab", async () => {
  render(<AdminScreen />);

  expect(await screen.findByText("2")).toBeVisible();
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
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    await waitFor(() => expect(screen.getAllByText(tab)).toHaveLength(2));
    await waitFor(() => expect(request).toHaveBeenCalled());
  }
  fireEvent.click(screen.getByRole("tab", { name: "adminSettings" }));
  expect(adminApi.getAdminDashboard).toHaveBeenCalled();
});

it("shows loading, signed-out, and authentication-error states", async () => {
  const { mockAuthState } = jest.requireMock("@/auth/MobileAuthProvider");
  mockAuthState.session = null;
  mockAuthState.status = "loading";
  const view = render(<AdminScreen />);
  expect(screen.getByLabelText("loading")).toBeVisible();

  mockAuthState.status = "signed-out";
  view.rerender(<AdminScreen />);
  expect(screen.queryByText("authError")).not.toBeInTheDocument();
  mockAuthState.status = "error";
  view.rerender(<AdminScreen />);
  expect(screen.getByText("authError")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "signIn" }));
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
  await screen.findByText("2");
  for (const [tab, , message] of failures) {
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(message)).toBeVisible();
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
  await screen.findByText("2");
  for (const [tab, request] of failures) {
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText("adminForbidden")).toBeVisible();
    if (tab === "adminUsers") {
      fireEvent.click(screen.getByRole("button", { name: "adminRetry" }));
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      expect(screen.getByText("adminForbidden")).toBeVisible();
    }
  }
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
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByText(content)).toBeVisible();
  }

  fireEvent.click(screen.getByRole("tab", { name: "adminUsers" }));
  fireEvent.change(screen.getByLabelText("adminSearchUsers"), {
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
  fireEvent.click(screen.getByRole("button", { name: "adminNext" }));
  await waitFor(() =>
    expect(adminApi.listAdminUsers).toHaveBeenCalledWith(
      "access",
      "disabled",
      1,
      10,
      expect.any(Object),
    ),
  );
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
  fireEvent.click(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("alice")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "adminCreate" }));
  expect(screen.getByText("adminPasswordValidation")).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText("adminUsername"), {
    target: { value: "bob" },
  });
  fireEvent.change(screen.getByPlaceholderText("adminPassword"), {
    target: { value: "a-long-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "adminSave" }));

  await waitFor(() =>
    expect(adminApi.createAdminUser).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ username: "bob", password: "a-long-password" }),
      expect.any(Object),
    ),
  );
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
  fireEvent.click(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("locked-user")).toBeVisible();
  expect(screen.getByText("Taylor Jones")).toBeVisible();
  expect(screen.getByText("adminUserLocked")).toBeVisible();
  expect(screen.getByText("adminUserDisabled")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "adminEdit" }));

  expect(screen.getByPlaceholderText("adminUsername")).toHaveValue(
    "locked-user",
  );
  expect(screen.getByPlaceholderText("adminEmail")).toHaveValue("");
  expect(screen.getByPlaceholderText("adminRolesInput")).toHaveValue(
    "ROLE_ADMIN,ROLE_USER",
  );
  fireEvent.click(screen.getByRole("button", { name: "adminSave" }));

  const saveButton = screen.getByRole("button", { name: "adminSave" });
  await waitFor(() => expect(saveButton).toBeDisabled());
  expect(saveButton.querySelector('[role="progressbar"]')).not.toBeNull();
  fireEvent.click(saveButton);
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

  completeUpdate();
  await waitFor(() =>
    expect(screen.queryByText("adminSave")).not.toBeInTheDocument(),
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
  for (const scenario of scenarios) {
    fireEvent.click(screen.getByRole("tab", { name: scenario.tab }));
    fireEvent.click(await screen.findByRole("button", { name: "adminCreate" }));
    for (const [label, value] of scenario.values) {
      fireEvent.change(screen.getByPlaceholderText(label), {
        target: { value },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "adminSave" }));
    await waitFor(() => expect(scenario.mutation).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText("adminSave")).not.toBeInTheDocument(),
    );
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
  for (const scenario of scenarios) {
    fireEvent.click(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.name)).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: "adminEdit" }));
    fireEvent.click(screen.getByRole("button", { name: "adminSave" }));
    await waitFor(() =>
      expect(scenario.update).toHaveBeenCalledWith(
        "access",
        scenario.expectedId,
        expect.any(Object),
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("adminSave")).not.toBeInTheDocument(),
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
  fireEvent.click(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("locked-user")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "adminUserEnable" }));
  await waitFor(() =>
    expect(adminApi.setAdminUserEnabled).toHaveBeenCalledWith(
      "access",
      17,
      true,
      expect.any(Object),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "adminUserUnlock" }));
  await waitFor(() =>
    expect(adminApi.unlockAdminUser).toHaveBeenCalledWith(
      "access",
      17,
      expect.any(Object),
    ),
  );

  fireEvent.click(screen.getByRole("tab", { name: "adminKeys" }));
  expect(await screen.findByText("active-key")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "adminRotateKey" }));
  await waitFor(() =>
    expect(adminApi.rotateAdminKey).toHaveBeenCalledWith(
      "access",
      expect.any(Object),
    ),
  );
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
  for (const scenario of scenarios) {
    fireEvent.click(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.name)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "adminDelete" }));
    const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const confirm = actions?.find((action) => action.style === "destructive");
    expect(confirm?.onPress).toBeDefined();
    confirm?.onPress?.();
    await waitFor(() =>
      expect(scenario.remove).toHaveBeenCalledWith(
        "access",
        scenario.id,
        expect.any(Object),
      ),
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
  for (const scenario of scenarios) {
    fireEvent.click(screen.getByRole("tab", { name: scenario.tab }));
    expect(await screen.findByText(scenario.row)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: scenario.action }));
    const actions = alert.mock.calls.at(-1)?.[2];
    const confirm = actions?.find((action) => action.style === "destructive");
    expect(confirm?.onPress).toBeDefined();
    confirm?.onPress?.();
    await waitFor(() => expect(scenario.remove).toHaveBeenCalled());
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
  fireEvent.click(screen.getByRole("tab", { name: "adminUsers" }));
  expect(await screen.findByText("remove-user")).toBeVisible();
  jest.mocked(adminApi.deleteAdminUser).mockRejectedValueOnce(forbidden);
  fireEvent.click(screen.getByRole("button", { name: "adminUserDelete" }));
  jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)?.[2]
    ?.find((action) => action.style === "destructive")
    ?.onPress?.();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminForbidden",
    }),
  );

  jest
    .mocked(adminApi.deleteAdminUser)
    .mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "adminUserDelete" }));
  jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)?.[2]
    ?.find((action) => action.style === "destructive")
    ?.onPress?.();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminUserActionError",
    }),
  );

  fireEvent.click(screen.getByRole("tab", { name: "adminKeys" }));
  expect(await screen.findByText("active-key")).toBeVisible();
  jest.mocked(adminApi.rotateAdminKey).mockRejectedValueOnce(forbidden);
  fireEvent.click(screen.getByRole("button", { name: "adminRotateKey" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminForbidden",
    }),
  );
});
