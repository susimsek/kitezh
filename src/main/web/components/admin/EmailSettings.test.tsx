import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import EmailSettings from "./EmailSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token" }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

const settings = {
  enabled: true,
  fromAddress: "no-reply@example.com",
  baseUrl: "https://example.com",
  host: "smtp.example.com",
  port: 587,
  username: "smtp-user",
  passwordConfigured: true,
  smtpAuth: true,
  starttls: true,
  ssl: false,
};

describe("EmailSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tests the current SMTP settings and shows success feedback", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: settings } as never)
      .mockResolvedValueOnce({ status: 204, data: null } as never);

    render(<EmailSettings embedded />);

    const testButton = await screen.findByRole("button", {
      name: dictionary.admin.emailSettings.testConnection,
    });
    fireEvent.click(testButton);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenNthCalledWith(2, "token", {
        method: "POST",
        url: "/api/admin/settings/email/test",
        data: {
          enabled: true,
          fromAddress: "no-reply@example.com",
          baseUrl: "https://example.com",
          host: "smtp.example.com",
          port: 587,
          username: "smtp-user",
          password: "",
          smtpAuth: true,
          starttls: true,
          ssl: false,
        },
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(
      dictionary.admin.emailSettings.testConnectionSucceeded,
    );
  });

  it("saves settings, reports API failures, and handles a load failure", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: settings } as never)
      .mockResolvedValueOnce({
        status: 204,
        data: { ...settings, passwordConfigured: true },
      } as never)
      .mockResolvedValueOnce({
        status: 400,
        data: { field: "port", detail: "Invalid port" },
      } as never);

    render(<EmailSettings />);
    expect(
      await screen.findByRole("heading", { name: dictionary.admin.emailSettings.title }),
    ).toBeVisible();
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.emailSettings.save }),
    );
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.emailSettings.saved),
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.emailSettings.testConnection }),
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.emailSettings.testConnectionError),
    );

    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<EmailSettings embedded />);
    expect(await screen.findByText(dictionary.admin.emailSettings.error)).toBeVisible();
  });

  it("reports a failed save and validates malformed SMTP values", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({ status: 200, data: settings } as never)
      .mockResolvedValueOnce({
        status: 500,
        data: { field: "host", detail: "Host invalid" },
      } as never);
    render(<EmailSettings embedded />);
    await screen.findByRole("button", { name: dictionary.admin.emailSettings.save });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.emailSettings.save }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.emailSettings.error),
    );
  });
});
