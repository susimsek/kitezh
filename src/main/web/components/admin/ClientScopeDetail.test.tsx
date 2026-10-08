/* eslint-disable react/display-name */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopeDetail } from "./ClientScopeDetail";

const mockReplace = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageClients: true } }),
}));
jest.mock("@/routing/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/routing/Link", () => ({ children, href, ...props }: React.ComponentProps<"a">) => (
  <a href={href} {...props}>
    {children}
  </a>
));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: jest.fn(), addError: jest.fn() }),
}));

const scope = {
  id: "scope-1",
  name: "profile",
  displayName: "Profile",
  description: "Profile claims",
  builtIn: false,
  displayOnConsentScreen: false,
  consentScreenText: null,
  includeInTokenScope: true,
  createdAt: "2026-01-01T10:00:00Z",
  updatedAt: "2026-01-02T10:00:00Z",
  groupMapperEnabled: false,
  groupClaimName: "groups",
  groupMapperFullPath: true,
};

function mockScopeRequests() {
  mockAdminRequest.mockImplementation((_token, request) => {
    const url = request.url ?? "";
    if (request.method === "PUT" && url === "/api/admin/client-scopes/scope-1") {
      return Promise.resolve({
        status: 200,
        data: { ...scope, displayName: "Updated profile" },
      }) as never;
    }
    if (request.method === "DELETE" && url === "/api/admin/client-scopes/scope-1") {
      return Promise.resolve({ status: 204, data: null }) as never;
    }
    if (url.endsWith("/mappers?page=0&size=20&sort=name,asc")) {
      return Promise.resolve({ status: 200, data: { content: [] } }) as never;
    }
    if (url.endsWith("/role-mappings")) {
      return Promise.resolve({
        status: 200,
        data: { applicationRoles: [], clientRoles: [] },
      }) as never;
    }
    if (url.includes("/role-mappings/application-roles")) {
      return Promise.resolve({ status: 200, data: { content: [] } }) as never;
    }
    if (url.includes("/role-mappings/client-roles")) {
      return Promise.resolve({ status: 200, data: { content: [] } }) as never;
    }
    return Promise.resolve({ status: 200, data: scope }) as never;
  });
}

describe("ClientScopeDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads a scope, links back to the list, and edits it inline", async () => {
    mockScopeRequests();

    render(<ClientScopeDetail dictionary={dictionary} id="scope-1" locale="en" />);

    expect(await screen.findByRole("heading", { name: "profile" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "profile Actions" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: dictionary.admin.clientScopes.title })).toHaveAttribute(
      "href",
      "/admin/client-scopes",
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.clientScopes.displayName }),
      {
        target: { value: "Updated profile" },
      },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.clientScopes.groupClaimName }),
      { target: { value: "roles.groups" } },
    );
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.common.save })[0]);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/client-scopes/scope-1",
        method: "PUT",
        data: {
          name: "profile",
          displayName: "Updated profile",
          description: "Profile claims",
          displayOnConsentScreen: false,
          consentScreenText: "",
          includeInTokenScope: true,
          groupMapperEnabled: true,
          groupClaimName: "roles.groups",
          groupMapperFullPath: true,
        },
      }),
    );
  });

  it("deletes the scope after confirmation", async () => {
    mockScopeRequests();

    render(<ClientScopeDetail dictionary={dictionary} id="scope-1" locale="en" />);
    await screen.findByRole("heading", { name: "profile" });
    expect(screen.queryByRole("button", { name: "profile Actions" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.clientScopes.delete }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clientScopes.delete,
      }),
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/client-scopes"));
  });
});
