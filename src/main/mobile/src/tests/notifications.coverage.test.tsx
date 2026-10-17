import {
  act,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { cleanup, fireEvent } from "@testing-library/react-native";
import NotificationsScreen from "@/app/notifications";
import { listAccountNotifications, getAccountUnreadNotificationCount, markAccountNotificationRead } from "@/api/account-api";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

const mockSession = { accessToken: "access-token" };
const mockRefreshSession = jest.fn(async () => mockSession);

jest.mock("expo-router", () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/AccountTabBar", () => ({ AccountTabBar: () => null }));
jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => ({
    session: mockSession,
    status: "signed-in",
    refreshSession: mockRefreshSession,
  }),
}));
jest.mock("@/api/account-api", () => ({
  getAccountUnreadNotificationCount: jest.fn(),
  listAccountNotifications: jest.fn(),
  markAccountNotificationRead: jest.fn(),
}));

function renderNotifications() {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <NotificationsScreen />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listAccountNotifications).mockResolvedValue({
    content: [
      {
        id: "notice-1",
        messageKey: "notificationAccountMfaEnabled",
        createdAt: "2026-10-17T10:00:00Z",
        read: false,
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
  });
  jest.mocked(getAccountUnreadNotificationCount).mockResolvedValue(1);
  jest.mocked(markAccountNotificationRead).mockResolvedValue(undefined);
});

afterEach(cleanup);

it("loads localized account notifications and marks them read once", async () => {
  renderNotifications();

  expect(await screen.findByText("Multi-factor authentication was enabled.")).toBeTruthy();
  expect(screen.getByText("Unread notifications: 1")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Mark as read" }));
    await Promise.resolve();
  });

  await waitFor(() =>
    expect(markAccountNotificationRead).toHaveBeenCalledWith(
      "access-token",
      "notice-1",
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
  expect(await screen.findByText("Read")).toBeTruthy();
  expect(screen.getByText("Unread notifications: 0")).toBeTruthy();
});

it("uses a safe localized fallback for unknown notification keys", async () => {
  jest.mocked(listAccountNotifications).mockResolvedValueOnce({
    content: [
      {
        id: "notice-unknown",
        messageKey: "untrusted-user-data",
        createdAt: "not-a-date",
        read: true,
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
  });

  renderNotifications();
  expect(await screen.findByText("A notification is available.")).toBeTruthy();
  expect(screen.queryByText("untrusted-user-data")).toBeNull();
});

it("renders localized retry after a notification request fails", async () => {
  jest.mocked(listAccountNotifications).mockRejectedValueOnce(new Error("offline"));
  renderNotifications();

  expect(await screen.findByText("We could not load notifications. Try again.")).toBeTruthy();
  jest.mocked(listAccountNotifications).mockResolvedValueOnce({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 20,
  });
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("You have no notifications.")).toBeTruthy();
});
