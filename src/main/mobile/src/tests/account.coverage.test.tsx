import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { Alert, StyleSheet } from "react-native";
import * as accountApi from "@/api/account-api";
import AccountScreen from "../app/account";
import ApplicationsScreen from "../app/applications";

jest.mock("@/api/account-api", () => {
  const actual =
    jest.requireActual<typeof import("@/api/account-api")>("@/api/account-api");
  return {
    AccountApiError: actual.AccountApiError,
    deleteAccountAvatar: jest.fn(),
    getAccountAvatar: jest.fn(),
    getAccountProfile: jest.fn(),
    getAccountProfileAttributes: jest.fn(),
    updateAccountProfile: jest.fn(),
    updateAccountProfileAttributes: jest.fn(),
    listAccountApplications: jest.fn(),
    listCibaRequests: jest.fn(),
    decideCibaRequest: jest.fn(),
    listOfflineSessions: jest.fn(),
    revokeAccountApplication: jest.fn(),
    revokeOfflineSession: jest.fn(),
    sendAccountVerificationEmail: jest.fn(),
    uploadAccountAvatar: jest.fn(),
  };
});
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({ size: 1024 })),
}));
const mockSignOut = jest.fn();
jest.mock("@/auth/MobileAuthProvider", () => {
  const session = { accessToken: "access" };
  const mockRefreshSession = jest.fn(async () => session);
  return {
    MobileAuthProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    mockRefreshSession,
    useMobileAuth: () => ({
      session,
      signIn: jest.fn(),
      signOut: mockSignOut,
      status: "signed-in",
      refreshSession: mockRefreshSession,
    }),
  };
});
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({
    dictionary: new Proxy({}, { get: (_target, key) => String(key) }),
    resolvedLocale: "en",
  }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({
    palette: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));
jest.mock("@/theme/tokens", () => ({
  radii: { sm: 4, md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
}));
jest.mock("@/components/MobileNoticeProvider", () => {
  const mockShowNotice = jest.fn();
  return {
    mockShowNotice,
    useMobileNotice: () => ({ showNotice: mockShowNotice }),
  };
});
jest.mock("@/components/AccountTabBar", () => ({ AccountTabBar: () => null }));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/BrandMark", () => ({ BrandMark: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));
const { mockShowNotice } = jest.requireMock(
  "@/components/MobileNoticeProvider",
);
const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");

function profile(emailVerified = true) {
  return {
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

async function renderAccountScreen() {
  const result = render(<AccountScreen />);
  await act(async () => {
    // The screen schedules its initial profile request in a microtask and then
    // awaits profile, attributes, and avatar sequentially. Flush that finite
    // mocked request chain inside act so its state updates belong to the test.
    for (let index = 0; index < 12; index += 1) {
      await Promise.resolve();
    }
  });
  return result;
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockShowNotice.mockClear();
  mockSignOut.mockClear();
  mockRefreshSession.mockReset().mockResolvedValue({ accessToken: "access" });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [],
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [],
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  jest.mocked(accountApi.getAccountProfileAttributes).mockResolvedValue({
    definitions: [],
    attributes: {},
  });
  jest.mocked(accountApi.updateAccountProfileAttributes).mockResolvedValue({
    definitions: [],
    attributes: {},
  });
  jest
    .mocked(accountApi.getAccountAvatar)
    .mockResolvedValue({ avatarUrl: null });
  jest
    .mocked(accountApi.sendAccountVerificationEmail)
    .mockResolvedValue(undefined);
  jest.mocked(accountApi.uploadAccountAvatar).mockResolvedValue({
    avatarUrl: "/avatars/current?v=1",
  });
  jest.mocked(accountApi.deleteAccountAvatar).mockResolvedValue(undefined);
  jest
    .mocked(jest.requireMock("expo-image-picker").launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  jest
    .mocked(jest.requireMock("expo-image-manipulator").manipulateAsync)
    .mockResolvedValue({ uri: "file:///profile.jpg", width: 200, height: 200 });
});

it("renders and validates configured account profile attributes", async () => {
  const definition = {
    id: 7,
    name: "department",
    displayName: "Department",
    description: "Your team",
    type: "INTEGER" as const,
    required: true,
    multivalued: false,
    minLength: 1,
    maxLength: 4,
    pattern: null,
    enabled: true,
    displayOrder: 10,
    builtIn: false,
  };
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest.mocked(accountApi.getAccountProfileAttributes).mockResolvedValue({
    definitions: [definition],
    attributes: {},
  });
  jest.mocked(accountApi.updateAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest.mocked(accountApi.updateAccountProfileAttributes).mockResolvedValue({
    definitions: [definition],
    attributes: { department: ["123"] },
  });

  await renderAccountScreen();
  const department = await screen.findByLabelText("Department");
  expect(screen.getByText("Your team")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("profileAttributeRequired")).toBeTruthy();
  expect(accountApi.updateAccountProfile).not.toHaveBeenCalled();

  fireEvent.changeText(department, "abc");
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("profileAttributeInvalid")).toBeTruthy();
  expect(accountApi.updateAccountProfile).not.toHaveBeenCalled();

  fireEvent.changeText(department, "123");
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(accountApi.updateAccountProfileAttributes).toHaveBeenCalledWith(
      "access",
      { department: ["123"] },
      expect.any(Object),
    ),
  );
});

it("rejects multiple values and malformed custom attribute values", async () => {
  const definitions = [
    ["department", "Department", "STRING", false, null],
    ["contact", "Contact email", "EMAIL", false, null],
    ["employees", "Employees", "INTEGER", false, null],
    ["enabledFlag", "Enabled flag", "BOOLEAN", false, null],
    ["code", "Code", "STRING", false, "["],
  ].map(([name, displayName, type, multivalued, pattern], index) => ({
    id: index + 1,
    name: name as string,
    displayName: displayName as string,
    description: null,
    type: type as "STRING" | "EMAIL" | "INTEGER" | "BOOLEAN",
    required: false,
    multivalued: multivalued as boolean,
    minLength: null,
    maxLength: null,
    pattern: pattern as string | null,
    enabled: true,
    displayOrder: index,
    builtIn: false,
  }));
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  jest.mocked(accountApi.getAccountProfileAttributes).mockResolvedValue({
    definitions,
    attributes: {
      department: ["Engineering", "Support"],
      contact: ["not-an-email"],
      employees: ["12x"],
      enabledFlag: ["sometimes"],
      code: ["anything"],
    },
  });

  await renderAccountScreen();
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  expect(await screen.findAllByText("profileAttributeInvalid")).toHaveLength(5);
  expect(accountApi.updateAccountProfile).not.toHaveBeenCalled();
});

it("supports native photo selection, JPEG upload, and cancellation", async () => {
  const picker = jest.mocked(
    jest.requireMock("expo-image-picker").launchImageLibraryAsync,
  );
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  picker.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///camera-roll.heic",
        width: 4000,
        height: 3000,
        fileName: "camera-roll.heic",
        fileSize: 8_000_000,
        mimeType: "image/heic",
      },
    ],
  });

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "accountAvatarChoose" }),
  );
  await waitFor(() =>
    expect(accountApi.uploadAccountAvatar).toHaveBeenCalledWith(
      "access",
      {
        uri: "file:///profile.jpg",
        name: "profile.jpg",
        type: "image/jpeg",
      },
      expect.any(Object),
    ),
  );
  expect(
    jest.mocked(jest.requireMock("expo-image-manipulator").manipulateAsync),
  ).toHaveBeenCalledWith(
    "file:///camera-roll.heic",
    [{ resize: { width: 2000, height: 1500 } }],
    { compress: 0.82, format: "jpeg" },
  );

  picker.mockResolvedValueOnce({ canceled: true, assets: null });
  fireEvent.press(screen.getByRole("button", { name: "accountAvatarChoose" }));
  await waitFor(() => expect(picker).toHaveBeenCalledTimes(2));
  expect(accountApi.uploadAccountAvatar).toHaveBeenCalledTimes(1);
});

