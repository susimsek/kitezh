import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import AdminOfflineSessions from "./AdminOfflineSessions";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockDictionary = dictionary;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({ useDictionary: () => mockDictionary }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageConsents: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/routing/navigation", () => ({ usePathname: () => window.location.pathname }));
jest.mock("@/i18n/useDateTimeFormatter", () => ({
  useDateTimeFormatter: () => (value: string) => value,
}));

const result = {
  content: [
    {
      id: "offline/one",
      username: "ada",
      clientId: "account-console",
      clientName: "Account Console",
      issuedAt: "2026-10-01T10:00:00Z",
      expiresAt: null,
    },
  ],
  totalElements: 1,
  totalPages: 1,
};

describe("AdminOfflineSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockResolvedValue({ status: 200, data: result } as never);
  });

  it("lists sessions without an expiry and revokes a selected session", async () => {
    render(<AdminOfflineSessions />);
    expect(await screen.findByText("ada")).toBeVisible();
    expect(screen.getByText(dictionary.admin.resources.offlineNoExpiry)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.revoke }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.revoke,
      }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/admin/offline-sessions/offline%2Fone",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.resources.offlineRevoked);
  });

  it("renders empty and load-error states", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 200,
      data: { content: [], totalElements: 0, totalPages: 0 },
    } as never);
    const view = render(<AdminOfflineSessions />);
    expect(await screen.findByText(dictionary.admin.resources.empty)).toBeVisible();
    view.unmount();

    mockAdminRequest.mockRejectedValueOnce(new Error("offline"));
    render(<AdminOfflineSessions />);
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });

  it("reports a failed revocation without closing the confirmation", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "DELETE") return Promise.resolve({ status: 503, data: null }) as never;
      return Promise.resolve({ status: 200, data: result }) as never;
    });
    render(<AdminOfflineSessions />);
    expect(await screen.findByText("ada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.revoke }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.revoke,
      }),
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.resources.operationError),
    );
  });
});
