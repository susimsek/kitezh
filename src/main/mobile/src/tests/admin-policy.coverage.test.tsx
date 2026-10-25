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

test("shows policy-specific load errors and retries only the failed policy", async () => {
  jest
    .mocked(adminApi.getAdminCibaPolicy)
    .mockRejectedValueOnce(new adminApi.AdminApiError(0, "timeout"))
    .mockResolvedValueOnce(cibaPolicy);
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  expect(await screen.findByText("adminEventSettingsTimeoutError")).toBeTruthy();
  const cibaRetry = screen.getAllByRole("button", { name: "adminRetry" })[0];
  fireEvent.press(cibaRetry);
  await screen.findByText("adminOfflineAccessPolicy");

  await waitFor(() => expect(adminApi.getAdminCibaPolicy).toHaveBeenCalledTimes(2));
  expect(adminApi.getAdminOfflineAccessPolicy).toHaveBeenCalledTimes(1);
});

test("maps a CIBA authorization failure to the forbidden notice", async () => {
  jest
    .mocked(adminApi.updateAdminCibaPolicy)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403));
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-ciba-policy-save"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminForbidden",
    });
  });
});

test("reports offline access save errors and allows another attempt", async () => {
  jest
    .mocked(adminApi.updateAdminOfflineAccessPolicy)
    .mockRejectedValueOnce(new Error("unexpected"));
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-offline-policy-save"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminOfflinePolicySaveError",
    });
  });

  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));
  await waitFor(() => expect(adminApi.updateAdminOfflineAccessPolicy).toHaveBeenCalledTimes(2));
});

test("shows an authorization error if revoking offline access is rejected", async () => {
  jest
    .mocked(adminApi.revokeAllAdminOfflineAccess)
    .mockRejectedValueOnce(new adminApi.AdminApiError(403));
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-offline-revoke-all"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminForbidden",
    });
  });
  alert.mockRestore();
});

test("edits CIBA delivery, verification, numeric and MFA options before saving", async () => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  fireEvent.changeText(screen.getByTestId("admin-ciba-request-lifetime"), "600");
  fireEvent.changeText(screen.getByLabelText("adminPollingInterval"), "10");
  fireEvent.press(screen.getByText("adminCibaDeliveryPoll"));
  fireEvent.press(screen.getByText("adminCibaVerificationRequired"));
  fireEvent.valueChange(screen.getByRole("switch", { name: "adminMfaRequired" }), true);
  fireEvent.changeText(screen.getByLabelText("adminStepUpAcr"), "  urn:example:loa:2  ");
  fireEvent.press(screen.getByTestId("admin-ciba-policy-save"));

  await waitFor(() => {
    expect(adminApi.updateAdminCibaPolicy).toHaveBeenCalledWith(
      "access-token",
      {
        ...cibaPolicy,
        requestLifespanSeconds: 600,
        pollingIntervalSeconds: 10,
        deliveryMode: "poll",
        userVerification: "required",
        mfaRequired: true,
        stepUpAcr: "urn:example:loa:2",
      },
      { refreshAccessToken: undefined },
    );
  });
});

test.each([
  ["request lifetime below minimum", "admin-ciba-request-lifetime", "29"],
  ["request lifetime above maximum", "admin-ciba-request-lifetime", "3601"],
  ["non-numeric request lifetime", "admin-ciba-request-lifetime", "abc"],
  ["polling interval below minimum", "adminPollingInterval", "0"],
  ["polling interval above maximum", "adminPollingInterval", "301"],
])("blocks invalid CIBA policy: %s", async (_description, field, value) => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  fireEvent.changeText(
    field === "admin-ciba-request-lifetime"
      ? screen.getByTestId(field)
      : screen.getByLabelText(field),
    value,
  );
  fireEvent.press(screen.getByTestId("admin-ciba-policy-save"));

  expect(await screen.findByText("adminPolicyValidationError")).toBeTruthy();
  expect(adminApi.updateAdminCibaPolicy).not.toHaveBeenCalled();
});

test("rejects an overlong CIBA ACR while showing its field validation", async () => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  fireEvent.changeText(screen.getByLabelText("adminStepUpAcr"), "a".repeat(101));
  fireEvent.press(screen.getByTestId("admin-ciba-policy-save"));

  expect(await screen.findByText("adminPolicyValidationError")).toBeTruthy();
  expect(adminApi.updateAdminCibaPolicy).not.toHaveBeenCalled();
});

