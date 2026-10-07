import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminEventListenerSettings from "./AdminEventListenerSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageEvents: true } }),
}));

describe("AdminEventListenerSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockImplementation((_token, config) => {
      if (config.method === "POST") {
        return Promise.resolve({ status: 200, data: {} }) as never;
      }
      return Promise.resolve({
        status: 200,
        data: { content: [], totalElements: 0, totalPages: 0 },
      }) as never;
    });
  });

  it("creates a listener provider from the settings form", async () => {
    render(<AdminEventListenerSettings />);

    await screen.findByText(dictionary.admin.events.listenerEmpty);
    fireEvent.change(screen.getByLabelText(dictionary.admin.events.listenerName), {
      target: { value: "security-webhook" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.events.listenerEndpoint), {
      target: { value: "https://example.test/events" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.events.listenerSave }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/event-listeners",
          data: expect.objectContaining({
            name: "security-webhook",
            endpointUrl: "https://example.test/events",
            providerType: "WEBHOOK",
          }),
        }),
      ),
    );
  });
});
