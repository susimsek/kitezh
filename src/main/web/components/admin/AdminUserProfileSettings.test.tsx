import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import AdminUserProfileSettings from "./AdminUserProfileSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAccess: { isAdmin: boolean } = { isAdmin: true };
let mockAccessToken: string | null = "token";
const mockTableState = {
  clearFilters: jest.fn(),
  page: 0,
  query: "",
  setPage: jest.fn(),
  setQuery: jest.fn(),
  setSize: jest.fn(),
  setSort: jest.fn(),
  size: 10,
  sort: "displayOrder,asc",
};

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: mockAccessToken, access: mockAccess }),
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => mockTableState,
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
    mockAccess.isAdmin = true;
    mockAccessToken = "token";
    mockTableState.page = 0;
    mockTableState.query = "";
    mockTableState.size = 10;
    mockTableState.sort = "displayOrder,asc";
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

  it("supports the downward keyboard and row drag events", async () => {
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
    const rows = screen.getAllByRole("row").slice(1);
    const dataTransfer = { dropEffect: "none" };
    fireEvent.dragOver(rows[0]!, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("move");
    fireEvent.drop(rows[0]!, { dataTransfer });
    fireEvent.keyDown(handles[0]!, { key: "ArrowDown" });

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

  it("restores the previous order after a rejected reorder and renders mixed profile rules", async () => {
    const first = {
      ...definition(1, "department", 10),
      required: true,
      multivalued: true,
      pattern: "^[A-Z]+$",
    };
    const second = {
      ...definition(2, "active", 20),
      type: "BOOLEAN",
      builtIn: true,
      enabled: false,
    };
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [first, second], totalPages: 1, totalElements: 2 },
      } as never)
      .mockResolvedValueOnce({ status: 500, data: null } as never);

    render(<AdminUserProfileSettings dictionary={dictionary} />);
    const handles = await screen.findAllByRole("button", {
      name: new RegExp(dictionary.admin.userProfileSettings.reorder),
    });
    expect(
      screen.getByText(`Required · ${dictionary.admin.userProfileSettings.multivalued} · ^[A-Z]+$`),
    ).toBeVisible();
    expect(screen.getByText(dictionary.admin.userProfileSettings.types.boolean)).toBeVisible();
    expect(screen.getByText(dictionary.admin.userProfileSettings.noRules)).toBeVisible();

    fireEvent.keyDown(handles[1], { key: "ArrowUp" });
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.userProfileSettings.error)).toBeVisible(),
    );
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelectorAll("td")[1]?.textContent?.trim());
    expect(names).toEqual(["departmentdepartment", "activeactive"]);
  });

  it("captures and releases a pointer drag when its pointer is cancelled", async () => {
    const first = definition(1, "department", 10);
    const second = definition(2, "employeeNumber", 20);
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: { content: [first, second], totalPages: 1, totalElements: 2 },
    } as never);

    const originalElementFromPoint = document.elementFromPoint;
    render(<AdminUserProfileSettings dictionary={dictionary} />);
    const handles = await screen.findAllByRole("button", {
      name: new RegExp(dictionary.admin.userProfileSettings.reorder),
    });
    const handle = handles[1];
    const row = handle.closest("tr");
    const setPointerCapture = jest.fn();
    const hasPointerCapture = jest.fn().mockReturnValue(true);
    const releasePointerCapture = jest.fn();
    Object.defineProperty(handle, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(handle, "hasPointerCapture", {
      configurable: true,
      value: hasPointerCapture,
    });
    Object.defineProperty(handle, "releasePointerCapture", {
      configurable: true,
      value: releasePointerCapture,
    });
    document.elementFromPoint = jest.fn(() => null);

    const pointerEvent = (type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, "pointerId", { value: 5 });
      return event;
    };
    fireEvent(handle, pointerEvent("pointerdown"));
    fireEvent(handle, pointerEvent("pointermove"));
    fireEvent(handle, pointerEvent("pointercancel"));

    expect(setPointerCapture).toHaveBeenCalledWith(5);
    expect(hasPointerCapture).toHaveBeenCalledWith(5);
    expect(releasePointerCapture).toHaveBeenCalledWith(5);
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ url: "/api/admin/settings/user-profile/order" }),
    );
    document.elementFromPoint = originalElementFromPoint;
    expect(row).toBeInTheDocument();
  });

  it("moves to the previous page after deleting its last profile definition", async () => {
    mockTableState.page = 2;
    const item = definition(3, "department", 30);
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 200,
        data: { content: [item], totalPages: 3, totalElements: 21 },
      } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never);

    render(<AdminUserProfileSettings dictionary={dictionary} />);
    expect(await screen.findAllByText("department")).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", {
        name: new RegExp(dictionary.admin.userProfileSettings.reorder),
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /department/ }));
    fireEvent.click(screen.getByText(dictionary.admin.userProfileSettings.delete));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.userProfileSettings.delete }).at(-1)!,
    );

    await waitFor(() => expect(mockTableState.setPage).toHaveBeenCalledWith(1));
  });

  it("hides create, reorder, and delete controls without administrator access", async () => {
    mockAccess.isAdmin = false;
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: {
        content: [
          definition(1, "department", 10),
          { ...definition(2, "active", 20), builtIn: true },
        ],
        totalPages: 1,
        totalElements: 2,
      },
    } as never);

    render(<AdminUserProfileSettings dictionary={dictionary} />);
    expect(await screen.findByRole("link", { name: "department" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: dictionary.admin.userProfileSettings.create }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(dictionary.admin.userProfileSettings.reorder),
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /department/ }));
    expect(screen.getByText(dictionary.admin.userProfileSettings.edit)).toBeVisible();
    expect(screen.queryByText(dictionary.admin.userProfileSettings.delete)).not.toBeInTheDocument();
  });
});
