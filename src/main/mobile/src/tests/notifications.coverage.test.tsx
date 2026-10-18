import {
  act,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { cleanup, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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

it("keeps notification navigation and actions at Android's 48 dp touch target", async () => {
  jest.mocked(listAccountNotifications).mockResolvedValueOnce({
    content: [
      {
        id: "notice-1",
        messageKey: "notificationAccountMfaEnabled",
        createdAt: "2026-10-17T10:00:00Z",
        read: false,
      },
    ],
    totalElements: 2,
    totalPages: 2,
    number: 0,
    size: 1,
  });

  renderNotifications();

  const controls = [
    await screen.findByRole("button", { name: "Back" }),
    await screen.findByRole("button", { name: "Mark as read" }),
    await screen.findByRole("button", { name: "Next" }),
  ];

  for (const control of controls) {
    expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(48);
  }
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

it("shows retry when the account session expires during loading or marking read", async () => {
  mockRefreshSession.mockResolvedValueOnce(null);
  renderNotifications();

  expect(await screen.findByText("We could not load notifications. Try again.")).toBeTruthy();
  expect(listAccountNotifications).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("button", { name: "Mark as read" })).toBeTruthy();

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "Mark as read" }));

  expect(await screen.findByText("We could not load notifications. Try again.")).toBeTruthy();
  expect(markAccountNotificationRead).not.toHaveBeenCalled();
});

it("moves between notification pages and keeps navigation synchronized", async () => {
  jest.mocked(listAccountNotifications).mockImplementation(async (_token, options) => ({
    content: [{
      id: `notice-${options?.page ?? 0}`,
      messageKey: "notificationAccountPasswordChanged",
      createdAt: "2026-10-17T10:00:00Z",
      read: true,
    }],
    totalElements: 2,
    totalPages: 2,
    number: options?.page ?? 0,
    size: 1,
  }));

  renderNotifications();
  expect(await screen.findByText("1 / 2")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("2 / 2")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByText("1 / 2")).toBeTruthy();
  await waitFor(() => expect(listAccountNotifications).toHaveBeenLastCalledWith(
    "access-token",
    expect.objectContaining({ page: 0 }),
  ));
});

it("reloads the last valid page if the server reports fewer pages", async () => {
  jest.mocked(listAccountNotifications).mockImplementation(async (_token, options) => {
    const requestedPage = options?.page ?? 0;
    return {
      content: [],
      totalElements: 0,
      totalPages: requestedPage === 1 ? 1 : 2,
      number: requestedPage,
      size: 20,
    };
  });
  renderNotifications();
  expect(await screen.findByText("1 / 2")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(listAccountNotifications).toHaveBeenCalledTimes(3));
  expect(listAccountNotifications.mock.calls.map(([, options]) => options?.page)).toEqual([0, 1, 0]);
  expect(await screen.findByText("You have no notifications.")).toBeTruthy();
});

it("shows a retry state when marking a notification read fails", async () => {
  jest.mocked(markAccountNotificationRead).mockRejectedValueOnce(new Error("offline"));
  renderNotifications();

  fireEvent.press(await screen.findByRole("button", { name: "Mark as read" }));
  expect(await screen.findByText("We could not load notifications. Try again.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Unread notifications: 1")).toBeTruthy();
});

it("provides refresh callbacks for notification reads and mutations", async () => {
  renderNotifications();
  expect(await screen.findByRole("button", { name: "Mark as read" })).toBeTruthy();

  const listOptions = jest.mocked(listAccountNotifications).mock.calls[0]?.[1];
  const countOptions = jest.mocked(getAccountUnreadNotificationCount).mock.calls[0]?.[1];
  for (const options of [listOptions, countOptions]) {
    await expect(options?.refreshAccessToken?.()).resolves.toBe("access-token");
  }

  fireEvent.press(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(markAccountNotificationRead).toHaveBeenCalled());
  const mutationOptions = jest.mocked(markAccountNotificationRead).mock.calls[0]?.[2];
  mockRefreshSession.mockResolvedValueOnce(null);
  await expect(mutationOptions?.refreshAccessToken?.()).resolves.toBeNull();
});

it("disables repeated mark-read actions while the update is pending", async () => {
  let completeUpdate!: () => void;
  jest.mocked(markAccountNotificationRead).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeUpdate = resolve;
      }),
  );
  renderNotifications();

  const markRead = await screen.findByRole("button", { name: "Mark as read" });
  fireEvent.press(markRead);
  await waitFor(() =>
    expect(markRead.props.accessibilityState).toEqual({ busy: true, disabled: true }),
  );
  expect(markRead.props.children).toBeTruthy();
  fireEvent.press(markRead);
  expect(markAccountNotificationRead).toHaveBeenCalledTimes(1);

  await act(async () => completeUpdate());
  expect(await screen.findByText("Read")).toBeTruthy();
});