it("rejects oversized transformed photos before upload", async () => {
  const picker = jest.mocked(
    jest.requireMock("expo-image-picker").launchImageLibraryAsync,
  );
  const fileSystem = jest.mocked(jest.requireMock("expo-file-system").File);
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  picker.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///large.jpg",
        width: 1000,
        height: 1000,
        fileName: "large.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
      },
    ],
  });
  fileSystem.mockImplementationOnce(() => ({ size: 2 * 1024 * 1024 + 1 }));

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "accountAvatarChoose" }),
  );

  expect(await screen.findByText("accountAvatarInvalid")).toBeTruthy();
  expect(accountApi.uploadAccountAvatar).not.toHaveBeenCalled();
});

it("rejects image picker assets with unusable dimensions", async () => {
  const picker = jest.mocked(
    jest.requireMock("expo-image-picker").launchImageLibraryAsync,
  );
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  picker.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///empty.jpg",
        width: 0,
        height: 500,
        fileName: "empty.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
      },
    ],
  });

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "accountAvatarChoose" }),
  );

  expect(await screen.findByText("accountAvatarInvalid")).toBeTruthy();
  expect(accountApi.uploadAccountAvatar).not.toHaveBeenCalled();
  expect(
    jest.mocked(jest.requireMock("expo-image-manipulator").manipulateAsync),
  ).not.toHaveBeenCalled();
});

it("maps avatar size rejection from the backend to the localized validation message", async () => {
  const picker = jest.mocked(
    jest.requireMock("expo-image-picker").launchImageLibraryAsync,
  );
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  picker.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///photo.jpg",
        width: 500,
        height: 500,
        fileName: "photo.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
      },
    ],
  });
  jest.mocked(accountApi.uploadAccountAvatar).mockRejectedValueOnce(
    new accountApi.AccountApiError(413, "Too large", {
      title: "Payload Too Large",
      status: 413,
    }),
  );

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "accountAvatarChoose" }),
  );

  expect(await screen.findByText("accountAvatarInvalid")).toBeTruthy();
});

