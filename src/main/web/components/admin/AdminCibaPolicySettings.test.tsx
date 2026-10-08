import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminCibaPolicySettings from "./AdminCibaPolicySettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { isAdmin: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

const policy = {
  requestLifespanSeconds: 300,
  pollingIntervalSeconds: 5,
  deliveryMode: "all" as const,
  userVerification: "preferred" as const,
  mfaRequired: false,
  stepUpRequired: false,
  stepUpAcr: null,
};

describe("AdminCibaPolicySettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockResolvedValue({ status: 200, data: policy } as never);
  });

  it("loads and saves the CIBA policy", async () => {
    render(<AdminCibaPolicySettings />);
    const save = await screen.findByRole("button", { name: dictionary.admin.ciba.save });
    fireEvent.change(screen.getByLabelText(dictionary.admin.ciba.pollingInterval), {
      target: { value: "10" },
    });
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        method: "PUT",
        url: "/api/admin/settings/ciba-policy",
        data: { ...policy, pollingIntervalSeconds: 10, stepUpAcr: null },
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.ciba.saved);
  });
});