test.each([
  ["malformed idle duration", "adminIdleTimeout", "P1Y"],
  ["zero idle duration", "adminIdleTimeout", "PT0S"],
  ["missing limited maximum", "adminMaxLifespan", ""],
  ["malformed limited maximum", "adminMaxLifespan", "P1Y"],
])("rejects %s in offline policy", async (_description, label, value) => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");

  if (label === "adminMaxLifespan") {
    fireEvent.valueChange(
      screen.getByRole("switch", { name: "adminMaxLimited" }),
      true,
    );
  }
  fireEvent.changeText(screen.getByLabelText(label), value);
  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));

  expect(await screen.findByText("adminPolicyValidationError")).toBeTruthy();
  expect(adminApi.updateAdminOfflineAccessPolicy).not.toHaveBeenCalled();
});

test("maps offline timeout and generic revoke failures to their notices", async () => {
  jest
    .mocked(adminApi.updateAdminOfflineAccessPolicy)
    .mockRejectedValueOnce(new adminApi.AdminApiError(0, "timeout"));
  jest
    .mocked(adminApi.revokeAllAdminOfflineAccess)
    .mockRejectedValueOnce(new Error("unexpected"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-offline-policy-save"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminEventSettingsTimeoutError",
    });
  });

  fireEvent.press(screen.getByTestId("admin-offline-revoke-all"));
  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({
      kind: "error",
      message: "adminActionError",
    });
  });
  alert.mockRestore();
});

test.each([
  ["offline", "adminEventSettingsOfflineError"],
  ["forbidden", "adminForbidden"],
])("shows %s load errors for the offline policy and retries it", async (kind, message) => {
  jest
    .mocked(adminApi.getAdminOfflineAccessPolicy)
    .mockRejectedValueOnce(
      kind === "forbidden"
        ? new adminApi.AdminApiError(403)
        : new adminApi.AdminApiError(0, "offline"),
    )
    .mockResolvedValueOnce(offlinePolicy);
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  expect(await screen.findByText(message)).toBeTruthy();
  const retries = screen.getAllByRole("button", { name: "adminRetry" });
  fireEvent.press(retries[retries.length - 1]);
  await screen.findByText("adminIdleTimeout");
  await waitFor(() =>
    expect(adminApi.getAdminOfflineAccessPolicy).toHaveBeenCalledTimes(2),
  );
});

test.each([
  ["offline", "adminEventSettingsOfflineError"],
  ["timeout", "adminEventSettingsTimeoutError"],
  ["unexpected", "adminCibaSaveError"],
] as const)("maps CIBA %s save failures and re-enables saving", async (kind, message) => {
  const failure =
    kind === "unexpected"
      ? new Error("unexpected")
      : new adminApi.AdminApiError(0, kind);
  jest.mocked(adminApi.updateAdminCibaPolicy).mockRejectedValueOnce(failure);
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-ciba-policy-save"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message });
    expect(
      screen.getByTestId("admin-ciba-policy-save").props.accessibilityState.disabled,
    ).toBe(false);
  });
});

test.each([
  ["forbidden", new adminApi.AdminApiError(403), "adminForbidden"],
  ["offline", new adminApi.AdminApiError(0, "offline"), "adminEventSettingsOfflineError"],
] as const)("maps offline policy %s save failures", async (_kind, failure, message) => {
  jest.mocked(adminApi.updateAdminOfflineAccessPolicy).mockRejectedValueOnce(failure);
  render(<AdminPolicySettings accessToken="access-token" canManage />);

  fireEvent.press(await screen.findByTestId("admin-offline-policy-save"));

  await waitFor(() => {
    expect(mockShowNotice).toHaveBeenCalledWith({ kind: "error", message });
    expect(
      screen.getByTestId("admin-offline-policy-save").props.accessibilityState.disabled,
    ).toBe(false);
  });
});

test.each([
  ["day and hour", "P2DT3H", "P3DT6H"],
  ["minute and fractional second", "PT30M15.5S", "PT1H30M15.5S"],
])("accepts positive ISO duration components with %s", async (_description, idle, maximum) => {
  render(<AdminPolicySettings accessToken="access-token" canManage />);
  await screen.findByText("adminOfflineAccessPolicy");
  fireEvent.changeText(screen.getByLabelText("adminIdleTimeout"), idle);
  fireEvent.valueChange(screen.getByRole("switch", { name: "adminMaxLimited" }), true);
  fireEvent.changeText(screen.getByLabelText("adminMaxLifespan"), maximum);

  fireEvent.press(screen.getByTestId("admin-offline-policy-save"));

  await waitFor(() => {
    expect(adminApi.updateAdminOfflineAccessPolicy).toHaveBeenCalledWith(
      "access-token",
      { idleTimeout: idle, maxLifespan: maximum, maxLimited: true },
      { refreshAccessToken: undefined },
    );
  });
});
