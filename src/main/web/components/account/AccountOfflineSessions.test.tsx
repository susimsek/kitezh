import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { requestAccount } from "@/lib/account-api";

import { AccountOfflineSessions } from "./AccountOfflineSessions";

const mockRequestAccount = requestAccount as jest.MockedFunction<typeof requestAccount>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/account-api", () => ({ requestAccount: jest.fn() }));
jest.mock("./AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "token" }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/i18n/useDateTimeFormatter", () => ({
  useDateTimeFormatter: () => (value: string) => `formatted:${value}`,
}));
jest.mock("@/components/admin/useAdminTableState", () => ({
  useAdminTableState: () => ({ page: 0, size: 10, setPage: jest.fn(), setSize: jest.fn() }),
}));
jest.mock("@/components/admin/PaginationControls", () => ({
  PaginationControls: () => <div data-testid="pagination" />,
}));
jest.mock("@/components/admin/ConfirmModal", () => ({
  ConfirmModal: ({
    show,
    confirmLabel,
    onConfirm,
  }: {
    show: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    show ? (
      <div role="dialog">
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
}));

const data = {
  content: [
    {
      id: "offline-1",
      clientId: "account-console",
      clientName: "Account Console",
      issuedAt: "2026-10-01T10:00:00Z",
      expiresAt: "2026-10-31T10:00:00Z",
    },
  ],
  number: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

describe("AccountOfflineSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestAccount.mockResolvedValue(data as never);
  });

  it("loads, displays, and revokes an offline session", async () => {
    render(<AccountOfflineSessions dictionary={dictionary} />);
    expect(await screen.findByText("Account Console")).toBeVisible();
    expect(mockRequestAccount).toHaveBeenCalledWith("token", {
      url: "/api/account/offline-sessions?page=0&size=10",
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.account.applications.offlineRevoke }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.applications.offlineRevoke,
      }),
    );
    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/account/offline-sessions/offline-1",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.account.applications.offlineRevoked);
  });

  it("renders the empty and error states", async () => {
    mockRequestAccount.mockResolvedValueOnce({
      ...data,
      content: [],
      totalElements: 0,
      totalPages: 0,
    } as never);
    const view = render(<AccountOfflineSessions dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.account.applications.offlineEmpty)).toBeVisible();
    view.unmount();

    mockRequestAccount.mockRejectedValueOnce(new Error("unavailable"));
    render(<AccountOfflineSessions dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.account.common.operationError)).toBeVisible();
    expect(mockAddError).not.toHaveBeenCalled();
  });
});
