/* eslint-disable react/display-name */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { ClientDetail } from "./ClientDetail";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
let clientAccess: { manageClients: boolean; viewEvents?: boolean } = { manageClients: true };

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: clientAccess }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
jest.mock("@/routing/Link", () => ({ children, href, ...props }: React.ComponentProps<"a">) => (
  <a href={href} {...props}>
    {children}
  </a>
));
jest.mock("./ClientForm", () => ({
  ClientForm: () => <div>embedded-client-form</div>,
}));

const client = {
  clientId: "web-client",
  clientName: "Web client",
  redirectUris: ["https://app.example/callback"],
  id: "client-1",
  postLogoutRedirectUris: [],
  clientIdIssuedAt: null,
  clientSecretExpiresAt: null,
  authorizationCodeTimeToLive: "PT5M",
  accessTokenTimeToLive: "PT5M",
  refreshTokenTimeToLive: "PT1H",
  clientAuthenticationMethods: ["client_secret_basic"],
  authorizationGrantTypes: ["authorization_code"],
  scopes: ["openid"],
  requireProofKey: true,
  requireAuthorizationConsent: false,
};

describe("ClientDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientAccess = { manageClients: true };
  });

  it("shows a not-found state without an id", () => {
    render(<ClientDetail dictionary={dictionary} id={null} locale="en" />);

    expect(screen.getByText(dictionary.admin.clients.notFound)).toBeInTheDocument();
  });

  it("falls back to the settings tab when given an unknown tab key", async () => {
    mockAdminRequest.mockResolvedValue({ status: 200, data: client } as never);

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="unknown" />);

    expect(await screen.findByRole("heading", { name: "Web client" })).toBeVisible();
    expect(screen.getByRole("link", { name: dictionary.admin.clients.settings })).toHaveClass(
      "active",
    );
    expect(screen.getByText("embedded-client-form")).toBeVisible();
  });

  it("loads a client, regenerates its secret, and deletes it after confirmation", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1") {
        return { status: config.method === "DELETE" ? 204 : 200, data: client } as never;
      }
      return { status: 200, data: { clientSecret: "new-secret" } } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="credentials" />);

    expect(await screen.findByRole("heading", { name: "Web client" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Web client ${dictionary.admin.common.actions}` }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.clients.regenerateSecret }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clients.regenerateSecret,
      }),
    );
    expect(await screen.findByText("new-secret")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.common.close })[1]);

    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.clients.delete })[0]);
    expect(screen.getByText(dictionary.admin.clients.deleteConfirm)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.clients.delete })[1]);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/clients"));
  });

  it("hides secret actions and shows public-client credential settings", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: {
        ...client,
        clientAuthenticationMethods: ["none"],
        requireProofKey: false,
        requireDpop: false,
        requireDpopJkt: false,
        dpopRefreshTokenOnly: false,
        dpopSigningAlgorithms: null,
      },
    } as never);

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="credentials" />);

    expect(await screen.findByText(dictionary.admin.clients.publicClient)).toBeVisible();
    expect(screen.getByText(dictionary.admin.clients.pkceNotRequired)).toBeVisible();
    expect(screen.getAllByText(dictionary.admin.common.off)).toHaveLength(3);
    expect(screen.getByText("RS256, ES256")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.clients.regenerateSecret }),
    ).not.toBeInTheDocument();
  });

  it("renders the enabled DPoP options and issued/expiry timestamps", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: {
        ...client,
        clientIdIssuedAt: "2026-01-01T12:00:00Z",
        clientSecretExpiresAt: "2027-01-01T12:00:00Z",
        requireDpop: true,
        requireDpopJkt: true,
        dpopRefreshTokenOnly: true,
        dpopSigningAlgorithms: ["ES256"],
      },
    } as never);

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="credentials" />);

    expect((await screen.findAllByText(dictionary.admin.common.on)).length).toBe(3);
    expect(screen.getAllByText(dictionary.admin.common.on)).toHaveLength(3);
    expect(screen.getByText("ES256")).toBeVisible();
    expect(screen.getByText(new Date("2026-01-01T12:00:00Z").toLocaleString("en"))).toBeVisible();
    expect(screen.getByText(new Date("2027-01-01T12:00:00Z").toLocaleString("en"))).toBeVisible();
  });

  it("shows the events tab only with event access and loads its event resource", async () => {
    clientAccess = { manageClients: true, viewEvents: true };
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1")
        return { status: 200, data: client } as never;
      return {
        status: 200,
        data: { content: [], number: 0, totalPages: 1, totalElements: 0 },
      } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="events" />);

    expect(await screen.findByRole("heading", { name: "Web client" })).toBeVisible();
    expect(screen.getByRole("link", { name: dictionary.admin.clients.events })).toHaveAttribute(
      "href",
      "/admin/clients/client-1/events",
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          url: expect.stringContaining("/api/admin/clients/client-1/events"),
        }),
      ),
    );
  });

  it("shows secret and delete errors and renders empty groups", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      const url = config.url ?? "";
      if (url === "/api/admin/clients/client-2") {
        return {
          status: 200,
          data: { ...client, id: "client-2", postLogoutRedirectUris: [], scopes: [] },
        } as never;
      }
      if (url.endsWith("/secret")) return { status: 500, data: null } as never;
      return { status: 500, data: null } as never;
    });
    render(<ClientDetail dictionary={dictionary} id="client-2" locale="en" tab="credentials" />);
    expect(await screen.findByRole("heading", { name: "Web client" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.clients.regenerateSecret }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clients.regenerateSecret,
      }),
    );
    expect(await screen.findByText(dictionary.admin.clients.secretError)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.clients.delete })[0]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.common.cancel,
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.clients.delete })[0]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clients.delete,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/clients/client-2",
        method: "DELETE",
      }),
    );
  });

  it("revokes all client sessions and reports the result", async () => {
    let revoked = false;
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1") {
        return { status: 200, data: client } as never;
      }
      if (config.url?.startsWith("/api/admin/clients/client-1/sessions")) {
        if (config.method === "DELETE") {
          revoked = true;
          return { status: 204, data: null } as never;
        }
        return {
          status: 200,
          data: {
            content: revoked
              ? []
              : [
                  {
                    id: "session-1",
                    username: "ada",
                    createdAt: "2026-01-01T12:00:00Z",
                    lastAccessedAt: "2026-01-01T12:30:00Z",
                    expiresAt: "2026-01-01T13:00:00Z",
                    authorizationCount: 1,
                  },
                ],
            number: 0,
            totalPages: 1,
            totalElements: revoked ? 0 : 1,
          },
        } as never;
      }
      return { status: 500, data: null } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="sessions" />);

    expect(await screen.findByText("ada")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.signOutAllClientSessions }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.signOutAllClientSessions,
      }),
    );

    await waitFor(() => {
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/clients/client-1/sessions",
        method: "DELETE",
      });
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.resources.sessionTerminated);
    });
    expect(mockAddError).not.toHaveBeenCalled();
  });

  it("reports a failed client-wide session revocation and restores the action", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1")
        return { status: 200, data: client } as never;
      if (config.url?.startsWith("/api/admin/clients/client-1/sessions"))
        return {
          status: config.method === "DELETE" ? 500 : 200,
          data: {
            content: [
              {
                id: "session-1",
                username: "ada",
                createdAt: "2026-01-01T12:00:00Z",
                lastAccessedAt: "2026-01-01T12:30:00Z",
                expiresAt: "2026-01-01T13:00:00Z",
                authorizationCount: 1,
              },
            ],
            number: 0,
            totalPages: 1,
            totalElements: 1,
          },
        } as never;
      return { status: 500, data: null } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="sessions" />);

    await screen.findByText("ada");
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.signOutAllClientSessions }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.signOutAllClientSessions,
      }),
    );

    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.resources.operationError),
    );
    expect(mockAddAlert).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", {
        name: dictionary.admin.resources.signOutAllClientSessions,
      })[0],
    ).toBeEnabled();
  });

  it("uses the client-specific URL when signing out an individual session", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1")
        return { status: 200, data: client } as never;
      if (config.url?.startsWith("/api/admin/clients/client-1/sessions"))
        return {
          status: config.method === "DELETE" ? 204 : 200,
          data: {
            content: [
              {
                id: "session/one",
                username: "ada",
                createdAt: "2026-01-01T12:00:00Z",
                lastAccessedAt: "2026-01-01T12:30:00Z",
                expiresAt: "2026-01-01T13:00:00Z",
                authorizationCount: 1,
              },
            ],
            number: 0,
            totalPages: 1,
            totalElements: 1,
          },
        } as never;
      return { status: 500, data: null } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="sessions" />);

    expect(await screen.findByText("ada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.signOut }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/clients/client-1/sessions/session%2Fone",
        method: "DELETE",
      }),
    );
  });

  it("reports thrown errors from client-wide session revocation", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/clients/client-1")
        return { status: 200, data: client } as never;
      if (config.url?.startsWith("/api/admin/clients/client-1/sessions")) {
        if (config.method === "DELETE") throw new Error("service unavailable");
        return {
          status: 200,
          data: {
            content: [
              {
                id: "session-1",
                username: "ada",
                createdAt: "2026-01-01T12:00:00Z",
                lastAccessedAt: "2026-01-01T12:30:00Z",
                expiresAt: "2026-01-01T13:00:00Z",
                authorizationCount: 1,
              },
            ],
            number: 0,
            totalPages: 1,
            totalElements: 1,
          },
        } as never;
      }
      return { status: 500, data: null } as never;
    });

    render(<ClientDetail dictionary={dictionary} id="client-1" locale="en" tab="sessions" />);

    await screen.findByText("ada");
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.signOutAllClientSessions }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.signOutAllClientSessions,
      }),
    );

    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.resources.operationError),
    );
    expect(mockAddAlert).not.toHaveBeenCalled();
  });
});
