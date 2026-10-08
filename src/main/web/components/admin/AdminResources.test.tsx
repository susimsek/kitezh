/* eslint-disable @next/next/no-img-element, react/display-name */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18next from "i18next";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { AdminResources } from "./AdminResources";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
jest.mock("@/routing/navigation", () => ({
  usePathname: () => window.location.pathname,
}));

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    accessToken: "token",
    access: {
      manageUsers: true,
      manageSessions: true,
      manageConsents: true,
      manageKeys: true,
    },
  }),
}));
jest.mock("@/routing/Link", () => ({ children, href, ...props }: React.ComponentProps<"a">) => (
  <a href={href} {...props}>
    {children}
  </a>
));
jest.mock("next/image", () => ({ src, alt }: { src: string; alt: string }) => (
  <img alt={alt} src={src} />
));

const page = (content: unknown[]) => ({
  content,
  number: 0,
  totalPages: 1,
  totalElements: content.length,
});

describe("AdminResources", () => {
  it.each(["sessions", "keys", "consents"] as const)(
    "updates %s timestamps when the UI locale changes",
    async (resource) => {
      const timestamp = "2026-09-03T13:45:00Z";
      mockAdminRequest.mockResolvedValue({
        status: 200,
        data: page([
          {
            id: "id",
            kid: "key",
            clientId: "client",
            clientName: "Client",
            principalName: "admin",
            authorities: [],
            username: "admin",
            active: true,
            type: "RSA",
            algorithm: "RS256",
            authorizationCount: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastAccessedAt: timestamp,
            expiresAt: timestamp,
          },
        ]),
      } as never);
      render(<AdminResources copy={dictionary.admin.resources} locale="en" resource={resource} />);
      expect(
        (await screen.findAllByText(new Date(timestamp).toLocaleString("en"))).length,
      ).toBeGreaterThan(0);
      await act(() => i18next.changeLanguage("tr"));
      expect(screen.getAllByText(new Date(timestamp).toLocaleString("tr")).length).toBeGreaterThan(
        0,
      );
      expect(screen.queryByText(new Date(timestamp).toLocaleString("en"))).not.toBeInTheDocument();
    },
  );
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists users and applies enable and delete actions after confirmation", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: page([
            { id: 1, username: "ada", enabled: true, avatarUrl: null, authorities: ["ROLE_USER"] },
          ]),
        } as never;
      }
      return { status: 204, data: null } as never;
    });

    render(<AdminResources copy={dictionary.admin.resources} locale="en" resource="users" />);
    expect(await screen.findByRole("link", { name: "ada" })).toHaveAttribute(
      "href",
      "/admin/users/1/details",
    );
    expect(
      screen.getByRole("link", { name: dictionary.admin.resources.createUser }),
    ).toHaveAttribute("href", "/admin/users/new");

    fireEvent.click(screen.getByRole("button", { name: "ada actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.disable));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/users/1/enabled" }),
      ),
    );
    await screen.findByText("ada");

    fireEvent.click(screen.getByRole("button", { name: "ada actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.delete));
    expect(screen.getByText(dictionary.admin.resources.deleteUserConfirm)).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.delete,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ method: "DELETE", url: "/api/admin/users/1" }),
      ),
    );
  });

  it("selects users on the current page and applies a confirmed bulk lifecycle action", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: page([
            { id: 1, username: "ada", enabled: true, avatarUrl: null, authorities: ["ROLE_USER"] },
            { id: 2, username: "lin", enabled: true, avatarUrl: null, authorities: ["ROLE_USER"] },
          ]),
        } as never;
      }
      return { status: 200, data: { action: "DISABLE", userCount: 2 } } as never;
    });

    render(<AdminResources copy={dictionary.admin.resources} locale="en" resource="users" />);
    await screen.findByRole("link", { name: "ada" });

    fireEvent.click(
      screen.getByRole("checkbox", { name: dictionary.admin.resources.selectAllUsers }),
    );
    expect(screen.getByText("2 users selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.bulkDisable }));
    expect(screen.getByText(dictionary.admin.resources.bulkDisableConfirm)).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.bulkDisable,
      }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/users/bulk",
          data: { userIds: [1, 2], action: "DISABLE" },
        }),
      ),
    );
  });

  it("uses the session entity property when requesting the default sort", async () => {
    mockAdminRequest.mockResolvedValue({ status: 200, data: page([]) } as never);

    render(<AdminResources copy={dictionary.admin.resources} resource="sessions" />);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          url: "/api/admin/sessions?q=&page=0&size=10&sort=lastAccessTime%2Cdesc&status=active&clientId=",
        }),
      ),
    );
  });

  it("manages session, consent, and key resource actions", async () => {
    const resources = {
      sessions: {
        item: {
          id: "session/1",
          username: "ada@example.com",
          createdAt: "2026-01-01T12:00:00Z",
          lastAccessedAt: "2026-01-01T12:30:00Z",
          expiresAt: "2026-01-01T13:00:00Z",
          authorizationCount: 2,
          active: true,
        },
        button: dictionary.admin.resources.signOutAll,
        confirm: dictionary.admin.resources.signOutAll,
        url: "/api/admin/users/ada%40example.com/sessions",
      },
      consents: {
        item: {
          clientId: "client/1",
          clientName: "Web client",
          principalName: "ada@example.com",
          authorities: ["SCOPE_openid"],
          createdAt: "2026-01-01T12:00:00Z",
          updatedAt: "2026-01-01T12:30:00Z",
        },
        button: dictionary.admin.resources.revoke,
        confirm: dictionary.admin.resources.revoke,
        url: "/api/admin/consents/client%2F1/ada%40example.com",
      },
    } as const;

    for (const [resource, expected] of Object.entries(resources)) {
      mockAdminRequest.mockImplementation(async (_token, config) => {
        if (!config.method) return { status: 200, data: page([expected.item]) } as never;
        return { status: 204, data: null } as never;
      });
      const view = render(
        <AdminResources
          copy={dictionary.admin.resources}
          locale="en"
          resource={resource as "sessions" | "consents"}
        />,
      );
      await screen.findByText(resource === "sessions" ? "ada@example.com" : "Web client");
      if (resource === "sessions") {
        fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Web client consent actions" }));
      }
      fireEvent.click(screen.getByText(expected.button));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: expected.confirm }),
      );
      await waitFor(() =>
        expect(mockAdminRequest).toHaveBeenCalledWith(
          "token",
          expect.objectContaining({ method: "DELETE", url: expected.url }),
        ),
      );
      view.unmount();
      jest.clearAllMocks();
    }

    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: page([
            {
              id: "key-1",
              kid: "key-id",
              type: "RSA",
              algorithm: "RS256",
              use: "sig",
              active: true,
              createdAt: "2026-01-01T12:00:00Z",
            },
          ]),
        } as never;
      }
      return { status: 201, data: { kid: "rotated-key" } } as never;
    });
    render(<AdminResources copy={dictionary.admin.resources} resource="keys" />);
    expect(await screen.findByText("key-id")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.rotateKey }));
    expect(await screen.findByText("rotated-key")).toBeInTheDocument();
  });

  it("shows the loading error when the initial resource request fails", async () => {
    mockAdminRequest.mockResolvedValue({ status: 500, data: null } as never);
    render(<AdminResources copy={dictionary.admin.resources} resource="users" />);
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });

  it("covers unmanaged users, avatar rendering, failed operations, and anonymous sessions", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: page([
            { id: 2, username: "bob", enabled: false, avatarUrl: "/bob.png", authorities: [] },
          ]),
        } as never;
      }
      return { status: 500, data: null } as never;
    });
    render(<AdminResources copy={dictionary.admin.resources} resource="users" locale="en" />);
    expect(await screen.findByAltText("")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "bob actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.enable));
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();

    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: page([
        {
          id: "anonymous",
          username: null,
          createdAt: "2026-01-01T12:00:00Z",
          lastAccessedAt: "2026-01-01T12:30:00Z",
          expiresAt: "2026-01-01T13:00:00Z",
          authorizationCount: 0,
          active: true,
        },
      ]),
    } as never);
    const view = render(<AdminResources copy={dictionary.admin.resources} resource="sessions" />);
    expect(await screen.findByText("-")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.resources.signOutAll }),
    ).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows an error when key rotation fails", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) =>
      config.method
        ? ({ status: 500, data: null } as never)
        : ({ status: 200, data: page([]) } as never),
    );
    render(<AdminResources copy={dictionary.admin.resources} resource="keys" />);
    await screen.findByText(dictionary.admin.resources.empty);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.rotateKey }));
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });

  it("changes resource filters and signs out an individual session", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
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
                active: true,
              },
            ],
            number: 0,
            totalPages: 2,
            totalElements: 1,
          },
        } as never;
      }
      return { status: 204, data: null } as never;
    });
    const view = render(<AdminResources copy={dictionary.admin.resources} resource="sessions" />);
    expect(await screen.findByText("ada")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Client ID" })).toHaveClass(
      "admin-resource-filter-control",
    );
    expect(screen.getByRole("combobox", { name: "Session status" })).toHaveClass(
      "admin-resource-filter-control",
    );
    fireEvent.change(screen.getAllByRole("combobox").at(-1)!, { target: { value: "50" } });
    expect(await screen.findByText("ada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.signOut));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.signOut,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/sessions/session-1",
        method: "DELETE",
      }),
    );
    expect(await screen.findByText("ada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.next }));
    view.unmount();
  });

  it("exercises users status/search and confirmation cancel callbacks", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) return { status: 200, data: page([]) } as never;
      return { status: 204, data: null } as never;
    });
    const users = render(
      <AdminResources copy={dictionary.admin.resources} resource="users" locale="en" />,
    );
    await screen.findByText(dictionary.admin.resources.empty);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "true" } });
    expect(await screen.findByText(dictionary.admin.resources.empty)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.resources.search }), {
      target: { value: "ada" },
    });
    users.unmount();

    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: page([{ id: 1, username: "ada", enabled: true, avatarUrl: null, authorities: [] }]),
    } as never);
    render(<AdminResources copy={dictionary.admin.resources} resource="users" locale="en" />);
    await screen.findByText("ada");
    fireEvent.click(screen.getByRole("button", { name: "ada actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.delete));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
  });

  it("opens session details with and without authorizations", async () => {
    const session = {
      id: "session-detail",
      username: "ada",
      createdAt: "2026-01-01T12:00:00Z",
      lastAccessedAt: "2026-01-01T12:30:00Z",
      expiresAt: "2026-01-01T13:00:00Z",
      authorizationCount: 1,
      active: false,
    };
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: page([session]) } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: { session, authorizations: [] },
      } as never);
    render(<AdminResources copy={dictionary.admin.resources} resource="sessions" />);
    await screen.findByText("ada");
    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.details));
    expect(await screen.findByText(dictionary.admin.resources.noAuthorizations)).toBeVisible();

    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.details));
    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalledTimes(3));
  });

  it("renders an authorization detail and exercises user selection toggles", async () => {
    const session = {
      id: "session-detail",
      username: "ada",
      createdAt: "2026-01-01T12:00:00Z",
      lastAccessedAt: "2026-01-01T12:30:00Z",
      expiresAt: "2026-01-01T13:00:00Z",
      authorizationCount: 1,
      active: true,
    };
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: page([session]) } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          session,
          authorizations: [
            {
              id: "authorization-1",
              clientId: "client-1",
              clientName: "Portal",
              grantType: "authorization_code",
              scopes: ["openid", "profile"],
              accessTokenIssuedAt: null,
              accessTokenExpiresAt: "2026-01-01T13:00:00Z",
              refreshTokenExpiresAt: null,
            },
          ],
        },
      } as never);
    render(<AdminResources copy={dictionary.admin.resources} resource="sessions" />);
    await screen.findByText("ada");
    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(screen.getByText(dictionary.admin.resources.details));
    expect(await screen.findByText("Portal")).toBeVisible();
    expect(screen.getByText("openid")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: page([
        { id: 1, username: "ada", enabled: true, avatarUrl: null, authorities: [] },
        { id: 2, username: "lin", enabled: false, avatarUrl: null, authorities: [] },
      ]),
    } as never);
    const users = render(
      <AdminResources copy={dictionary.admin.resources} locale="en" resource="users" />,
    );
    await screen.findByRole("link", { name: "ada" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select user: ada" }));
    expect(
      screen.getByText(dictionary.admin.resources.selectedUsers.replace("{count}", "1")),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select user: ada" }));
    expect(
      screen.queryByText(dictionary.admin.resources.selectedUsers.replace("{count}", "1")),
    ).not.toBeInTheDocument();
    users.unmount();
  });

  it("runs all bulk user actions and covers filter clear callbacks", async () => {
    const users = [
      { id: 1, username: "ada", enabled: true, avatarUrl: null, authorities: ["ROLE_USER"] },
      { id: 2, username: "lin", enabled: false, avatarUrl: null, authorities: ["ROLE_ADMIN"] },
    ];
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (!config.method) return { status: 200, data: page(users) } as never;
      if (config.url === "/api/admin/users/bulk") return { status: 204, data: null } as never;
      return { status: 204, data: null } as never;
    });
    render(<AdminResources copy={dictionary.admin.resources} locale="en" resource="users" />);
    await screen.findByText("ada");
    fireEvent.click(
      screen.getByRole("checkbox", { name: dictionary.admin.resources.selectAllUsers }),
    );
    for (const action of [
      dictionary.admin.resources.bulkEnable,
      dictionary.admin.resources.bulkDisable,
      dictionary.admin.resources.bulkDelete,
    ]) {
      fireEvent.click(
        within(
          screen.getByRole("group", { name: dictionary.admin.resources.bulkActions }),
        ).getByRole("button", { name: action }),
      );
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: action }));
      await waitFor(() =>
        expect(mockAdminRequest).toHaveBeenCalledWith(
          "token",
          expect.objectContaining({ url: "/api/admin/users/bulk", method: "POST" }),
        ),
      );
      if (action !== dictionary.admin.resources.bulkDelete) {
        fireEvent.click(
          screen.getByRole("checkbox", { name: dictionary.admin.resources.selectAllUsers }),
        );
      }
    }
  });

  it("reports failed key rotation and exercises session/consent filter controls", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: page([]) } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    const keyView = render(<AdminResources copy={dictionary.admin.resources} resource="keys" />);
    await screen.findByText(dictionary.admin.resources.empty);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.rotateKey }));
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.resources.operationError)).toBeVisible(),
    );
    keyView.unmount();

    mockAdminRequest.mockResolvedValue({ status: 200, data: page([]) } as never);
    const consentView = render(
      <AdminResources copy={dictionary.admin.resources} resource="consents" />,
    );
    const consentQueries = within(consentView.container);
    await consentQueries.findByRole("textbox", { name: dictionary.admin.resources.clientId });
    fireEvent.change(
      consentQueries.getByRole("textbox", { name: dictionary.admin.resources.clientId }),
      {
        target: { value: "client" },
      },
    );
    await consentQueries.findByRole("textbox", { name: dictionary.admin.resources.user });
    fireEvent.change(
      consentQueries.getByRole("textbox", { name: dictionary.admin.resources.user }),
      {
        target: { value: "ada" },
      },
    );
    await consentQueries.findByRole("textbox", { name: dictionary.admin.resources.grantedScopes });
    fireEvent.change(
      consentQueries.getByRole("textbox", { name: dictionary.admin.resources.grantedScopes }),
      {
        target: { value: "openid" },
      },
    );
    consentView.unmount();
  });
});
