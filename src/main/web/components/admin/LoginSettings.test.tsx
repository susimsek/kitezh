import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import LoginSettings from "./LoginSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({ useDictionary: () => dictionary }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token", access: { isAdmin: true } }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./DetailTabs", () => ({
  DetailTabs: ({
    tabs,
    active,
  }: {
    tabs: Array<{ key: string; label: string; onSelect?: () => void }>;
    active: string;
  }) => (
    <div data-testid={`tabs-${active}`}>
      {tabs.map((tab) => (
        <button key={tab.key} type="button" onClick={tab.onSelect}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

const provider = {
  provider: "google",
  alias: "Google",
  hideOnLogin: false,
  accountLinkingOnly: false,
  trustEmail: true,
  mfaRequired: false,
  requiredClaims: "sub",
  storeTokens: false,
  storedTokensReadable: false,
  guiOrder: 0,
  showInAccountConsole: "always" as const,
  clientId: "client-id",
  clientSecretConfigured: true,
};

function mockSuccessfulLoads() {
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.url?.includes("social-providers")) {
      return Promise.resolve({ status: 200, data: [provider] }) as never;
    }
    return Promise.resolve({ status: 200, data: {} }) as never;
  });
}

describe("LoginSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it("loads all policy sections and saves login and social settings", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection="webauthn" />);

    expect(await screen.findByText(dictionary.admin.loginSettings.sectionWebAuthn)).toBeVisible();
    expect(
      screen.getAllByLabelText(dictionary.admin.loginSettings.webauthnRpName)[0],
    ).toBeVisible();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.loginSettings.save })[0],
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/settings/login" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.loginSettings.saved);

    const googleTab = screen.getAllByText("Google").find((element) => element.tagName === "BUTTON");
    expect(googleTab).toBeDefined();
    fireEvent.click(googleTab!);
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.providerAlias), {
      target: { value: "Google Workspace" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.admin.loginSettings.socialCredentialsSave,
        hidden: true,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/settings/social-providers",
          data: expect.objectContaining({ providers: expect.any(Array) }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.loginSettings.saved);
  });

  it("shows loading and request errors", async () => {
    mockAdminRequest.mockImplementation(() => Promise.reject(new Error("network")) as never);
    render(<LoginSettings />);
    expect(screen.getByRole("status")).toHaveTextContent(dictionary.admin.loginSettings.loading);
    expect(await screen.findByText(dictionary.admin.loginSettings.error)).toBeVisible();
  });

  it("reports save failures", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection="password-policy" />);
    await screen.findByText(dictionary.admin.loginSettings.sectionPasswordPolicy);
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT") return Promise.reject(new Error("save failed")) as never;
      return Promise.resolve({ status: 200, data: {} }) as never;
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.loginSettings.save })[0],
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.loginSettings.error),
    );
  });

  it.each([
    ["login", dictionary.admin.loginSettings.sectionLogin],
    ["social-login", dictionary.admin.loginSettings.sectionSocialLogin],
    ["password-policy", dictionary.admin.loginSettings.sectionPasswordPolicy],
    ["otp-policy", dictionary.admin.loginSettings.sectionOtpPolicy],
    ["brute-force", dictionary.admin.loginSettings.sectionBruteForce],
    ["sessions", dictionary.admin.loginSettings.sectionSessions],
  ] as const)("renders and saves the %s settings section", async (section, heading) => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection={section} />);
    expect((await screen.findAllByText(heading)).length).toBeGreaterThan(0);
    const save = screen.getAllByRole("button", { name: dictionary.admin.loginSettings.save })[0];
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/settings/login" }),
      ),
    );
  });

  it("shows validation feedback for policy fields and social provider fields", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection="login" />);
    await screen.findByText(dictionary.admin.loginSettings.sectionLogin);
    fireEvent.change(
      screen.getByLabelText(dictionary.admin.loginSettings.passwordResetTokenLifespan),
      { target: { value: "1" } },
    );
    expect(
      await screen.findByText(dictionary.admin.common.validation.positiveNumber),
    ).toBeVisible();

    const socialTab = screen.getAllByText("Google").find((element) => element.tagName === "BUTTON");
    fireEvent.click(socialTab!);
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.providerAlias), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.admin.loginSettings.socialCredentialsSave,
        hidden: true,
      }),
    );
    expect(
      (await screen.findAllByText(dictionary.admin.common.validation.required)).length,
    ).toBeGreaterThan(0);
  });
});
