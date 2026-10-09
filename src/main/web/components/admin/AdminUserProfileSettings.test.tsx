import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminUserProfileSettings from "./AdminUserProfileSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { isAdmin: true } }),
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
    sort: "displayOrder,asc",
  }),
}));

const definition = (id: number, name: string, displayOrder: number) => ({
  id,
  name,
  displayName: name,
  description: null,
  type: "STRING" as const,
  required: false,
  multivalued: false,
  minLength: null,
  maxLength: null,
  pattern: null,
  enabled: true,
  displayOrder,
  builtIn: false,
});

describe("AdminUserProfileSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists a keyboard reorder as a display order update", async () => {
    const first = definition(1, "department", 10);
    const second = definition(2, "employeeNumber", 20);
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [first, second], totalPages: 1, totalElements: 2 },
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: [definition(2, "employeeNumber", 10), definition(1, "department", 11)],
      } as never);

    render(<AdminUserProfileSettings dictionary={dictionary} />);
    const handles = await screen.findAllByRole("button", {
      name: new RegExp(dictionary.admin.userProfileSettings.reorder),
    });
    fireEvent.keyDown(handles[1], { key: "ArrowUp" });

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "PUT",
        url: "/api/admin/settings/user-profile/order",
        data: { ids: [2, 1] },
      }),
    );
  });

  it("persists a pointer reorder for trackpad dragging", async () => {
    const first = definition(1, "department", 10);
    const second = definition(2, "employeeNumber", 20);
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [first, second], totalPages: 1, totalElements: 2 },
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        data: [definition(2, "employeeNumber", 10), definition(1, "department", 11)],
      } as never);

    const elementFromPoint = document.elementFromPoint;
    render(<AdminUserProfileSettings dictionary={dictionary} />);
    const handles = await screen.findAllByRole("button", {
      name: new RegExp(dictionary.admin.userProfileSettings.reorder),
    });
    const targetRow = handles[0].closest("tr");
    document.elementFromPoint = jest.fn(() => targetRow);
    fireEvent.pointerDown(handles[1], { pointerId: 1 });
    fireEvent.pointerMove(handles[1], { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(handles[1], { pointerId: 1 });

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "PUT",
        url: "/api/admin/settings/user-profile/order",
        data: { ids: [2, 1] },
      }),
    );
    document.elementFromPoint = elementFromPoint;
  });

  it("renders load errors and handles delete success and failure", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    const errorView = render(<AdminUserProfileSettings dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.admin.userProfileSettings.error)).toBeVisible();
    errorView.unmount();

    const item = definition(3, "department", 10);
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [item], totalPages: 1, totalElements: 1 },
      } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    const view = render(<AdminUserProfileSettings dictionary={dictionary} />);
    expect((await screen.findAllByText("department"))[0]).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /department/ }));
    fireEvent.click(screen.getByText(dictionary.admin.userProfileSettings.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.userProfileSettings.delete }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );

    view.unmount();
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [item], totalPages: 1, totalElements: 1 },
      } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<AdminUserProfileSettings dictionary={dictionary} />);
    await screen.findAllByText("department");
    fireEvent.click(screen.getByRole("button", { name: /department/ }));
    fireEvent.click(screen.getByText(dictionary.admin.userProfileSettings.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.userProfileSettings.delete }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.userProfileSettings.error)).toBeVisible(),
    );
  });
});