it("shows localized picker permission errors and email verification feedback", async () => {
  const picker = jest.mocked(
    jest.requireMock("expo-image-picker").launchImageLibraryAsync,
  );
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile(false));
  picker.mockRejectedValueOnce(new Error("Photo library permission denied"));
  let completeVerification: (() => void) | undefined;
  jest.mocked(accountApi.sendAccountVerificationEmail).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeVerification = resolve;
      }),
  );

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "accountAvatarChoose" }),
  );
  expect(await screen.findByText("accountAvatarPermissionDenied")).toBeTruthy();

  const verifyButton = screen.getByRole("button", {
    name: "accountSendVerification",
  });
  fireEvent.press(verifyButton);
  fireEvent.press(verifyButton);
  await waitFor(() =>
    expect(accountApi.sendAccountVerificationEmail).toHaveBeenCalledTimes(1),
  );
  expect(
    screen.getByRole("button", { name: "accountSendVerification" }).props
      .accessibilityState,
  ).toEqual({ disabled: true });
  completeVerification?.();
  expect(await screen.findByText("accountVerificationSent")).toBeTruthy();
});

it("removes an existing avatar only after native confirmation", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  jest.mocked(accountApi.getAccountAvatar).mockResolvedValue({
    avatarUrl: "/avatars/alice?v=1",
  });
  let confirmRemove: (() => void) | undefined;
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    confirmRemove = buttons?.find((button) => button.style === "destructive")?.onPress;
  });

  await renderAccountScreen();
  fireEvent.press(await screen.findByRole("button", { name: "accountAvatarRemove" }));
  expect(alert).toHaveBeenCalledWith(
    "accountAvatarRemove",
    "accountAvatarRemoveConfirm",
    expect.any(Array),
  );
  await act(async () => confirmRemove?.());

  await waitFor(() => expect(accountApi.deleteAccountAvatar).toHaveBeenCalledWith(
    "access", expect.any(Object),
  ));
  expect(screen.queryByRole("button", { name: "accountAvatarRemove" })).toBeNull();
  alert.mockRestore();
});

it("shows and clears a retryable custom-attribute load failure", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  jest.mocked(accountApi.getAccountProfileAttributes)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ definitions: [], attributes: {} });

  await renderAccountScreen();
  const retry = await screen.findByRole("button", { name: "profileAttributesLoadError" });
  fireEvent.press(retry);

  await waitFor(() => expect(accountApi.getAccountProfileAttributes).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("profileAttributesLoadError")).toBeNull();
});

it("shows a localized email-verification failure", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile(false));
  jest.mocked(accountApi.sendAccountVerificationEmail).mockRejectedValueOnce(new Error("offline"));

  await renderAccountScreen();
  fireEvent.press(await screen.findByRole("button", { name: "accountSendVerification" }));

  expect(await screen.findByText("accountVerificationError")).toBeTruthy();
});

it("passes refresh callbacks for each profile-related API request", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  jest.mocked(accountApi.getAccountProfileAttributes).mockResolvedValue({ definitions: [], attributes: {} });
  jest.mocked(accountApi.getAccountAvatar).mockResolvedValue({ avatarUrl: null });

  await renderAccountScreen();
  const calls = [
    jest.mocked(accountApi.getAccountProfile).mock.calls[0],
    jest.mocked(accountApi.getAccountProfileAttributes).mock.calls[0],
    jest.mocked(accountApi.getAccountAvatar).mock.calls[0],
  ];
  for (const call of calls) {
    await expect(call?.[1]?.refreshAccessToken?.()).resolves.toBe("access");
  }
  expect(mockRefreshSession).toHaveBeenCalledWith(true);
});

it("shows failure when the session expires before profile or avatar mutations", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  await renderAccountScreen();
  mockRefreshSession.mockResolvedValueOnce(null);

  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("profileSaveError")).toBeTruthy();

  const picker = jest.mocked(jest.requireMock("expo-image-picker").launchImageLibraryAsync);
  picker.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: "file:///photo.jpg", width: 500, height: 500 }],
  });
  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "accountAvatarChoose" }));
  expect(await screen.findByText("accountAvatarUploadError")).toBeTruthy();
  expect(accountApi.uploadAccountAvatar).not.toHaveBeenCalled();
});

it("calls the authenticated sign-out action from the account screen", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  await renderAccountScreen();

  fireEvent.press(screen.getByRole("button", { name: "signOut" }));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it("keeps the account form and avatar actions readable on wide screens", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue(profile());
  await renderAccountScreen();
  const formStyle = StyleSheet.flatten(
    screen.getByTestId("account-profile-form").props.style,
  );
  const actionStyle = StyleSheet.flatten(
    screen.getByTestId("account-avatar-actions").props.style,
  );
  expect(formStyle.maxWidth).toBe(420);
  expect(formStyle.alignSelf).toBe("stretch");
  expect(actionStyle.flexWrap).toBe("wrap");
  expect(screen.getByLabelText("firstName").props.allowFontScaling).not.toBe(
    false,
  );
});

