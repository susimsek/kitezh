import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminOfflineAccessSettings from "./AdminOfflineAccessSettings";
import AdminOfflineSessions from "./AdminOfflineSessions";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockSetPage = jest.fn();
const mockSetSize = jest.fn();

jest.mock("@/i18n/client", () => ({ useDictionary: () => dictionary }));
jest.mock("@/i18n/useDateTimeFormatter", () => ({
  useDateTimeFormatter: () => (value: string) => `formatted:${value}`,
}));
jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { isAdmin: true, manageConsents: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    page: 0,
    size: 20,
    setPage: mockSetPage,
    setSize: mockSetSize,
  }),
}));
jest.mock("./AdminPageHeader", () => ({
  AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("./DataTable", () => ({
  DataTable: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <>
      <table>{children}</table>
      {footer}
    </>
  ),
}));
jest.mock("./PaginationControls", () => ({
  PaginationControls: () => <div data-testid="pagination" />,
}));
jest.mock("./ConfirmModal", () => ({
  ConfirmModal: ({
    show,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    show: boolean;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    show ? (
      <div role="dialog">
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>{dictionary.admin.common.cancel}</button>
      </div>
    ) : null,
}));

const policy = {
  idleTimeout: "P30D",
  maxLifespan: null,
  maxLimited: false,
  revokedBefore: null,
};

const sessions = {
  content: [
    {
      id: "offline-1",
      username: "admin",
      clientId: "account-console",
      clientName: "Account Console",
      issuedAt: "2026-10-01T10:00:00Z",
      expiresAt: null,
    },
  ],
  number: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe("offline access administration components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockResolvedValue({ status: 200, data: policy } as never);
  });

  it("loads and saves the offline access policy with validated fields", async () => {
    render(<AdminOfflineAccessSettings />);
    const save = await screen.findByRole("button", { name: dictionary.admin.offlineAccess.save });
    fireEvent.change(screen.getByLabelText(dictionary.admin.offlineAccess.idleTimeout), {
      target: { value: "PT1H" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: dictionary.admin.offlineAccess.maxLimited }),
    );
    fireEvent.change(screen.getByLabelText(dictionary.admin.offlineAccess.maxLifespan), {
      target: { value: "P180D" },
    });
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "PUT",
        url: "/api/admin/settings/offline-access",
        data: { idleTimeout: "PT1H", maxLifespan: "P180D", maxLimited: true },
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.offlineAccess.saved);
  });

  it("reports policy load failures and revokes all offline tokens", async () => {
    mockAdminRequest.mockRejectedValueOnce(new Error("load failed"));
    render(<AdminOfflineAccessSettings />);
    expect(await screen.findByText(dictionary.admin.offlineAccess.error)).toBeVisible();

    mockAdminRequest.mockResolvedValue({ status: 200, data: policy } as never);
    render(<AdminOfflineAccessSettings />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.offlineAccess.revokeAll }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.offlineAccess.revokeAll,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "POST",
        url: "/api/admin/settings/offline-access/revoke-all",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.offlineAccess.revoked);
  });

  it("lists and revokes an offline session", async () => {
    mockAdminRequest.mockResolvedValue({ status: 200, data: sessions } as never);
    render(<AdminOfflineSessions />);
    expect(await screen.findByText("Account Console")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.revoke }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.resources.revoke,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/admin/offline-sessions/offline-1",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.resources.offlineRevoked);
  });
});
