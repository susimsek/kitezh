import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopeRoleMappings } from "./ClientScopeRoleMappings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
let mockAccess: { manageClients: boolean } | null = { manageClients: true };
let mockAccessToken: string | null = "token";

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ access: mockAccess, accessToken: mockAccessToken }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

const applicationRoles = [
  { name: "ROLE_ADMIN", description: "Administrator" },
  { name: "ROLE_USER", description: null },
];
const mappedClientRole = {
  id: 3,
  clientId: "web-console",
  name: "operator",
  description: "Operator role",
};
const mapping = { applicationRoles: ["ROLE_USER"], clientRoles: [mappedClientRole] };

function mockLoadedMappings(saveStatus = 200) {
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.method === "PUT") {
      return Promise.resolve({ status: saveStatus, data: mapping }) as never;
    }
    if (request.url?.endsWith("/application-roles?page=0&size=100&sort=name,asc")) {
      return Promise.resolve({ status: 200, data: { content: applicationRoles } }) as never;
    }
    if (request.url?.endsWith("/client-roles?page=0&size=100&sort=name,asc")) {
      return Promise.resolve({ status: 200, data: { content: [mappedClientRole] } }) as never;
    }
    return Promise.resolve({ status: 200, data: mapping }) as never;
  });
}

describe("ClientScopeRoleMappings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess = { manageClients: true };
    mockAccessToken = "token";
  });

  it("shows loading until an access token is available", () => {
    mockAccessToken = null;
    render(<ClientScopeRoleMappings scopeId="scope/1" dictionary={dictionary} />);

    expect(screen.getByRole("status")).toBeVisible();
    expect(mockAdminRequest).not.toHaveBeenCalled();
  });

  it("renders existing and available roles, deduplicates mappings, and saves them", async () => {
    mockLoadedMappings();
    render(<ClientScopeRoleMappings scopeId="scope/1" dictionary={dictionary} />);

    const applicationSelect = await screen.findByLabelText(
      dictionary.admin.clientScopes.applicationRoles,
    );
    expect(applicationSelect).toHaveDisplayValue(["ROLE_USER"]);
    expect(screen.getByRole("option", { name: "ROLE_ADMIN — Administrator" })).toBeVisible();
    const clientSelect = screen.getByLabelText(dictionary.admin.clientScopes.clientRoles);
    expect(clientSelect).toHaveDisplayValue(["web-console / operator"]);
    expect(screen.getAllByRole("option", { name: "web-console / operator" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/client-scopes/scope%2F1/role-mappings",
          data: { applicationRoles: ["ROLE_USER"], clientRoleIds: [3] },
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.clientScopes.roleMappingsSaved);
  });

  it("locks editing in read-only and unauthorized modes", async () => {
    mockLoadedMappings();
    mockAccess = { manageClients: false };
    const view = render(<ClientScopeRoleMappings scopeId="scope" dictionary={dictionary} />);

    expect(
      await screen.findByLabelText(dictionary.admin.clientScopes.applicationRoles),
    ).toBeDisabled();
    expect(screen.getByLabelText(dictionary.admin.clientScopes.clientRoles)).toBeDisabled();
    expect(screen.getByRole("button", { name: dictionary.admin.common.save })).toBeDisabled();

    view.rerender(<ClientScopeRoleMappings scopeId="scope" dictionary={dictionary} readOnly />);
    expect(screen.getByLabelText(dictionary.admin.clientScopes.applicationRoles)).toBeDisabled();
  });

  it("reports load and save failures", async () => {
    mockAdminRequest.mockRejectedValue(new Error("mapping service unavailable"));
    const failedLoad = render(<ClientScopeRoleMappings scopeId="scope" dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.admin.clientScopes.operationError)).toBeVisible();

    failedLoad.unmount();
    mockLoadedMappings(500);
    render(<ClientScopeRoleMappings scopeId="scope" dictionary={dictionary} />);
    fireEvent.click(await screen.findByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );
  });

  it("treats an unsuccessful role-list response as a load failure", async () => {
    mockAdminRequest.mockImplementation(
      (_token, request) =>
        Promise.resolve({
          status: request.url?.includes("application-roles") ? 503 : 200,
          data: request.url?.endsWith("/role-mappings") ? mapping : { content: [] },
        }) as never,
    );
    render(<ClientScopeRoleMappings scopeId="scope" dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.admin.clientScopes.operationError)).toBeVisible();
  });
});
