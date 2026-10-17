import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import * as adminApi from "@/api/admin-api";
import { AdminLoginPolicySettings } from "@/admin/AdminLoginPolicySettings";

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
  getNativeAdminLoginSettings: jest.fn(),
  updateNativeAdminLoginSettings: jest.fn(),
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
  radii: { sm: 4, md: 8 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
}));

const mockShowNotice = jest.fn();
jest.mock("@/components/MobileNoticeProvider", () => ({
  useMobileNotice: () => ({ showNotice: mockShowNotice }),
}));

const loginSettings: adminApi.NativeAdminLoginSettings = {
  userRegistration: true,
  forgotPassword: true,
  rememberMe: true,
  loginWithEmail: true,
  verifyEmail: false,
  sessionTimeoutMinutes: 30,
  passwordMinimumLength: 12,
  bruteForceEnabled: true,
  bruteForceMaxFailures: 5,
  otpEnabled: true,
  otpRequired: false,
  passkeys: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(adminApi.getNativeAdminLoginSettings)
    .mockResolvedValue(loginSettings);
  jest
    .mocked(adminApi.updateNativeAdminLoginSettings)
    .mockImplementation(async (_token, settings) => settings);
});

test("loads native login policy and saves changed settings", async () => {
  render(
    <AdminLoginPolicySettings
      accessToken="access-token"
      canManage
      refreshAccessToken={async () => "fresh-token"}
    />,
  );

  expect(await screen.findByText("adminLoginPolicy")).toBeTruthy();
  expect(adminApi.getNativeAdminLoginSettings).toHaveBeenCalledWith(
    "access-token",
    { refreshAccessToken: expect.any(Function) },
  );
  fireEvent.valueChange(
    screen.getByRole("switch", { name: "adminVerifyEmail" }),
    true,
  );
  fireEvent.press(screen.getByTestId("admin-login-policy-save"));

  await waitFor(() => {
    expect(adminApi.updateNativeAdminLoginSettings).toHaveBeenCalledWith(
      "access-token",
      { ...loginSettings, verifyEmail: true },
      { refreshAccessToken: expect.any(Function) },
    );
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "adminLoginPolicySaved",
  });
});

test("validates numeric bounds and OTP dependency before saving", async () => {
  render(
    <AdminLoginPolicySettings accessToken="access-token" canManage />,
  );
  await screen.findByText("adminLoginPolicy");

  fireEvent.changeText(
    screen.getByTestId("admin-login-session-timeout"),
    "0",
  );
  fireEvent.valueChange(
    screen.getByRole("switch", { name: "adminOtpRequired" }),
    true,
  );
  fireEvent.valueChange(
    screen.getByRole("switch", { name: "adminOtpEnabled" }),
    false,
  );
  fireEvent.press(screen.getByTestId("admin-login-policy-save"));

  expect(await screen.findByText("adminOtpRequiredNeedsEnabled")).toBeTruthy();
  expect(screen.getByText("apiValidation")).toBeTruthy();
  expect(adminApi.updateNativeAdminLoginSettings).not.toHaveBeenCalled();
});

test("does not expose save to read-only administrators", async () => {
  render(
    <AdminLoginPolicySettings accessToken="read-only-token" canManage={false} />,
  );
  expect(await screen.findByText("adminLoginPolicy")).toBeTruthy();
  expect(screen.queryByTestId("admin-login-policy-save")).toBeNull();
});

test("shows forbidden state and allows retry after a failed load", async () => {
  jest
    .mocked(adminApi.getNativeAdminLoginSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403))
    .mockResolvedValueOnce(loginSettings);
  render(
    <AdminLoginPolicySettings accessToken="access-token" canManage />,
  );

  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-login-policy-retry"));
  expect(await screen.findByText("adminLoginPolicy")).toBeTruthy();
  expect(adminApi.getNativeAdminLoginSettings).toHaveBeenCalledTimes(2);
});

test.each([
  [new adminApi.AdminApiError(401), "apiUnauthorized"],
  [new adminApi.AdminApiError(0, "offline"), "apiOffline"],
  [new adminApi.AdminApiError(0, "timeout"), "apiTimeout"],
  [new Error("unexpected"), "adminLoadError"],
])("renders a localized load failure for %s", async (error, message) => {
  jest.mocked(adminApi.getNativeAdminLoginSettings).mockRejectedValueOnce(error);
  render(<AdminLoginPolicySettings accessToken="access-token" canManage />);

  expect(await screen.findByText(message)).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-login-policy-retry"));
  expect(await screen.findByText("adminLoginPolicy")).toBeTruthy();
});

test("reports forbidden save failures and permits a subsequent save", async () => {
  jest
    .mocked(adminApi.updateNativeAdminLoginSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403));
  render(<AdminLoginPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-login-policy-save"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminForbidden",
    });
  });

  fireEvent.press(screen.getByTestId("admin-login-policy-save"));
  await waitFor(() => expect(adminApi.updateNativeAdminLoginSettings).toHaveBeenCalledTimes(2));
});
