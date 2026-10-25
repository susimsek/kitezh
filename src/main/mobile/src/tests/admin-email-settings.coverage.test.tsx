import { act, fireEvent, render, screen, waitFor } from "@/testing/native-testing-library";
import * as adminApi from "@/api/admin-api";
import { AdminEmailSettings } from "@/admin/AdminEmailSettings";

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
  getAdminEmailSettings: jest.fn(),
  testAdminEmailConnection: jest.fn(),
  updateAdminEmailSettings: jest.fn(),
}));

jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({
    dictionary: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));

jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({
    palette: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));

jest.mock("@/theme/tokens", () => ({
  radii: { sm: 4, md: 8, lg: 12 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
}));

const mockShowNotice = jest.fn();
jest.mock("@/components/MobileNoticeProvider", () => ({
  useMobileNotice: () => ({ showNotice: mockShowNotice }),
}));

const emailSettings: adminApi.AdminEmailSettings = {
  enabled: true,
  fromAddress: "noreply@example.com",
  baseUrl: "https://example.com",
  host: "smtp.example.com",
  port: 587,
  username: "mailer",
  passwordConfigured: true,
  smtpAuth: true,
  starttls: true,
  ssl: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(adminApi.getAdminEmailSettings).mockResolvedValue(emailSettings);
  jest.mocked(adminApi.updateAdminEmailSettings).mockResolvedValue(emailSettings);
  jest.mocked(adminApi.testAdminEmailConnection).mockResolvedValue(undefined);
});

test("loads SMTP settings without exposing the stored password and saves blank password", async () => {
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  expect(await screen.findByText("adminEmailSettingsTitle")).toBeTruthy();
  expect(screen.getByTestId("admin-email-password").props.value).toBe("");
  expect(screen.getByText("adminSmtpPasswordConfigured")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-email-save"));

  await waitFor(() => {
    expect(adminApi.updateAdminEmailSettings).toHaveBeenCalledWith(
      "access-token",
      {
        enabled: true,
        fromAddress: "noreply@example.com",
        baseUrl: "https://example.com",
        host: "smtp.example.com",
        port: 587,
        username: "mailer",
        password: "",
        smtpAuth: true,
        starttls: true,
        ssl: false,
      },
      { refreshAccessToken: undefined },
    );
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "adminEmailSettingsSaved",
  });
});

test("validates SMTP fields before sending either asynchronous action", async () => {
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.changeText(await screen.findByTestId("admin-email-port"), "70000");
  fireEvent.press(screen.getByTestId("admin-email-save"));

  expect(await screen.findByText("adminEmailValidationPort")).toBeTruthy();
  expect(adminApi.updateAdminEmailSettings).not.toHaveBeenCalled();
  expect(adminApi.testAdminEmailConnection).not.toHaveBeenCalled();
});

test("sends the typed password only to the connection-test request", async () => {
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  const password = await screen.findByTestId("admin-email-password");
  fireEvent.changeText(password, "temporary-secret");
  fireEvent.press(screen.getByTestId("admin-email-test"));

  await waitFor(() => {
    expect(adminApi.testAdminEmailConnection).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({ password: "temporary-secret" }),
      { refreshAccessToken: undefined },
    );
  });
  expect(adminApi.updateAdminEmailSettings).not.toHaveBeenCalled();
});

test("prevents a duplicate save while the first request is pending", async () => {
  let finishSave: ((value: adminApi.AdminEmailSettings) => void) | undefined;
  jest.mocked(adminApi.updateAdminEmailSettings).mockImplementation(
    () => new Promise((resolve) => { finishSave = resolve; }),
  );
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  const save = await screen.findByTestId("admin-email-save");
  fireEvent.press(save);
  fireEvent.press(save);
  expect(adminApi.updateAdminEmailSettings).toHaveBeenCalledTimes(1);

  await act(async () => {
    finishSave?.(emailSettings);
  });
});

test.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(0, "offline"), "adminApiOfflineError"],
  [new adminApi.AdminApiError(0, "timeout"), "adminApiTimeoutError"],
  [new Error("unexpected"), "adminEmailSettingsError"],
])("shows a recoverable load error for %s", async (error, message) => {
  jest.mocked(adminApi.getAdminEmailSettings).mockRejectedValueOnce(error);
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  expect(await screen.findByText(message)).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-email-retry"));
  expect(await screen.findByText("adminEmailSettingsTitle")).toBeTruthy();
  expect(adminApi.getAdminEmailSettings).toHaveBeenCalledTimes(2);
});

test("maps a rejected save to field validation and always clears the pending state", async () => {
  jest
    .mocked(adminApi.updateAdminEmailSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(400));
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-email-save"));

  expect(await screen.findByText("apiValidation")).toBeTruthy();
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "error",
    message: "adminEmailSettingsError",
  });
  expect(screen.getByTestId("admin-email-save").props.accessibilityState.disabled).toBe(false);
});

test("reports a connection test timeout without changing saved settings", async () => {
  jest
    .mocked(adminApi.testAdminEmailConnection)
    .mockRejectedValueOnce(new adminApi.AdminApiError(0, "timeout"));
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-email-test"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminApiTimeoutError",
    });
  });
  expect(adminApi.updateAdminEmailSettings).not.toHaveBeenCalled();
});

