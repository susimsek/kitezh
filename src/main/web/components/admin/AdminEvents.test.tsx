import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminEventsPage from "./AdminEvents";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageEvents: true } }),
}));
jest.mock("@/routing/navigation", () => ({
  usePathname: () => "/admin/events",
}));

describe("AdminEvents", () => {
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
    mockAdminRequest.mockImplementation((_token, config) => {
      if (config.method === "DELETE") {
        return Promise.resolve({ status: 204, data: null }) as never;
      }
      return Promise.resolve({
        status: 200,
        data: { content: [], totalElements: 0, totalPages: 0 },
      }) as never;
    });
  });

  it("clears all events and shows success feedback", async () => {
    render(<AdminEventsPage />);

    fireEvent.click(await screen.findByRole("button", { name: dictionary.admin.events.clearAll }));
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.events.clearAll })[1]);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/admin/events",
      }),
    );
    expect(screen.getByText(dictionary.admin.events.clearAllSuccess)).toBeVisible();
  });

  it("filters event details and surfaces clear failures", async () => {
    const event = {
      id: "event-1",
      actor: "admin",
      action: "user.updated",
      targetType: "user",
      targetId: "42",
      occurredAt: "2026-01-01T00:00:00Z",
    };
    mockAdminRequest.mockImplementation(async (_token, config) =>
      config.method === "DELETE"
        ? ({ status: 500, data: null } as never)
        : ({ status: 200, data: { content: [event], totalElements: 1, totalPages: 1 } } as never),
    );
    render(<AdminEventsPage />);
    expect(await screen.findByText("user.updated")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.filterEvents }));
    fireEvent.change(screen.getByRole("combobox", { name: dictionary.admin.events.action }), {
      target: { value: "user.updated" },
    });
    fireEvent.click(screen.getByText("admin").closest("tr")!);
    expect(screen.getByText(dictionary.admin.events.details)).toBeVisible();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.clearAll }));
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.events.clearAll })[1]);
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.events.clearAllError)).toBeVisible(),
    );
  });

  it("exercises every event filter and closes the detail drawer", async () => {
    const event = {
      id: "event-2",
      actor: "admin",
      action: "client.updated",
      targetType: "client",
      targetId: "client-1",
      occurredAt: "2026-01-01T00:00:00Z",
    };
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: { content: [event], totalElements: 1, totalPages: 1 },
    } as never);
    render(<AdminEventsPage />);
    expect(await screen.findByText("client.updated")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.filterEvents }));
    fireEvent.change(screen.getByRole("combobox", { name: dictionary.admin.events.targetType }), {
      target: { value: "client" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.events.targetId }), {
      target: { value: "client-1" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.events.from), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.events.to), {
      target: { value: "2026-01-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.hideFilters }));
    fireEvent.click(screen.getByText("admin").closest("tr")!);
    expect(await screen.findByText(dictionary.admin.events.details)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(event.id)).not.toBeInTheDocument();
  });
});
