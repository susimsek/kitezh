import { act, fireEvent, render, screen, waitFor } from "@/testing/native-testing-library";
import { Alert } from "react-native";
import * as adminApi from "@/api/admin-api";
import { GroupMemberships } from "@/admin/GroupMemberships";
import { RoleMemberships } from "@/admin/RoleMemberships";

const mockRefreshSession = jest.fn(async () => ({ accessToken: "access-token" }));
const mockShowNotice = jest.fn();

jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => ({ session: { accessToken: "access-token" }, refreshSession: mockRefreshSession }),
}));
jest.mock("@/api/admin-api", () => ({
  AdminApiError: class AdminApiError extends Error {
    status: number;
    kind: string;
    constructor(status: number, kind = "http") {
      super("mock admin API error");
      this.status = status;
      this.kind = kind;
    }
  },
  addAdminGroupUser: jest.fn(),
  assignAdminRoleUser: jest.fn(),
  getAdminRoleDetail: jest.fn(),
  listAdminAvailableGroupUsers: jest.fn(),
  listAdminAvailableRoleUsers: jest.fn(),
  listAdminGroupUsers: jest.fn(),
  removeAdminGroupUser: jest.fn(),
  removeAdminRoleUser: jest.fn(),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({ dictionary: new Proxy({}, { get: (_target, key) => String(key) }) }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({ palette: new Proxy({}, { get: (_target, key) => String(key) }) }),
}));
jest.mock("@/theme/tokens", () => ({
  radii: { sm: 4, md: 8 },
  spacing: { xs: 4, sm: 8, md: 12 },
}));
jest.mock("@/components/MobileNoticeProvider", () => ({
  useMobileNotice: () => ({ showNotice: mockShowNotice }),
}));

const assignedGroupUser: adminApi.AdminGroupUser = { id: 1, username: "alice", enabled: true };
const availableGroupUser: adminApi.AdminGroupUser = { id: 2, username: "bob", enabled: false };
const assignedRoleUser: adminApi.AdminRoleUser = { id: 3, username: "carol", enabled: true };
const availableRoleUser: adminApi.AdminRoleUser = { id: 4, username: "dave", enabled: false };

function page<T>(content: T[]): adminApi.AdminPage<T> {
  return { content, number: 0, size: 10, totalElements: content.length, totalPages: 1 };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshSession.mockResolvedValue({ accessToken: "access-token" });
  jest.mocked(adminApi.listAdminGroupUsers).mockResolvedValue(page([assignedGroupUser]));
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue(page([availableGroupUser]));
  jest.mocked(adminApi.getAdminRoleDetail).mockResolvedValue({
    name: "operator",
    description: null,
    userCount: 1,
    protectedRole: false,
    users: page([assignedRoleUser]),
    compositeRoles: [],
    compositeClientRoles: [],
  });
  jest.mocked(adminApi.listAdminAvailableRoleUsers).mockResolvedValue(page([availableRoleUser]));
  jest.mocked(adminApi.addAdminGroupUser).mockResolvedValue(undefined);
  jest.mocked(adminApi.assignAdminRoleUser).mockResolvedValue(undefined);
  jest.mocked(adminApi.removeAdminGroupUser).mockResolvedValue(undefined);
  jest.mocked(adminApi.removeAdminRoleUser).mockResolvedValue(undefined);
});

test("loads group members and assigns an available user with success feedback", async () => {
  render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  expect(await screen.findByText("alice")).toBeTruthy();
  expect(screen.getByText("bob")).toBeTruthy();
  expect(screen.getByText("adminDisabled")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("adminRoleUserSearch"), "bob");
  await waitFor(() => expect(adminApi.listAdminGroupUsers).toHaveBeenLastCalledWith(
    "access-token", 7, "bob", 0, 10, expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));

  fireEvent.press(screen.getByRole("button", { name: "adminAddGroupUser" }));
  await waitFor(() => expect(adminApi.addAdminGroupUser).toHaveBeenCalledWith(
    "access-token", 7, 2, expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));
  expect(mockShowNotice).toHaveBeenCalledWith({ kind: "success", message: "adminGroupUserAdded" });
});

