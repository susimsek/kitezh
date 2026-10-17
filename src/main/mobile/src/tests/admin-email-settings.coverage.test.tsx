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
