import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopeAssignments } from "./ClientScopeAssignments";
import { UserGroups } from "./UserGroups";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockSetPage = jest.fn();
const mockSetQuery = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    accessToken: "admin-token",
    access: { manageClients: true, manageUsers: true },
  }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    clearFilters: jest.fn(),
    page: 0,
    query: "",
    setPage: mockSetPage,
    setQuery: mockSetQuery,
    setSize: jest.fn(),
    setSort: jest.fn(),
    size: 10,
    sort: "name,asc",
  }),
}));

describe("low coverage admin collections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
  });

  it("loads scope assignments, moves scopes, and reports persistence errors", async () => {
    const scopes = [
      {
        id: "1",
        name: "openid",
        displayName: "OpenID",
        description: "Identity scope",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        name: "profile",
        displayName: null,
        description: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "3",
        name: "email",
        displayName: "Email",
        description: "Email scope",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { defaultScopes: ["openid"], optionalScopes: ["profile"], availableScopes: scopes },
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: { defaultScopes: [], optionalScopes: ["profile", "openid"], availableScopes: scopes },
      } as never);
    render(<ClientScopeAssignments clientId="client-1" dictionary={dictionary} />);

    expect(await screen.findByText("openid")).toBeVisible();
    expect(screen.getByText("Identity scope")).toBeVisible();
    expect(screen.getByText("email")).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.clientScopes.addOptional })[0],
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          data: { defaultScopes: [], optionalScopes: ["profile", "openid"] },
        }),
      ),
    );

    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.clientScopes.remove })[0],
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );

    mockAdminRequest.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.clientScopes.addDefault })[0],
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );
  });

  it("shows loading and load error states for assignments", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<ClientScopeAssignments clientId="client-1" dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.admin.clientScopes.operationError)).toBeVisible();
  });

  it("loads user groups, assigns a group, and removes a membership", async () => {
    const currentGroup = { id: 1, name: "engineering", roles: ["ROLE_USER"], userCount: 2 };
    const suggestion = { id: 2, name: "support", roles: [], userCount: 1 };
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: { content: [currentGroup] } } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [currentGroup, suggestion] },
      } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [currentGroup, suggestion] },
      } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce({ status: 200, data: { content: [suggestion] } } as never);
    render(<UserGroups dictionary={dictionary} userId="42" />);

    expect(await screen.findByText("engineering")).toBeVisible();
    expect(screen.getByText("ROLE_USER")).toBeVisible();
    const search = screen.getByRole("textbox", { name: dictionary.admin.groups.searchGroups });
    jest.useFakeTimers();
    fireEvent.change(search, { target: { value: "sup" } });
    act(() => jest.advanceTimersByTime(250));
    jest.useRealTimers();
    expect(await screen.findByRole("button", { name: "support" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "support" }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.groups.assignGroup }));
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.groups.groupAdded),
    );
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.groups.removeGroup })[0],
    );
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.groups.groupRemoved),
    );
  });
});
