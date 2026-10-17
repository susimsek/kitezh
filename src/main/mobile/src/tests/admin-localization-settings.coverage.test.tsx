import { act, fireEvent, render, screen, waitFor } from "@/testing/native-testing-library";
import * as adminApi from "@/api/admin-api";
import { AdminLocalizationSettings } from "@/admin/AdminLocalizationSettings";

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
  getAdminLocalizationSettings: jest.fn(),
  updateAdminLocalizationSettings: jest.fn(),
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

const settings: adminApi.AdminLocalizationSettings = {
  internationalizationEnabled: true,
  defaultLocale: "en",
  supportedLocales: ["en", "tr"],
  availableLocales: ["en", "tr"],
  availableBundles: ["login", "account", "admin", "email", "backend", "common"],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(adminApi.getAdminLocalizationSettings).mockResolvedValue(settings);
  jest.mocked(adminApi.updateAdminLocalizationSettings).mockImplementation(
    async (_token, request) => ({ ...settings, ...request }),
  );
});

test("loads settings, updates enabled languages, and saves only mutable settings", async () => {
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);

  expect(await screen.findByText("adminLocalizationSettingsTitle")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-localization-default-tr"));
  fireEvent.press(screen.getByTestId("admin-localization-supported-en"));
  fireEvent.press(screen.getByTestId("admin-localization-save"));

  await waitFor(() => {
    expect(adminApi.updateAdminLocalizationSettings).toHaveBeenCalledWith(
      "access-token",
      {
        internationalizationEnabled: true,
        defaultLocale: "tr",
        supportedLocales: ["tr"],
      },
      { refreshAccessToken: undefined },
    );
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "adminLocalizationSaved",
  });
});

test("requires at least one supported locale and the default locale to be enabled", async () => {
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);
  await screen.findByText("adminLocalizationSettingsTitle");

  fireEvent.press(screen.getByTestId("admin-localization-supported-en"));
  fireEvent.press(screen.getByTestId("admin-localization-supported-tr"));
  fireEvent.press(screen.getByTestId("admin-localization-save"));

  expect(await screen.findByText("adminLocalizationSupportedRequired")).toBeTruthy();
  expect(adminApi.updateAdminLocalizationSettings).not.toHaveBeenCalled();
});

test("shows authorization and transport errors, then allows retry", async () => {
  jest.mocked(adminApi.getAdminLocalizationSettings).mockRejectedValueOnce(
    new adminApi.AdminApiError(403),
  );
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);

  expect(await screen.findByText("adminForbidden")).toBeTruthy();
  fireEvent.press(screen.getByTestId("admin-localization-retry"));
  expect(await screen.findByText("adminLocalizationSettingsTitle")).toBeTruthy();
});

test("prevents duplicate saves while a request is pending", async () => {
  let finishSave: ((value: adminApi.AdminLocalizationSettings) => void) | undefined;
  jest.mocked(adminApi.updateAdminLocalizationSettings).mockImplementation(
    () => new Promise((resolve) => { finishSave = resolve; }),
  );
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);

  const save = await screen.findByTestId("admin-localization-save");
  fireEvent.press(save);
  fireEvent.press(save);
  expect(adminApi.updateAdminLocalizationSettings).toHaveBeenCalledTimes(1);

  await act(async () => {
    finishSave?.(settings);
  });
});

test("rejects an unsupported default locale and accepts a valid choice after correction", async () => {
  const unsupported = { ...settings, defaultLocale: "fr" };
  jest.mocked(adminApi.getAdminLocalizationSettings).mockResolvedValueOnce(unsupported);
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-localization-save"));
  expect(await screen.findByText("adminLocalizationDefaultLocaleRequired")).toBeTruthy();
  expect(adminApi.updateAdminLocalizationSettings).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("admin-localization-default-en"));
  fireEvent.press(screen.getByTestId("admin-localization-save"));
  await waitFor(() => expect(adminApi.updateAdminLocalizationSettings).toHaveBeenCalled());
});

test("maps a server validation failure to the shared localized validation message", async () => {
  jest
    .mocked(adminApi.updateAdminLocalizationSettings)
    .mockRejectedValueOnce(new adminApi.AdminApiError(400));
  render(<AdminLocalizationSettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-localization-save"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "apiValidation",
    });
  });
  expect(screen.getByTestId("admin-localization-save").props.accessibilityState.disabled).toBe(false);
});
