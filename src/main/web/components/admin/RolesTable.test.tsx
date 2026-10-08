import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { RolesTable } from "./RolesTable";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageRoles: true } }),
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    clearFilters: jest.fn(),
    page: 0,
    query: "",
    sort: "name,asc",
    size: 10,
    setPage: jest.fn(),
    setQuery: jest.fn(),
    setSize: jest.fn(),
    setSort: jest.fn(),
  }),
}));

function rolePage(content: { name: string }[]) {
  return {
    content,
    totalPages: content.length === 0 ? 0 : 1,
    totalElements: content.length,
  };
}

describe("RolesTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
  });

  it("loads a server-side role page and marks built-in roles as protected", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: rolePage([{ name: "ROLE_ADMIN" }, { name: "ROLE_USER" }, { name: "ROLE_AUDITOR" }]),
    } as never);
    render(<RolesTable dictionary={dictionary} />);
    expect(await screen.findByText("ROLE_AUDITOR")).toBeVisible();
    expect(
      screen.getByRole("button", { name: `ROLE_AUDITOR ${dictionary.admin.common.actions}` }),
    ).toBeVisible();
    expect(screen.getAllByText(dictionary.admin.roles.protected)).toHaveLength(2);
    expect(mockAdminRequest).toHaveBeenCalledWith("token", {
      url: "/api/admin/roles?q=&page=0&size=10&sort=name%2Casc",
    });
  });

  it("links creation to the dedicated role page", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: rolePage([]) } as never);
    render(<RolesTable dictionary={dictionary} />);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/roles?q=&page=0&size=10&sort=name%2Casc",
      }),
    );
    expect(
      await screen.findByRole("link", { name: dictionary.admin.roles.create }),
    ).toHaveAttribute("href", "/admin/roles/new");
  });

  it("deletes a role after confirmation", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: rolePage([{ name: "ROLE_AUDITOR" }]) } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce({ status: 200, data: rolePage([]) } as never);
    render(<RolesTable dictionary={dictionary} />);
    expect(await screen.findByText("ROLE_AUDITOR")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: `ROLE_AUDITOR ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.roles.delete })[0]);
    expect(await screen.findByText(dictionary.admin.roles.deleteConfirm)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
    fireEvent.click(
      screen.getByRole("button", { name: `ROLE_AUDITOR ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.roles.delete })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.roles.delete })[1]);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/roles/ROLE_AUDITOR",
        method: "DELETE",
      }),
    );
  });

  it("shows loading and operation errors", async () => {
    mockAdminRequest.mockRejectedValueOnce(new Error("load failed"));
    render(<RolesTable dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.admin.roles.operationError)).toBeVisible();
  });

  it("shows an operation error when deleting a role fails", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: rolePage([{ name: "ROLE_AUDITOR" }]) } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<RolesTable dictionary={dictionary} />);
    expect(await screen.findByText("ROLE_AUDITOR")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: `ROLE_AUDITOR ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.delete }));
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.roles.delete })[1]);
    expect(await screen.findByText(dictionary.admin.roles.operationError)).toBeVisible();
  });
});
