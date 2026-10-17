import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { Alert } from "react-native";
import * as adminApi from "@/api/admin-api";
import { AdminPolicySettings } from "@/admin/AdminPolicySettings";

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
  getAdminCibaPolicy: jest.fn(),
  getAdminOfflineAccessPolicy: jest.fn(),
  updateAdminCibaPolicy: jest.fn(),
  updateAdminOfflineAccessPolicy: jest.fn(),
  revokeAllAdminOfflineAccess: jest.fn(),
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
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
}));

const mockShowNotice = jest.fn();
jest.mock("@/components/MobileNoticeProvider", () => ({
  useMobileNotice: () => ({ showNotice: mockShowNotice }),
}));

const cibaPolicy = {
  requestLifespanSeconds: 300,
  pollingIntervalSeconds: 5,
  deliveryMode: "all" as const,
  userVerification: "preferred" as const,
  mfaRequired: false,
  stepUpRequired: false,
  stepUpAcr: null,
};

const offlinePolicy = {
  idleTimeout: "P30D",
  maxLifespan: "P90D",
  maxLimited: true,
  revokedBefore: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(adminApi.getAdminCibaPolicy).mockResolvedValue(cibaPolicy);
  jest
    .mocked(adminApi.getAdminOfflineAccessPolicy)
    .mockResolvedValue(offlinePolicy);
  jest
    .mocked(adminApi.updateAdminCibaPolicy)
    .mockImplementation(async (_accessToken, nextPolicy) => nextPolicy);
  jest
    .mocked(adminApi.updateAdminOfflineAccessPolicy)
    .mockImplementation(async (_accessToken, nextPolicy) => ({
      ...nextPolicy,
      revokedBefore: null,
    }));
  jest
    .mocked(adminApi.revokeAllAdminOfflineAccess)
    .mockResolvedValue({
      ...offlinePolicy,
      revokedBefore: "2026-10-17T12:00:00Z",
    });
});

test("renders localized CIBA and offline policies and saves CIBA settings", async () => {
  render(
    <AdminPolicySettings
      accessToken="access-token"
      canManage
      refreshAccessToken={async () => "fresh-token"}
    />,
  );

  expect(await screen.findByText("adminCibaPolicy")).toBeTruthy();
  expect(screen.getByText("adminOfflineAccessPolicy")).toBeTruthy();
  expect(adminApi.getAdminCibaPolicy).toHaveBeenCalledWith("access-token", {
    refreshAccessToken: expect.any(Function),
  });
  expect(adminApi.getAdminOfflineAccessPolicy).toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("admin-ciba-policy-save"));

  await waitFor(() => {
    expect(adminApi.updateAdminCibaPolicy).toHaveBeenCalledWith(
      "access-token",
      cibaPolicy,
      { refreshAccessToken: expect.any(Function) },
    );
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "adminPolicySaved",
  });
});

test("validates offline durations and enforces maximum not shorter than idle", async () => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  fireEvent.changeText(screen.getByLabelText("adminIdleTimeout"), "P0D");
  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));
  expect(await screen.findByText("adminPolicyValidationError")).toBeTruthy();
  expect(adminApi.updateAdminOfflineAccessPolicy).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText("adminIdleTimeout"), "P30D");
  fireEvent.changeText(screen.getByLabelText("adminMaxLifespan"), "P10D");
  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));
  expect(adminApi.updateAdminOfflineAccessPolicy).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText("adminMaxLifespan"), "P90D");
  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));
  await waitFor(() => {
    expect(adminApi.updateAdminOfflineAccessPolicy).toHaveBeenCalledWith(
      "access-token",
      { idleTimeout: "P30D", maxLifespan: "P90D", maxLimited: true },
      { refreshAccessToken: undefined },
    );
  });
});

test("revoke-all requires native confirmation and reports success", async () => {
  let confirmRevoke: (() => void) | undefined;
  const alert = jest
    .spyOn(Alert, "alert")
    .mockImplementation((_title, _message, buttons) => {
      confirmRevoke = buttons?.find(
        (button) => button.style === "destructive",
      )?.onPress;
    });
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  fireEvent.press(screen.getByTestId("admin-offline-revoke-all"));
  expect(alert).toHaveBeenCalledWith(
    "adminRevokeAllOfflineTitle",
    "adminRevokeAllOfflinePrompt",
    expect.any(Array),
  );
  await act(async () => {
    confirmRevoke?.();
  });

  await waitFor(() => {
    expect(adminApi.revokeAllAdminOfflineAccess).toHaveBeenCalledWith(
      "access-token",
      { refreshAccessToken: undefined },
    );
  });
  expect(mockShowNotice).toHaveBeenCalledWith({
    kind: "success",
    message: "adminRevokeAllOfflineSuccess",
  });
  alert.mockRestore();
});

test("read-only administrators cannot submit policy mutations", async () => {
  render(
    <AdminPolicySettings accessToken="read-only-token" canManage={false} />,
  );
  await screen.findByText("adminCibaPolicy");
  expect(screen.queryByTestId("admin-ciba-policy-save")).toBeNull();
  expect(screen.queryByTestId("admin-offline-policy-save")).toBeNull();
  expect(screen.queryByTestId("admin-offline-revoke-all")).toBeNull();
});