test("confirms group removal and reports a forbidden membership update", async () => {
  jest.mocked(adminApi.removeAdminGroupUser).mockRejectedValueOnce(new adminApi.AdminApiError(403));
  let confirmRemove: (() => void) | undefined;
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    confirmRemove = buttons?.find((button) => button.style === "destructive")?.onPress;
  });
  render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  fireEvent.press(await screen.findByRole("button", { name: "adminRemoveGroupUser" }));
  expect(alert).toHaveBeenCalledWith("adminRemoveGroupUser", "adminRemoveGroupUserPrompt", expect.any(Array));
  await act(async () => confirmRemove?.());
  await waitFor(() => expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message: "adminForbidden" }));
  alert.mockRestore();
});

test("assigns and removes role users through the role membership API", async () => {
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  expect(await screen.findByText("carol")).toBeTruthy();
  expect(screen.getByText("dave")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminRoleAssignUser" }));
  await waitFor(() => expect(adminApi.assignAdminRoleUser).toHaveBeenCalledWith(
    "access-token", "operator", 4, 0, 10, expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));
  expect(mockShowNotice).toHaveBeenCalledWith({ kind: "success", message: "adminRoleUserAssigned" });

  jest.mocked(adminApi.removeAdminRoleUser).mockRejectedValueOnce(new Error("offline"));
  let confirmRemove: (() => void) | undefined;
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    confirmRemove = buttons?.find((button) => button.style === "destructive")?.onPress;
  });
  fireEvent.press(screen.getByRole("button", { name: "adminRoleRemoveUser" }));
  await act(async () => confirmRemove?.());
  await waitFor(() => expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error", message: "adminRoleUserActionError",
  }));
  alert.mockRestore();
});

test("shows empty membership lists and requests later pages for groups and roles", async () => {
  jest.mocked(adminApi.listAdminGroupUsers).mockResolvedValue({ ...page([]), totalPages: 2 });
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue({ ...page([]), totalPages: 2 });
  const group = render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  expect(await screen.findByText("adminNoGroupMembers")).toBeTruthy();
  expect(screen.getByText("adminNoAvailableUsers")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminNext" }));
  await waitFor(() => expect(adminApi.listAdminGroupUsers).toHaveBeenLastCalledWith(
    "access-token", 7, "", 1, 10, expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));
  fireEvent.press(screen.getByRole("button", { name: "adminPrevious" }));
  await waitFor(() => expect(adminApi.listAdminGroupUsers).toHaveBeenLastCalledWith(
    "access-token", 7, "", 0, 10, expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));
  group.unmount();

  jest.mocked(adminApi.getAdminRoleDetail).mockResolvedValue({
    name: "operator",
    description: null,
    userCount: 0,
    protectedRole: false,
    users: { ...page([]), totalPages: 2 },
    compositeRoles: [],
    compositeClientRoles: [],
  });
  jest.mocked(adminApi.listAdminAvailableRoleUsers).mockResolvedValue({ ...page([]), totalPages: 2 });
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  expect(await screen.findByText("adminRoleNoUsers")).toBeTruthy();
  expect(screen.getByText("adminRoleNoAvailableUsers")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "adminNext" }));
  await waitFor(() => expect(adminApi.getAdminRoleDetail).toHaveBeenLastCalledWith(
    "access-token", "operator", "", undefined, 1, 10,
    expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
  ));
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(0, "offline"), "adminApiOfflineError"],
  [new adminApi.AdminApiError(0, "timeout"), "adminApiTimeoutError"],
  [new adminApi.AdminApiError(500), "adminLoadError"],
  [new Error("unexpected load failure"), "adminLoadError"],
] as const)("shows a recoverable group membership read error: %s", async (failure, message) => {
  jest.mocked(adminApi.listAdminGroupUsers).mockRejectedValue(failure);
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue(page([]));
  render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  expect(await screen.findByText(message)).toBeTruthy();
  jest.mocked(adminApi.listAdminGroupUsers).mockResolvedValue(page([assignedGroupUser]));
  jest.mocked(adminApi.listAdminAvailableGroupUsers).mockResolvedValue(page([availableGroupUser]));
  fireEvent.press(screen.getByRole("button", { name: "adminRetry" }));
  expect(await screen.findByText("alice")).toBeTruthy();
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(0, "offline"), "adminApiOfflineError"],
  [new adminApi.AdminApiError(0, "timeout"), "adminApiTimeoutError"],
  [new adminApi.AdminApiError(500), "adminActionError"],
  [new Error("unexpected membership failure"), "adminActionError"],
] as const)("localizes group assignment failures: %s", async (failure, message) => {
  jest.mocked(adminApi.addAdminGroupUser).mockRejectedValueOnce(failure);
  render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  fireEvent.press(await screen.findByRole("button", { name: "adminAddGroupUser" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({ kind: "error", message }),
  );
  expect(adminApi.addAdminGroupUser).toHaveBeenCalledTimes(1);
});

test("does not query group memberships when refresh cannot recover a session", async () => {
  mockRefreshSession.mockResolvedValueOnce(null);
  render(<GroupMemberships groupId={7} groupName="Engineering" onClose={jest.fn()} />);

  expect(await screen.findByText("adminNoGroupMembers")).toBeTruthy();
  expect(screen.getByText("adminNoAvailableUsers")).toBeTruthy();
  expect(adminApi.listAdminGroupUsers).not.toHaveBeenCalled();
  expect(adminApi.listAdminAvailableGroupUsers).not.toHaveBeenCalled();
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(500), "adminRoleUserActionError"],
] as const)("localizes role assignment failure for %s", async (failure, message) => {
  jest.mocked(adminApi.assignAdminRoleUser).mockRejectedValueOnce(failure);
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  fireEvent.press(await screen.findByRole("button", { name: "adminRoleAssignUser" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({ kind: "error", message }),
  );
});

test("keeps role membership actions disabled while assignment is pending", async () => {
  let completeAssignment!: () => void;
  jest.mocked(adminApi.assignAdminRoleUser).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeAssignment = resolve;
      }),
  );
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  const assign = await screen.findByRole("button", {
    name: "adminRoleAssignUser",
  });
  fireEvent.press(assign);
  await waitFor(() =>
    expect(assign.props.accessibilityState.disabled).toBe(true),
  );
  expect(screen.getByLabelText("loading")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "adminRoleRemoveUser" }).props
      .accessibilityState.disabled,
  ).toBe(true);

  await act(async () => completeAssignment());
  await waitFor(() =>
    expect(adminApi.assignAdminRoleUser).toHaveBeenCalledTimes(1),
  );
});