it("maps server validation errors to configured profile attributes", async () => {
  const definition = {
    id: 8,
    name: "department",
    displayName: "Department",
    description: null,
    type: "STRING" as const,
    required: false,
    multivalued: false,
    minLength: null,
    maxLength: 100,
    pattern: null,
    enabled: true,
    displayOrder: 10,
    builtIn: false,
  };
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: null,
    lastName: null,
    email: null,
    pendingEmail: null,
    emailVerified: false,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest.mocked(accountApi.getAccountProfileAttributes).mockResolvedValue({
    definitions: [definition],
    attributes: {},
  });
  jest.mocked(accountApi.updateAccountProfile).mockRejectedValue(
    new accountApi.AccountApiError(400, "Validation failed", {
      title: "Bad Request",
      status: 400,
      violations: [
        { field: "attributes.department", message: "Server field error" },
      ],
    }),
  );

  await renderAccountScreen();
  fireEvent.changeText(await screen.findByLabelText("Department"), "Support");
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("Server field error")).toBeTruthy();
});

it("loads and saves the account profile, including email validation", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest
    .mocked(accountApi.updateAccountProfile)
    .mockImplementation(async (_token, request) => ({
      username: "alice",
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      pendingEmail: null,
      emailVerified: true,
      preferredLocale: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    }));

  await renderAccountScreen();
  const email = await screen.findByPlaceholderText("email");
  fireEvent.changeText(email, { target: { value: "invalid-email" } });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("invalidEmail")).toBeTruthy();
  fireEvent.changeText(email, { target: { value: "updated@example.test" } });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("emailReauthRequired")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("currentPassword"), {
    target: { value: "current-secret" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  await waitFor(() =>
    expect(accountApi.updateAccountProfile).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({
        email: "updated@example.test",
        currentPassword: "current-secret",
      }),
      expect.any(Object),
    ),
  );
});

it("clears profile fields when the server response omits their values", async () => {
  jest.mocked(accountApi.updateAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: null,
    lastName: null,
    email: null,
    pendingEmail: null,
    emailVerified: false,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
  });

  await renderAccountScreen();
  fireEvent.changeText(screen.getByPlaceholderText("firstName"), "Updated");
  fireEvent.press(screen.getByRole("button", { name: "save" }));

  await waitFor(() => expect(accountApi.updateAccountProfile).toHaveBeenCalled());
  expect(screen.getByPlaceholderText("firstName").props.value).toBe("");
  expect(screen.getByPlaceholderText("lastName").props.value).toBe("");
  expect(screen.getByPlaceholderText("email").props.value).toBe("");
});

it("renders connected applications and offline sessions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid", "profile"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });

  render(<ApplicationsScreen />);

  expect(await screen.findByText("Account Console")).toBeTruthy();
  expect(screen.getByText("CLI")).toBeTruthy();
  expect(screen.getByText("offlineExpires: offlineNoExpiry")).toBeTruthy();
  for (const request of [
    accountApi.listAccountApplications,
    accountApi.listOfflineSessions,
    accountApi.listCibaRequests,
  ]) {
    const options = jest.mocked(request).mock.calls[0]?.at(-1);
    expect(options).toEqual(
      expect.objectContaining({ refreshAccessToken: expect.any(Function) }),
    );
    await expect(
      (
        options as { refreshAccessToken: () => Promise<string | null> }
      ).refreshAccessToken(),
    ).resolves.toBe("access");
  }
});

it("pages authorized applications and prevents overlapping page requests", async () => {
  let resolvePage!: (
    value: accountApi.AccountPage<accountApi.AccountApplication>,
  ) => void;
  const pendingPage = new Promise<
    accountApi.AccountPage<accountApi.AccountApplication>
  >((resolve) => {
    resolvePage = resolve;
  });
  jest
    .mocked(accountApi.listAccountApplications)
    .mockResolvedValueOnce({
      content: [
        {
          clientId: "page-one",
          clientName: "First application",
          scopes: ["openid"],
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      number: 0,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    })
    .mockReturnValueOnce(pendingPage)
    .mockResolvedValueOnce({
      content: [
        {
          clientId: "page-one",
          clientName: "First application",
          scopes: ["openid"],
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      number: 0,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    });
  render(<ApplicationsScreen />);

  expect(await screen.findByText("First application")).toBeTruthy();
  const previous = screen.getByRole("button", { name: "accountPreviousPage" });
  const next = screen.getByRole("button", { name: "accountNextPage" });
  expect(previous.props.accessibilityState.disabled).toBe(true);
  expect(next.props.accessibilityState.disabled).toBe(false);

  fireEvent.press(next);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "accountNextPage" }).props
        .accessibilityState.disabled,
    ).toBe(true),
  );
  fireEvent.press(screen.getByRole("button", { name: "accountNextPage" }));
  expect(accountApi.listAccountApplications).toHaveBeenCalledTimes(2);

  await act(async () => {
    resolvePage({
      content: [
        {
          clientId: "page-two",
          clientName: "Second application",
          scopes: ["profile"],
          createdAt: "2025-01-02T00:00:00Z",
          updatedAt: "2025-01-02T00:00:00Z",
        },
      ],
      number: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    });
    await pendingPage;
  });
  expect(await screen.findByText("Second application")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "accountNextPage" }).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(accountApi.listAccountApplications.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({ page: 1 }),
  );
  fireEvent.press(screen.getByRole("button", { name: "accountPreviousPage" }));
  expect(await screen.findByText("First application")).toBeTruthy();
  expect(accountApi.listAccountApplications.mock.calls[2]?.[1]).toEqual(
    expect.objectContaining({ page: 0 }),
  );
});

