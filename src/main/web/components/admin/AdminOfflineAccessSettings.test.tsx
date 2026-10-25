import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import AdminOfflineAccessSettings from "./AdminOfflineAccessSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockDictionary = dictionary;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({ useDictionary: () => mockDictionary }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { isAdmin: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

const policy = {
  idleTimeout: "P30D",
  maxLifespan: null,
  maxLimited: false,
  revokedBefore: null,
};

describe("AdminOfflineAccessSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockResolvedValue({ status: 200, data: policy } as never);
  });

  it("loads, validates, and saves bounded offline access settings", async () => {
    render(<AdminOfflineAccessSettings />);
    const save = await screen.findByRole("button", { name: dictionary.admin.offlineAccess.save });
    const idle = screen.getByLabelText(dictionary.admin.offlineAccess.idleTimeout);
    const max = screen.getByLabelText(dictionary.admin.offlineAccess.maxLifespan);

    fireEvent.change(idle, { target: { value: "invalid" } });
    fireEvent.click(save);
    expect(await screen.findByText(dictionary.admin.common.validation.invalid)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledTimes(1);

    fireEvent.change(idle, { target: { value: "P14D" } });
    fireEvent.click(screen.getByLabelText(dictionary.admin.offlineAccess.maxLimited));
    fireEvent.click(save);
    expect(await screen.findAllByText(dictionary.admin.common.validation.invalid)).toHaveLength(1);

    fireEvent.change(max, { target: { value: " P90D " } });
    mockAdminRequest.mockResolvedValueOnce({
      status: 200,
      data: { ...policy, idleTimeout: "P14D", maxLifespan: "P90D", maxLimited: true },
    } as never);
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenLastCalledWith("token", {
        method: "PUT",
        url: "/api/admin/settings/offline-access",
        data: { idleTimeout: "P14D", maxLifespan: "P90D", maxLimited: true },
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.offlineAccess.saved);
  });

  it("reports save and revoke errors, then confirms a successful revoke", async () => {
    render(<AdminOfflineAccessSettings />);
    const save = await screen.findByRole("button", { name: dictionary.admin.offlineAccess.save });
    mockAdminRequest.mockResolvedValueOnce({ status: 503, data: null } as never);
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.offlineAccess.error),
    );

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.offlineAccess.revokeAll }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", {
      name: dictionary.admin.offlineAccess.revokeAll,
    });
    mockAdminRequest.mockRejectedValueOnce(new Error("unavailable"));
    fireEvent.click(confirm);
    await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(2));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.common.cancel,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.offlineAccess.revokeAll }));
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: policy } as never);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.offlineAccess.revokeAll,
      }),
    );
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.offlineAccess.revoked),
    );
  });

  it("shows a recoverable load error", async () => {
    mockAdminRequest.mockRejectedValueOnce(new Error("offline"));
    render(<AdminOfflineAccessSettings />);
    expect(await screen.findByText(dictionary.admin.offlineAccess.error)).toBeVisible();
  });
});
