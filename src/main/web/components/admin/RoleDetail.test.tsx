import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { RoleDetail } from "./RoleDetail";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockPush = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token", access: { manageRoles: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/routing/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("./AdminBreadcrumb", () => ({ AdminBreadcrumb: () => <div>breadcrumb</div> }));
jest.mock("./DetailTabs", () => ({ DetailTabs: () => <div>tabs</div> }));
jest.mock("./DataTable", () => ({
  DataTable: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      <table>{children}</table>
      {footer}
    </div>
  ),
}));
jest.mock("./PaginationControls", () => ({
  PaginationControls: ({
    onPageChange,
    onSizeChange,
  }: {
    onPageChange: (value: number) => void;
    onSizeChange: (value: number) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPageChange(1)}>
        page
      </button>
      <button type="button" onClick={() => onSizeChange(25)}>
        size
      </button>
    </div>
  ),
}));
jest.mock("./ResourceFilters", () => ({
  ResourceFilters: ({
    searchLabel,
    onQueryChange,
    onClearFilters,
  }: {
    searchLabel: string;
    onQueryChange: (value: string) => void;
    onClearFilters: () => void;
  }) => (
    <div>
      <input aria-label={searchLabel} onChange={(event) => onQueryChange(event.target.value)} />
      <button type="button" onClick={onClearFilters}>
        clear
      </button>
    </div>
  ),
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
    setStatus: jest.fn(),
    size: 10,
    sort: "username,asc",
    status: "",
  }),
}));

const detail = {
  name: "ROLE_EDITOR",
  description: "Editor role",
  userCount: 1,
  protectedRole: true,
  users: {
    content: [{ id: 1, username: "ada", enabled: true }],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.url?.includes("available-users")) {
      return Promise.resolve({
        status: 200,
        data: { content: [{ id: 2, username: "grace", enabled: false }] },
      }) as never;
    }
    if (request.method === "PUT") return Promise.resolve({ status: 200, data: detail }) as never;
    if (request.method === "POST" || request.method === "DELETE")
      return Promise.resolve({ status: 204, data: null }) as never;
    return Promise.resolve({ status: 200, data: detail }) as never;
  });
});

describe("RoleDetail", () => {
  it("loads and updates a role description", async () => {
    render(<RoleDetail locale="en" dictionary={dictionary} name="ROLE_EDITOR" />);
    expect(await screen.findByRole("heading", { name: "ROLE_EDITOR" })).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.roles.description), {
      target: { value: "Updated description" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.saveDescription }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          data: { name: "ROLE_EDITOR", description: "Updated description" },
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.roles.descriptionSaved);
  });

  it("searches, assigns, navigates to, and removes role users", async () => {
    render(<RoleDetail locale="en" dictionary={dictionary} name="ROLE_EDITOR" tab="users" />);
    expect(await screen.findByText("ada")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: dictionary.admin.roles.searchUsers }), {
      target: { value: "gra" },
    });
    expect(await screen.findByRole("button", { name: /grace/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /grace/ }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.assign }));
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.roles.assignmentSaved),
    );
    fireEvent.click(screen.getByRole("button", { name: "ada" }));
    expect(mockPush).toHaveBeenCalledWith("/admin/users/1/details");
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.remove }));
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.roles.assignmentRemoved),
    );
  });

  it("shows an error when the role cannot be loaded", async () => {
    mockAdminRequest.mockRejectedValueOnce(new Error("network"));
    render(<RoleDetail locale="en" dictionary={dictionary} name="MISSING" />);
    expect(await screen.findByText(dictionary.admin.roles.operationError)).toBeVisible();
  });
});
