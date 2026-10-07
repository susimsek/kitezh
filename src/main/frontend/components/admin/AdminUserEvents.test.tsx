import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminUserEvents from "./AdminUserEvents";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageEvents: true } }),
}));
jest.mock("@/routing/navigation", () => ({ usePathname: () => "/admin/events/user" }));

describe("AdminUserEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: { content: [], totalElements: 0, totalPages: 0 },
    } as never);
  });

  it("loads filters and displays user event details", async () => {
    const event = {
      id: "user-event-1",
      username: "alice",
      type: "LOGIN_FAILURE",
      clientId: "admin-console",
      ipAddress: "192.0.2.10",
      occurredAt: "2026-01-01T00:00:00Z",
    };
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: { content: [event], totalElements: 1, totalPages: 1 },
    } as never);
    render(<AdminUserEvents />);
    expect(await screen.findByText("LOGIN_FAILURE")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.userFilter }));
    fireEvent.change(screen.getByRole("combobox", { name: dictionary.admin.events.type }), {
      target: { value: "LOGIN_FAILURE" },
    });
    fireEvent.click(screen.getByText("alice").closest("tr")!);
    expect(screen.getByText(dictionary.admin.events.userDetails)).toBeVisible();
    expect(screen.getAllByText("admin-console").length).toBeGreaterThan(0);
  });

  it("clears user event history", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) =>
      config.method === "DELETE"
        ? ({ status: 204, data: null } as never)
        : ({ status: 200, data: { content: [], totalElements: 0, totalPages: 0 } } as never),
    );
    render(<AdminUserEvents />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.events.userClearAll }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.events.userClearAll })[1],
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/admin/user-events",
      }),
    );
    expect(screen.getByText(dictionary.admin.events.userClearAllSuccess)).toBeVisible();
  });
});