it.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new Error("role read failed"), "adminRoleUsersLoadError"],
] as const)("shows a role membership load error and recovers on search: %s", async (failure, message) => {
  jest.mocked(adminApi.getAdminRoleDetail).mockRejectedValue(failure);
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  expect(await screen.findByText(message)).toBeTruthy();
  jest.mocked(adminApi.getAdminRoleDetail).mockResolvedValue({
    name: "operator",
    description: null,
    userCount: 1,
    protectedRole: false,
    users: page([assignedRoleUser]),
    compositeRoles: [],
    compositeClientRoles: [],
  });
  fireEvent.changeText(screen.getByLabelText("adminRoleUserSearch"), "car");

  expect(await screen.findByText("carol")).toBeTruthy();
  expect(screen.queryByText(message)).toBeNull();
});

test("reports a missing refreshed session as an assignment failure", async () => {
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);
  await screen.findByText("dave");
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "adminRoleAssignUser" }));

  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenLastCalledWith({
      kind: "error",
      message: "adminRoleUserActionError",
    }),
  );
});

test("confirms a role removal and reports success", async () => {
  let confirmRemove: (() => void) | undefined;
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    confirmRemove = buttons?.find((button) => button.style === "destructive")?.onPress;
  });
  render(<RoleMemberships roleName="operator" onClose={jest.fn()} />);

  fireEvent.press(await screen.findByRole("button", { name: "adminRoleRemoveUser" }));
  expect(alert).toHaveBeenCalledWith(
    "adminRoleRemoveUser",
    "adminRoleRemoveUserConfirm",
    expect.any(Array),
  );
  await act(async () => confirmRemove?.());

  await waitFor(() =>
    expect(adminApi.removeAdminRoleUser).toHaveBeenCalledWith(
      "access-token",
      "operator",
      3,
      0,
      10,
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    ),
  );
  expect(mockShowNotice).toHaveBeenLastCalledWith({
    kind: "success",
    message: "adminRoleUserRemoved",
  });
  alert.mockRestore();
});