it("pages offline sessions and CIBA requests independently", async () => {
  jest
    .mocked(accountApi.listOfflineSessions)
    .mockResolvedValueOnce({
      content: [
        {
          id: "offline-page-one",
          clientId: "cli-one",
          clientName: "First offline session",
          issuedAt: "2025-01-01T00:00:00Z",
          expiresAt: null,
        },
      ],
      number: 0,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    })
    .mockResolvedValueOnce({
      content: [
        {
          id: "offline-page-two",
          clientId: "cli-two",
          clientName: "Second offline session",
          issuedAt: "2025-01-02T00:00:00Z",
          expiresAt: null,
        },
      ],
      number: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    });
  jest
    .mocked(accountApi.listCibaRequests)
    .mockResolvedValueOnce({
      content: [
        {
          authReqId: "ciba-page-one",
          userCode: "AAAA-1111",
          bindingMessage: "First request",
          authorizedScopes: "openid",
          deliveryMode: "poll",
          createdAt: "2025-01-01T00:00:00Z",
          expiresAt: "2025-01-01T00:05:00Z",
          status: "PENDING",
          mfaRequired: false,
          stepUpRequired: false,
        },
      ],
      number: 0,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    })
    .mockResolvedValueOnce({
      content: [
        {
          authReqId: "ciba-page-two",
          userCode: "BBBB-2222",
          bindingMessage: "Second request",
          authorizedScopes: "openid",
          deliveryMode: "poll",
          createdAt: "2025-01-02T00:00:00Z",
          expiresAt: "2025-01-02T00:05:00Z",
          status: "PENDING",
          mfaRequired: false,
          stepUpRequired: false,
        },
      ],
      number: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    });

  render(<ApplicationsScreen />);
  expect(await screen.findByText("First offline session")).toBeTruthy();
  expect(await screen.findByText("First request")).toBeTruthy();

  const nextButtons = screen.getAllByRole("button", {
    name: "accountNextPage",
  });
  fireEvent.press(nextButtons[0]!);
  expect(await screen.findByText("Second offline session")).toBeTruthy();
  expect(accountApi.listOfflineSessions.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({ page: 1 }),
  );

  fireEvent.press(
    screen.getAllByRole("button", { name: "accountNextPage" })[1]!,
  );
  expect(await screen.findByText("Second request")).toBeTruthy();
  expect(accountApi.listCibaRequests.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({ page: 1 }),
  );
});

it("falls back to the last valid page when application sections shrink", async () => {
  const totalPage = <T,>(content: T[], number: number, totalPages: number) => ({
    content,
    number,
    size: 20,
    totalElements: 21,
    totalPages,
  });
  const application = {
    clientId: "console",
    clientName: "Account Console",
    scopes: ["openid"],
    createdAt: "2025-01-01T00:00:00Z",
  };
  const offlineSession = {
    id: "offline-page-one",
    clientId: "cli-one",
    clientName: "Last offline page",
    issuedAt: "2025-01-01T00:00:00Z",
    expiresAt: null,
  };
  const cibaRequest = {
    authReqId: "ciba-page-one",
    userCode: "AAAA-1111",
    bindingMessage: "Last CIBA page",
    authorizedScopes: "openid",
    deliveryMode: "poll",
    createdAt: "2025-01-01T00:00:00Z",
    expiresAt: "2025-01-01T00:05:00Z",
    status: "PENDING",
    mfaRequired: false,
    stepUpRequired: false,
  } as const;
  jest
    .mocked(accountApi.listAccountApplications)
    .mockResolvedValueOnce(totalPage([application], 0, 2))
    .mockResolvedValueOnce(totalPage([], 1, 1))
    .mockResolvedValueOnce(totalPage([application], 0, 1));
  jest
    .mocked(accountApi.listOfflineSessions)
    .mockResolvedValueOnce(totalPage([offlineSession], 0, 2))
    .mockResolvedValueOnce(totalPage([], 1, 1))
    .mockResolvedValueOnce(totalPage([offlineSession], 0, 1));
  jest
    .mocked(accountApi.listCibaRequests)
    .mockResolvedValueOnce(totalPage([cibaRequest], 0, 2))
    .mockResolvedValueOnce(totalPage([], 1, 1))
    .mockResolvedValueOnce(totalPage([cibaRequest], 0, 1));

  render(<ApplicationsScreen />);
  expect(await screen.findByText("Account Console")).toBeTruthy();
  expect(await screen.findByText("Last offline page")).toBeTruthy();
  expect(await screen.findByText("Last CIBA page")).toBeTruthy();

  fireEvent.press(screen.getAllByRole("button", { name: "accountNextPage" })[0]!);
  await waitFor(() => expect(accountApi.listAccountApplications).toHaveBeenCalledTimes(3));
  fireEvent.press(screen.getAllByRole("button", { name: "accountNextPage" })[0]!);
  await waitFor(() => expect(accountApi.listOfflineSessions).toHaveBeenCalledTimes(3));
  fireEvent.press(screen.getByRole("button", { name: "accountNextPage" }));
  await waitFor(() => expect(accountApi.listCibaRequests).toHaveBeenCalledTimes(3));

  for (const request of [
    accountApi.listAccountApplications,
    accountApi.listOfflineSessions,
    accountApi.listCibaRequests,
  ]) {
    expect(jest.mocked(request).mock.calls.map(([, options]) => options?.page)).toEqual([
      0,
      1,
      0,
    ]);
  }
  expect(screen.getByText("Account Console")).toBeTruthy();
  expect(screen.getByText("Last offline page")).toBeTruthy();
  expect(screen.getByText("Last CIBA page")).toBeTruthy();
});

