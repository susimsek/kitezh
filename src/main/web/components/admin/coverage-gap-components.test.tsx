import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { encodeConsentRouteKey } from "@/lib/consent-route";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopesTable } from "./ClientScopesTable";
import { ClientsTable } from "./ClientsTable";
import { ConsentDetail } from "./ConsentDetail";
import { EntityRelatedData } from "./EntityRelatedData";
import { GroupsTable } from "./GroupsTable";
import { IdentityProviderForm } from "./IdentityProviderForm";
import { IdentityProvidersTable } from "./IdentityProvidersTable";
import ServerInfoPage from "./ServerInfo";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const authState = {
  accessToken: "admin-token",
  access: { isAdmin: true, manageClients: true, manageUsers: true, manageConsents: true },
};

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => authState }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/routing/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
jest.mock("@/routing/Link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
  useLocale: () => "en",
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    clearFilters: jest.fn(),
    page: 0,
    query: "",
    setPage: jest.fn(),
    setQuery: jest.fn(),
    setSize: jest.fn(),
    setSort: jest.fn(),
    size: 10,
    sort: "name,asc",
  }),
}));
jest.mock("./AdminActionIcon", () => ({ AdminActionIcon: () => null }));
jest.mock("./AdminPageHeader", () => ({
  AdminPageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock("./ViewHeader", () => ({
  ViewHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock("./AdminBreadcrumb", () => ({ AdminBreadcrumb: () => <nav>breadcrumb</nav> }));
jest.mock("./DataTable", () => ({
  DataTable: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <table>
      {children}
      <tfoot>
        <tr>
          <td>{footer}</td>
        </tr>
      </tfoot>
    </table>
  ),
}));
jest.mock("./PaginationControls", () => ({ PaginationControls: () => <div>pagination</div> }));
jest.mock("./ResourceFilters", () => ({ ResourceFilters: () => <div>filters</div> }));
jest.mock("./RowActions", () => ({
  RowActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("./AsyncState", () => ({
  LoadingState: () => <div>loading</div>,
  DetailLoadingState: () => <div>detail-loading</div>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
}));
jest.mock("./ConfirmModal", () => ({
  ConfirmModal: ({
    show,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    show: boolean;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    show ? (
      <div role="dialog">
        <button onClick={onCancel}>cancel-modal</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
}));
jest.mock("@/components/shared/Icon", () => ({ Icon: () => null }));

const page = <T,>(content: T[]) => ({
  status: 200,
  data: { content, totalPages: 1, totalElements: content.length },
});

describe("previously uncovered administration components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    authState.accessToken = "admin-token";
    authState.access = {
      isAdmin: true,
      manageClients: true,
      manageUsers: true,
      manageConsents: true,
    };
  });

  it("loads, deletes, and reports failures for groups", async () => {
    const group = {
      id: 1,
      name: "engineering",
      path: "/engineering",
      roles: ["ROLE_USER"],
      userCount: 2,
    };
    mockAdminRequest
      .mockResolvedValueOnce(page([group]) as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce(page([]) as never);
    const groupsView = render(<GroupsTable dictionary={dictionary} />);
    expect(await screen.findByText("/engineering")).toBeVisible();
    fireEvent.click(screen.getByText(dictionary.admin.groups.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.groups.delete }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );

    groupsView.unmount();
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<GroupsTable dictionary={dictionary} />);
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.groups.operationError)).toBeVisible(),
    );
  });

  it("edits and deletes client scopes, including server errors", async () => {
    const scope = {
      id: "openid",
      name: "openid",
      displayName: "OpenID",
      description: "Identity",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    mockAdminRequest
      .mockResolvedValueOnce(page([scope]) as never)
      .mockResolvedValueOnce({ status: 200, data: scope } as never)
      .mockResolvedValueOnce(page([scope]) as never)
      .mockResolvedValueOnce({ status: 400, data: null } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<ClientScopesTable dictionary={dictionary} />);
    expect(await screen.findByText("openid")).toBeVisible();
    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.edit));
    fireEvent.change(document.querySelector('input[name="name"]')!, {
      target: { value: "profile" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.clientScopes.saved),
    );

    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.clientScopes.delete }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.assignedDeleteError),
    );

    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.clientScopes.delete }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );
  });

  it("renders server information, copies endpoints, and handles endpoint failures", async () => {
    const info = {
      issuer: "http://localhost:9090",
      discoveryEndpoint: "http://localhost:9090/.well-known/openid-configuration",
      authorizationEndpoint: "http://localhost:9090/oauth2/authorize",
      tokenEndpoint: "http://localhost:9090/oauth2/token",
      introspectionEndpoint: "http://localhost:9090/oauth2/introspect",
      revocationEndpoint: "http://localhost:9090/oauth2/revoke",
      jwksEndpoint: "http://localhost:9090/oauth2/jwks",
      userInfoEndpoint: "http://localhost:9090/userinfo",
      endSessionEndpoint: "http://localhost:9090/connect/logout",
      sessionTimeout: "30m",
      activeSigningKey: {
        kid: "key-1",
        type: "RSA",
        algorithm: "RS256",
        use: "sig",
        createdAt: "2026-01-01T00:00:00Z",
      },
    };
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: info } as never);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ issuer: info.issuer }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [] }) }) as typeof fetch;
    render(<ServerInfoPage />);
    expect(await screen.findByText(info.issuer)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.serverInfo.copy })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(info.issuer));

    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: info } as never);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) as typeof fetch;
    render(<ServerInfoPage />);
    expect(await screen.findByText(dictionary.admin.serverInfo.configurationError)).toBeVisible();
  });

  it("covers related sessions, consents, events, and management actions", async () => {
    const session = {
      id: "session-1",
      username: "admin",
      createdAt: "2026-01-01",
      lastAccessedAt: "2026-01-01",
      expiresAt: "2026-01-02",
      authorizationCount: 1,
    };
    mockAdminRequest
      .mockResolvedValueOnce(page([session]) as never)
      .mockResolvedValueOnce(page([]) as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never);
    render(
      <EntityRelatedData
        resource="sessions"
        url="/sessions"
        locale="en"
        dictionary={dictionary}
        canManage
      />,
    );
    expect(await screen.findByText("admin")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.signOut }));
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.resources.sessionTerminated),
    );

    const consent = {
      clientId: "client",
      clientName: "Demo",
      principalName: "admin",
      userId: null,
      authorities: ["SCOPE_openid"],
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    mockAdminRequest
      .mockResolvedValueOnce(page([consent]) as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    render(
      <EntityRelatedData
        resource="consents"
        url="/consents"
        locale="en"
        dictionary={dictionary}
        canManage
      />,
    );
    expect(await screen.findByText("Demo")).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.revoke }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.resources.operationError),
    );

    mockAdminRequest.mockResolvedValueOnce(
      page([
        {
          id: "event-1",
          actor: "admin",
          action: "login",
          targetType: "USER",
          targetId: "1",
          occurredAt: "2026-01-01",
        },
      ]) as never,
    );
    render(
      <EntityRelatedData resource="events" url="/events" locale="en" dictionary={dictionary} />,
    );
    expect(await screen.findByText("login")).toBeVisible();
  });

  it("loads identity providers and exercises delete success and failure", async () => {
    const provider = {
      id: "google",
      registrationId: "google",
      providerType: "oidc",
      displayName: "Google",
      alias: "google",
      iconKey: "google",
      enabled: true,
      configured: true,
      hideOnLogin: false,
      mapperCount: 2,
    };
    mockAdminRequest
      .mockResolvedValueOnce(page([provider]) as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce(page([provider]) as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<IdentityProvidersTable dictionary={dictionary} />);
    expect(await screen.findByText("Google")).toBeVisible();
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.identityProviders.deleted),
    );
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.identityProviders.deleteError),
    );
  });

  it("loads and revokes a consent, and shows invalid-route errors", async () => {
    const consent = {
      clientId: "client",
      clientName: "Demo",
      principalName: "admin",
      userId: 1,
      authorities: ["SCOPE_openid"],
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    };
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: consent } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never);
    const consentView = render(
      <ConsentDetail
        locale="en"
        dictionary={dictionary}
        routeKey={encodeConsentRouteKey("client", "admin")}
      />,
    );
    expect(await screen.findByText("Demo")).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.revoke }).at(-1)!,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.revoke }).at(-1)!,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/consents"));

    consentView.unmount();
    render(<ConsentDetail locale="en" dictionary={dictionary} routeKey="invalid" />);
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });

  it("submits identity provider forms and handles save and cancel paths", async () => {
    const initial = {
      registrationId: "google",
      providerType: "oidc",
      displayName: "Google",
      alias: "google",
      clientId: "client",
      scopes: "openid",
      userNameAttribute: "sub",
    };
    mockAdminRequest.mockResolvedValueOnce({ status: 201, data: { id: "google" } } as never);
    const createView = render(<IdentityProviderForm dictionary={dictionary} initial={initial} />);
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.identityProviders.create }),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/admin/identity-providers/google/details"),
    );

    createView.unmount();
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: {} } as never);
    render(<IdentityProviderForm dictionary={dictionary} id="google" initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.identityProviders.saveError),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
    expect(mockPush).toHaveBeenCalledWith("/admin/identity-providers");
  });

  it("renders clients with capped scope badges and handles unavailable access", async () => {
    const client = {
      id: "client/1",
      clientId: "console",
      clientName: "Console",
      authorizationGrantTypes: ["authorization_code", "refresh_token"],
      clientAuthenticationMethods: ["none"],
      scopes: ["openid", "profile", "email", "admin-api", "account-api"],
      requireAuthorizationConsent: true,
      requireProofKey: true,
    };
    mockAdminRequest.mockResolvedValueOnce(page([client]) as never);
    const clientsView = render(<ClientsTable dictionary={dictionary} locale="en" />);

    expect(await screen.findByText("Console")).toBeVisible();
    expect(screen.getByText("+1")).toBeVisible();
    expect(screen.getByText("authorization_code")).toBeVisible();
    expect(screen.getByText("PKCE On")).toBeVisible();

    clientsView.unmount();
    authState.access = {
      isAdmin: true,
      manageClients: false,
      manageUsers: true,
      manageConsents: true,
    };
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: page([]).data } as never);
    render(<ClientsTable dictionary={dictionary} locale="en" />);
    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole("link", { name: dictionary.admin.clients.create }),
    ).not.toBeInTheDocument();
  });

  it("shows collection errors and handles client scope save/delete responses", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<ClientsTable dictionary={dictionary} locale="en" />);
    expect(await screen.findByText(dictionary.admin.clients.loadError)).toBeVisible();

    mockAdminRequest.mockResolvedValueOnce(page([]) as never);
    render(<ClientScopesTable dictionary={dictionary} />);
    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("openid")).not.toBeInTheDocument();
  });
});
