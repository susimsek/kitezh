import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminBrandingSettings from "./AdminBrandingSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token", access: { isAdmin: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/components/shared/BrandLogo", () => ({
  BrandLogo: () => <span data-testid="brand-logo" />,
}));

const settings = {
  applicationName: "Kitezh",
  logoPath: "/brand/logo.svg",
  faviconPath: "/favicon.ico",
  appleTouchIconPath: "/apple-icon.png",
  primaryColor: "#0d6efd",
  accentColor: "#0b2b69",
  backgroundColor: "#f8f9fa",
};

describe("AdminBrandingSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT")
        return Promise.resolve({ status: 200, data: settings }) as never;
      return Promise.resolve({ status: 200, data: settings }) as never;
    });
  });

  it("loads and saves branding settings", async () => {
    render(<AdminBrandingSettings />);
    expect(await screen.findByText(dictionary.admin.branding.title)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.branding.applicationName), {
      target: { value: "Demo Console" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.branding.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("admin-token", {
        method: "PUT",
        url: "/api/admin/settings/branding",
        data: expect.objectContaining({ applicationName: "Demo Console" }),
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.branding.saved);
  });

  it("shows a load error", async () => {
    mockAdminRequest.mockRejectedValue(new Error("network"));
    render(<AdminBrandingSettings />);
    expect(await screen.findByText(dictionary.admin.branding.error)).toBeVisible();
  });
});