it("shows CIBA decisions and blocks approval when step-up is required", async () => {
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve account sign-in",
        authorizedScopes: "openid profile",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
      {
        authReqId: "request-2",
        userCode: "WXYZ-5678",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: true,
        stepUpRequired: true,
      },
      {
        authReqId: "request-3",
        userCode: "STEP-1234",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: true,
      },
      {
        authReqId: "request-4",
        userCode: "MFA-5678",
        bindingMessage: null,
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: true,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
  });
  jest.mocked(accountApi.decideCibaRequest).mockResolvedValue(undefined);

  render(<ApplicationsScreen />);

  expect(await screen.findByText("Approve account sign-in")).toBeTruthy();
  expect(screen.getByText(/ABCD-1234/)).toBeTruthy();
  expect(screen.getByText("cibaMfaAndStepUpRequired")).toBeTruthy();
  expect(screen.getByText("cibaStepUpRequired")).toBeTruthy();
  expect(screen.getByText("cibaMfaRequired")).toBeTruthy();
  const approveButtons = screen.getAllByRole("button", { name: "cibaApprove" });
  expect(approveButtons[1].props.accessibilityState.disabled).toBe(true);
  fireEvent.press(approveButtons[0]);
  await waitFor(() =>
    expect(accountApi.decideCibaRequest).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ authReqId: "request-1" }),
      "approve",
      expect.any(Object),
    ),
  );
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "cibaApproved",
    }),
  );
});

it("loads a profile after retrying a failed profile request", async () => {
  jest
    .mocked(accountApi.getAccountProfile)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      username: "alice",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.test",
      pendingEmail: null,
      emailVerified: true,
      preferredLocale: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

  await renderAccountScreen();
  expect(await screen.findByText("profileLoadError")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "profileLoadError" }));
  expect(await screen.findByPlaceholderText("email")).toBeTruthy();
});

it("retries loading the profile after the current session expires", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  mockRefreshSession
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ accessToken: "access" });

  await renderAccountScreen();
  fireEvent.press(
    await screen.findByRole("button", { name: "profileLoadError" }),
  );
  expect(await screen.findByPlaceholderText("email")).toBeTruthy();
  await waitFor(() =>
    expect(accountApi.getAccountProfile).toHaveBeenCalledTimes(1),
  );
});