test("validates every editable SMTP field and clears each error after correction", async () => {
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.changeText(await screen.findByTestId("admin-email-fromAddress"), "bad-address");
  fireEvent.changeText(screen.getByTestId("admin-email-baseUrl"), "https://example.com#fragment");
  fireEvent.changeText(screen.getByTestId("admin-email-host"), " ");
  fireEvent.changeText(screen.getByTestId("admin-email-username"), "u".repeat(256));
  fireEvent.changeText(screen.getByTestId("admin-email-password"), "p".repeat(1001));
  fireEvent.press(screen.getByTestId("admin-email-save"));

  for (const message of [
    "adminEmailValidationFrom",
    "adminEmailValidationBaseUrl",
    "adminEmailValidationHost",
    "adminEmailValidationUsername",
    "adminEmailValidationPassword",
  ]) {
    expect(await screen.findByText(message)).toBeTruthy();
  }
  expect(adminApi.updateAdminEmailSettings).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByTestId("admin-email-fromAddress"), "valid@example.com");
  fireEvent.changeText(screen.getByTestId("admin-email-baseUrl"), "https://example.com");
  fireEvent.changeText(screen.getByTestId("admin-email-host"), "smtp.example.com");
  fireEvent.changeText(screen.getByTestId("admin-email-username"), "mailer");
  fireEvent.changeText(screen.getByTestId("admin-email-password"), "short-secret");

  expect(screen.queryByText("adminEmailValidationFrom")).toBeNull();
  expect(screen.queryByText("adminEmailValidationBaseUrl")).toBeNull();
  expect(screen.queryByText("adminEmailValidationHost")).toBeNull();
  expect(screen.queryByText("adminEmailValidationUsername")).toBeNull();
  expect(screen.queryByText("adminEmailValidationPassword")).toBeNull();
});

test("shows an unauthorized load error and recovers after retry", async () => {
  jest
    .mocked(adminApi.getAdminEmailSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(401))
    .mockResolvedValueOnce(emailSettings);
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  expect(await screen.findByText("apiUnauthorized")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-email-retry"));
  expect(await screen.findByText("adminEmailSettingsTitle")).toBeTruthy();
  expect(adminApi.getAdminEmailSettings).toHaveBeenCalledTimes(2);
});

test("maps an unexpected connection-test failure and restores both actions", async () => {
  jest
    .mocked(adminApi.testAdminEmailConnection)
    .mockRejectedValueOnce(new Error("unexpected"));
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-email-test"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminEmailTestFailed",
    });
  });
  expect(screen.getByTestId("admin-email-test").props.accessibilityState.disabled).toBe(false);
  expect(screen.getByTestId("admin-email-save").props.accessibilityState.disabled).toBe(false);
});

test("loads null optional SMTP values as editable empty fields", async () => {
  jest.mocked(adminApi.getAdminEmailSettings).mockResolvedValueOnce({
    ...emailSettings,
    baseUrl: null,
    fromAddress: null,
    host: null,
    passwordConfigured: false,
    username: null,
  } as unknown as adminApi.AdminEmailSettings);
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  expect(await screen.findByText("adminEmailSettingsTitle")).toBeTruthy();
  for (const field of ["fromAddress", "baseUrl", "host", "username", "password"]) {
    expect(screen.getByTestId(`admin-email-${field}`).props.value).toBe("");
  }
  expect(screen.queryByText("adminSmtpPasswordConfigured")).toBeNull();
});

test.each([
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(0, "offline"), "adminApiOfflineError"],
  [new adminApi.AdminApiError(0, "timeout"), "adminApiTimeoutError"],
])("maps a failed SMTP settings save to %s", async (failure, message) => {
  jest.mocked(adminApi.updateAdminEmailSettings).mockRejectedValueOnce(failure);
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-email-save"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message });
    expect(screen.getByTestId("admin-email-save").props.accessibilityState.disabled).toBe(false);
  });
});

test.each([
  [new adminApi.AdminApiError(401), "apiUnauthorized"],
  [new adminApi.AdminApiError(403), "adminForbidden"],
  [new adminApi.AdminApiError(0, "offline"), "adminApiOfflineError"],
])("maps a failed SMTP connection test to %s", async (failure, message) => {
  jest.mocked(adminApi.testAdminEmailConnection).mockRejectedValueOnce(failure);
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-email-test"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message });
    expect(screen.getByTestId("admin-email-test").props.accessibilityState.disabled).toBe(false);
  });
});

test("rejects overlong URL and SMTP host values and non-integer ports", async () => {
  render(<AdminEmailSettings accessToken="access-token" canManage />);

  fireEvent.changeText(await screen.findByTestId("admin-email-baseUrl"), `https://${"a".repeat(250)}.test`);
  fireEvent.changeText(screen.getByTestId("admin-email-host"), "h".repeat(256));
  fireEvent.changeText(screen.getByTestId("admin-email-port"), "587.5");
  fireEvent.press(screen.getByTestId("admin-email-test"));

  for (const message of [
    "adminEmailValidationBaseUrl",
    "adminEmailValidationHost",
    "adminEmailValidationPort",
  ]) {
    expect(await screen.findByText(message)).toBeTruthy();
  }
  expect(adminApi.testAdminEmailConnection).not.toHaveBeenCalled();
  expect(adminApi.updateAdminEmailSettings).not.toHaveBeenCalled();
});