it("reports profile save failures and routes to native account sections", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest
    .mocked(accountApi.updateAccountProfile)
    .mockRejectedValue(new Error("offline"));

  await renderAccountScreen();
  fireEvent.changeText(await screen.findByPlaceholderText("firstName"), {
    target: { value: "Taylor" },
  });
  fireEvent.press(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("profileSaveError")).toBeTruthy();

  const { router } = jest.requireMock("expo-router");
  for (const route of [
    "settings",
    "security",
    "applications",
    "mfa",
    "socialLinks",
  ]) {
    fireEvent.press(screen.getByRole("button", { name: route }));
    expect(router.push).toHaveBeenCalledWith(
      `/${route === "socialLinks" ? "social-links" : route}`,
    );
  }
  fireEvent.press(screen.getByRole("button", { name: "continue" }));
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("maps server profile validation to the matching native fields", async () => {
  jest.mocked(accountApi.getAccountProfile).mockResolvedValue({
    username: "alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.test",
    pendingEmail: null,
    emailVerified: true,
    preferredLocale: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
  jest.mocked(accountApi.updateAccountProfile).mockRejectedValue(
    new accountApi.AccountApiError(422, "invalid profile", {
      violations: [
        { field: "firstName", message: "firstNameRejected" },
        { field: "lastName", message: "lastNameRejected" },
        { field: "email", message: "emailRejected" },
      ],
    }),
  );

  await renderAccountScreen();
  fireEvent.changeText(await screen.findByPlaceholderText("firstName"), {
    target: { value: "Taylor" },
  });
  fireEvent.changeText(screen.getByPlaceholderText("email"), {
    target: { value: "alice@example.test" },
  });
  const save = screen.getByRole("button", { name: "save" });
  fireEvent.press(save);
  fireEvent.press(save);

  expect(await screen.findByText("firstNameRejected")).toBeTruthy();
  expect(screen.getByText("lastNameRejected")).toBeTruthy();
  expect(screen.getByText("emailRejected")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("lastName"), {
    target: { value: "Jones" },
  });
  expect(screen.queryByText("lastNameRejected")).toBeNull();
  expect(screen.queryByText("profileSaveError")).toBeNull();
  expect(accountApi.updateAccountProfile).toHaveBeenCalledTimes(1);
});

it("shows application errors and recovers after retry", async () => {
  jest
    .mocked(accountApi.listAccountApplications)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      content: [
        {
          clientId: "console",
          clientName: "Account Console",
          scopes: ["openid"],
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      number: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });

  render(<ApplicationsScreen />);
  expect(await screen.findByText("applicationsError")).toBeTruthy();
  fireEvent.press(screen.getAllByRole("button", { name: "sessionsRetry" })[0]);
  expect(await screen.findByText("Account Console")).toBeTruthy();
  expect(screen.getByText("offlineSessionsEmpty")).toBeTruthy();
});

it("reports a failed applications session refresh without hiding other sections", async () => {
  mockRefreshSession.mockRejectedValueOnce(new Error("session refresh failed"));

  render(<ApplicationsScreen />);

  expect(await screen.findByText("applicationsError")).toBeTruthy();
  expect(screen.getByText("offlineSessionsEmpty")).toBeTruthy();
  expect(screen.getByText("cibaEmpty")).toBeTruthy();
});

it("shows independent offline and CIBA loading failures", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  jest
    .mocked(accountApi.listOfflineSessions)
    .mockRejectedValueOnce(new Error("offline sessions unavailable"));
  jest
    .mocked(accountApi.listCibaRequests)
    .mockRejectedValueOnce(new Error("pending requests unavailable"));

  render(<ApplicationsScreen />);

  expect(await screen.findByText("applicationsEmpty")).toBeTruthy();
  await waitFor(() => {
    expect(accountApi.listOfflineSessions).toHaveBeenCalled();
    expect(accountApi.listCibaRequests).toHaveBeenCalled();
    expect(screen.getByText("offlineSessionsError")).toBeTruthy();
    expect(screen.getByText("cibaLoadError")).toBeTruthy();
  });
});

it("recovers offline-session and CIBA sections through their retry actions", async () => {
  jest
    .mocked(accountApi.listOfflineSessions)
    .mockRejectedValueOnce(new Error("offline list failed"));
  jest
    .mocked(accountApi.listCibaRequests)
    .mockRejectedValueOnce(new Error("CIBA list failed"));

  render(<ApplicationsScreen />);
  expect(await screen.findByText("offlineSessionsError")).toBeTruthy();
  expect(await screen.findByText("cibaLoadError")).toBeTruthy();

  fireEvent.press(screen.getByText("offlineSessionsError"));
  expect(await screen.findByText("offlineSessionsEmpty")).toBeTruthy();
  fireEvent.press(screen.getByText("cibaLoadError"));
  expect(await screen.findByText("cibaEmpty")).toBeTruthy();
  expect(accountApi.listOfflineSessions).toHaveBeenCalledTimes(2);
  expect(accountApi.listCibaRequests).toHaveBeenCalledTimes(2);
});

it("shows all application sections as retryable when the session expires", async () => {
  jest
    .mocked(accountApi.listAccountApplications)
    .mockRejectedValueOnce(new Error("application service unavailable"));
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  render(<ApplicationsScreen />);
  expect(await screen.findByText("applicationsError")).toBeTruthy();
  mockRefreshSession.mockResolvedValueOnce(null);

  fireEvent.press(screen.getAllByRole("button", { name: "sessionsRetry" })[0]!);

  expect(await screen.findByText("applicationsError")).toBeTruthy();
  expect(screen.getByText("offlineSessionsEmpty")).toBeTruthy();
  expect(screen.getByText("cibaEmpty")).toBeTruthy();
});

it("reports expired-session failures for application, offline, and CIBA actions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve sign-in",
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  expect(await screen.findByText("Account Console")).toBeTruthy();
  const { mockRefreshSession } = jest.requireMock("@/auth/MobileAuthProvider");

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "revokeApplication" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeApplicationError",
    }),
  );

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "revokeOfflineSession" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeOfflineSessionError",
    }),
  );

  mockRefreshSession.mockResolvedValueOnce(null);
  fireEvent.press(screen.getByRole("button", { name: "cibaDeny" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "cibaDecisionError",
    }),
  );
  expect(accountApi.revokeAccountApplication).not.toHaveBeenCalled();
  expect(accountApi.revokeOfflineSession).not.toHaveBeenCalled();
  expect(accountApi.decideCibaRequest).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledTimes(2);
});

it("reports API failures for application, offline-session, and CIBA actions", async () => {
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [
      {
        clientId: "console",
        clientName: "Account Console",
        scopes: ["openid"],
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [
      {
        id: "offline-1",
        clientId: "cli",
        clientName: "CLI",
        issuedAt: "2025-01-01T00:00:00Z",
        expiresAt: null,
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listCibaRequests).mockResolvedValue({
    content: [
      {
        authReqId: "request-1",
        userCode: "ABCD-1234",
        bindingMessage: "Approve sign-in",
        authorizedScopes: "openid",
        deliveryMode: "poll",
        createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:05:00Z",
        status: "PENDING",
        mfaRequired: false,
        stepUpRequired: false,
      },
    ],
    number: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  jest
    .mocked(accountApi.revokeAccountApplication)
    .mockRejectedValueOnce(new Error("application revoke rejected"));
  jest
    .mocked(accountApi.revokeOfflineSession)
    .mockRejectedValueOnce(new Error("offline revoke rejected"));
  jest
    .mocked(accountApi.decideCibaRequest)
    .mockRejectedValueOnce(new Error("CIBA decision rejected"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title,
    _message,
    buttons,
  ) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  expect(await screen.findByText("Account Console")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "revokeApplication" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeApplicationError",
    }),
  );
  fireEvent.press(screen.getByRole("button", { name: "revokeOfflineSession" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "revokeOfflineSessionError",
    }),
  );
  fireEvent.press(screen.getByRole("button", { name: "cibaDeny" }));
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "cibaDecisionError",
    }),
  );
  expect(accountApi.revokeAccountApplication).toHaveBeenCalledTimes(1);
  expect(accountApi.revokeOfflineSession).toHaveBeenCalledTimes(1);
  expect(accountApi.decideCibaRequest).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(2);
});

it("confirms, serializes, and reports application and offline-session revocations", async () => {
  const application = {
    clientId: "admin-console",
    clientName: "Admin Console",
    scopes: ["openid"],
    createdAt: "invalid-date",
  };
  const offlineSession = {
    id: "offline-7",
    clientId: "cli",
    clientName: "CLI",
    issuedAt: "invalid-date",
    expiresAt: null,
  };
  jest.mocked(accountApi.listAccountApplications).mockResolvedValue({
    content: [application],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  jest.mocked(accountApi.listOfflineSessions).mockResolvedValue({
    content: [offlineSession],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  let completeApplication!: () => void;
  let completeOffline!: () => void;
  jest.mocked(accountApi.revokeAccountApplication).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeApplication = resolve;
      }),
  );
  jest.mocked(accountApi.revokeOfflineSession).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeOffline = resolve;
      }),
  );
  const alert = jest.spyOn(Alert, "alert").mockImplementation(((
    _title: unknown,
    _message: unknown,
    buttons: { onPress?: () => void }[],
  ) => {
    buttons[1]?.onPress?.();
  }) as never);

  render(<ApplicationsScreen />);
  const revokeApplication = await screen.findByRole("button", {
    name: "revokeApplication",
  });
  fireEvent.press(revokeApplication);
  await waitFor(() =>
    expect(accountApi.revokeAccountApplication).toHaveBeenCalledWith(
      "access",
      "admin-console",
      expect.any(Object),
    ),
  );
  await waitFor(() =>
    expect(revokeApplication.props.accessibilityState.disabled).toBe(true),
  );
  expect(screen.getByLabelText("revokeApplication")).toBeTruthy();
  fireEvent.press(revokeApplication);
  expect(accountApi.revokeAccountApplication).toHaveBeenCalledTimes(1);
  completeApplication();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "revokeApplicationSuccess",
    }),
  );

  const revokeOffline = await screen.findByRole("button", {
    name: "revokeOfflineSession",
  });
  fireEvent.press(revokeOffline);
  await waitFor(() =>
    expect(accountApi.revokeOfflineSession).toHaveBeenCalledWith(
      "access",
      "offline-7",
      expect.any(Object),
    ),
  );
  await waitFor(() =>
    expect(revokeOffline.props.accessibilityState.disabled).toBe(true),
  );
  fireEvent.press(revokeOffline);
  expect(accountApi.revokeOfflineSession).toHaveBeenCalledTimes(1);
  completeOffline();
  await waitFor(() =>
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "success",
      message: "revokeOfflineSessionSuccess",
    }),
  );
  expect(alert).toHaveBeenCalledTimes(2);
});
