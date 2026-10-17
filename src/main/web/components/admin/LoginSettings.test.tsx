import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
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

  it("reports an unsuccessful CAPTCHA save response", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings />);
    await screen.findByText("Registration and login CAPTCHA");
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT") return Promise.resolve({ status: 500, data: {} }) as never;
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    fireEvent.click(screen.getByRole("button", { name: /save captcha settings/i }));

    await waitFor(() => expect(mockAddError).toHaveBeenCalled());
  });

  it("reports unsuccessful HTTP responses when saving CAPTCHA settings", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings />);
    await screen.findByText("Registration and login CAPTCHA");
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT") return Promise.resolve({ status: 500, data: {} }) as never;
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    fireEvent.click(screen.getByRole("button", { name: /save captcha settings/i }));

    await waitFor(() => expect(mockAddError).toHaveBeenCalled());
  });

  it("normalizes nullable WebAuthn values before saving login settings", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT") return Promise.resolve({ status: 200, data: {} }) as never;
      if (request.url?.endsWith("/login")) {
        return Promise.resolve({
          status: 200,
          data: {
            webauthnPolicy: { acceptableAaguids: null },
            webauthnPasswordlessPolicy: { acceptableAaguids: null },
          },
        }) as never;
      }
      if (request.url?.includes("social-providers")) {
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="social-login" />);
    expect(
      await screen.findByText(dictionary.admin.loginSettings.sectionSocialLogin),
    ).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", {
        name: dictionary.admin.loginSettings.save,
        hidden: true,
      })[0],
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/settings/login" }),
      ),
    );
  });

  it("normalizes nullable social provider client ids before saving credentials", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        if (request.method === "PUT") {
          return Promise.resolve({ status: 200, data: [provider] }) as never;
        }
        return Promise.resolve({ status: 200, data: [{ ...provider, clientId: null }] }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="social-login" />);
    expect(
      await screen.findByText(dictionary.admin.loginSettings.sectionSocialLogin),
    ).toBeVisible();
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
        }),
      ),
    );
  });

  it("reports a failed social provider credentials save", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        return Promise.resolve(
          request.method === "PUT"
            ? { status: 500, data: null }
            : { status: 200, data: [provider] },
        ) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="social-login" />);
    expect(
      await screen.findByText(dictionary.admin.loginSettings.sectionSocialLogin),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.admin.loginSettings.socialCredentialsSave,
        hidden: true,
      }),
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

  it("normalizes partial provider settings and validates each editable credential field", async () => {
    const partialProvider = {
      provider: "google",
      alias: "Google",
      hideOnLogin: false,
      accountLinkingOnly: false,
      storeTokens: false,
      storedTokensReadable: false,
      guiOrder: 0,
      showInAccountConsole: "always",
      clientSecretConfigured: true,
    };
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        return Promise.resolve({ status: 200, data: [partialProvider] }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="social-login" />);
    expect(
      await screen.findByText(dictionary.admin.loginSettings.sectionSocialLogin),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.providerAlias), {
      target: { value: " " },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.providerGuiOrder), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.providerRequiredClaims), {
      target: { value: " " },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.clientId), {
      target: { value: "x".repeat(501) },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.clientSecret), {
      target: { value: "x".repeat(2001) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.loginSettings.socialCredentialsSave }),
    );

    expect(await screen.findAllByText(dictionary.admin.common.validation.required)).toHaveLength(2);
    expect(screen.getByText(dictionary.admin.common.validation.positiveNumber)).toBeVisible();
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "PUT", url: "/api/admin/settings/social-providers" }),
    );
  });

  it("configures Enterprise CAPTCHA and saves both registration and login policies", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      }
      if (request.url?.includes("registration-captcha")) {
        return Promise.resolve({
          status: 200,
          data: {
            enabled: true,
            loginEnabled: true,
            secretConfigured: true,
            apiKeyConfigured: true,
          },
        }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="login" />);
    await screen.findByText(dictionary.admin.loginSettings.captchaTitle);

    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaProvider), {
      target: { value: "enterprise" },
    });
    expect(screen.getByLabelText(dictionary.admin.loginSettings.captchaProjectId)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaProjectId), {
      target: { value: "kitezh-prod" },
    });
    const registrationV3 = screen
      .getByText(dictionary.admin.loginSettings.captchaV3)
      .parentElement?.querySelector("input");
    const loginV3 = screen
      .getByText(dictionary.admin.loginSettings.captchaLoginV3)
      .parentElement?.querySelector("input");
    if (!registrationV3 || !loginV3) throw new Error("CAPTCHA switches were not rendered");
    fireEvent.click(registrationV3);
    fireEvent.click(loginV3);
    expect(
      screen.getByLabelText(dictionary.admin.loginSettings.captchaLoginScoreThreshold),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.loginSettings.captchaSave }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/settings/registration-captcha",
          data: expect.objectContaining({ provider: "enterprise", projectId: "kitezh-prod" }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.loginSettings.captchaSaved);
  });

  it("updates registration and login CAPTCHA controls for reCAPTCHA", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      }
      if (request.url?.includes("registration-captcha")) {
        return Promise.resolve({
          status: 200,
          data: {
            provider: "recaptcha",
            enabled: false,
            loginEnabled: false,
            siteKey: "old-site-key",
            secretKeyConfigured: true,
            secretConfigured: true,
            action: "signup",
            loginAction: "signin",
            recaptchaV3: false,
            loginRecaptchaV3: false,
            useRecaptchaNet: false,
          },
        }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });

    render(<LoginSettings focusSection="login" />);
    await screen.findByText(dictionary.admin.loginSettings.captchaTitle);

    const clickSwitch = (label: string) => {
      const control = screen.getByText(label).parentElement?.querySelector("input");
      if (!control) throw new Error(`Missing CAPTCHA switch: ${label}`);
      fireEvent.click(control);
    };
    for (const label of [
      dictionary.admin.loginSettings.captchaEnabled,
      dictionary.admin.loginSettings.captchaLoginEnabled,
    ]) {
      clickSwitch(label);
    }
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaSiteKey), {
      target: { value: "new-site-key" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaSecret), {
      target: { value: "rotated-secret" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaAction), {
      target: { value: "register" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaLoginAction), {
      target: { value: "login" },
    });
    clickSwitch(dictionary.admin.loginSettings.captchaV3);
    fireEvent.change(screen.getByLabelText(dictionary.admin.loginSettings.captchaScoreThreshold), {
      target: { value: "0.8" },
    });
    clickSwitch(dictionary.admin.loginSettings.captchaLoginV3);
    fireEvent.change(
      screen.getByLabelText(dictionary.admin.loginSettings.captchaLoginScoreThreshold),
      { target: { value: "0.7" } },
    );
    clickSwitch(dictionary.admin.loginSettings.captchaUseRecaptchaNet);
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.loginSettings.captchaSave }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/settings/registration-captcha",
          data: expect.objectContaining({
            enabled: true,
            loginEnabled: true,
            siteKey: "new-site-key",
            secretKey: "rotated-secret",
            action: "register",
            loginAction: "login",
            recaptchaV3: true,
            loginRecaptchaV3: true,
            useRecaptchaNet: true,
          }),
        }),
      ),
    );
  });

  it("reports CAPTCHA save failures", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("social-providers")) {
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      }
      if (request.url?.includes("registration-captcha")) {
        return Promise.resolve({ status: 200, data: {} }) as never;
      }
      return Promise.resolve({ status: 200, data: {} }) as never;
    });
    render(<LoginSettings focusSection="login" />);
    await screen.findByText(dictionary.admin.loginSettings.captchaTitle);
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.includes("registration-captcha") && request.method === "PUT") {
        return Promise.resolve({ status: 500, data: {} }) as never;
      }
      return Promise.resolve({
        status: 200,
        data: request.url?.includes("social-providers") ? [provider] : {},
      }) as never;
    });

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.loginSettings.captchaSave }),
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.loginSettings.captchaError),
    );
  });

  it("rejects an OTP digit count outside the supported values", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection="otp-policy" />);

    const otpDigits = await screen.findByLabelText(dictionary.admin.loginSettings.otpDigits);
    fireEvent.change(otpDigits, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.loginSettings.save }));

    expect(
      await screen.findByText(dictionary.admin.common.validation.positiveNumber),
    ).toBeVisible();
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "PUT", url: "/api/admin/settings/login" }),
    );
  });

  it("renders validation feedback across login, password, session, brute-force, and OTP policies", async () => {
    mockSuccessfulLoads();
    render(<LoginSettings focusSection="password-policy" />);
    await screen.findByText(dictionary.admin.loginSettings.sectionPasswordPolicy);

    const invalidValues: Record<string, string> = {
      passwordResetResendCooldownSeconds: "-1",
      emailUpdateReauthenticationMinutes: "-1",
      sessionTimeoutMinutes: "0",
      passwordMinimumLength: "7",
      passwordMaximumLength: "7",
      passwordMinimumUppercase: "-1",
      passwordMinimumLowercase: "-1",
      passwordMinimumDigits: "-1",
      passwordMinimumSpecialCharacters: "-1",
      passwordHistorySize: "-1",
      passwordExpirationDays: "-1",
      passwordCommonPasswords: " ",
      bruteForceMaxFailures: "0",
      bruteForceMaxSecondaryFailures: "-1",
      mfaVerificationTimeoutSeconds: "0",
      bruteForceQuickLoginWindowMillis: "-1",
      bruteForceMinimumQuickLoginWaitSeconds: "-1",
      bruteForceWaitIncrementSeconds: "-1",
      bruteForceMaxWaitSeconds: "-1",
      bruteForceFailureResetTimeSeconds: "-1",
      bruteForceMaxTemporaryLockouts: "-1",
      bruteForceIpRequestsPerMinute: "0",
      bruteForceUsernameIpRequestsPerMinute: "0",
      otpIssuer: " ",
      otpPeriodSeconds: "1",
      otpLookAheadWindow: "-1",
      recoveryCodeWarningThreshold: "-1",
    };
    for (const [name, value] of Object.entries(invalidValues)) {
      const field = document.querySelector(`[name="${name}"]`);
      if (!field) throw new Error(`Missing policy field: ${name}`);
      fireEvent.change(field, { target: { value } });
    }

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.loginSettings.save }));

    await waitFor(() => {
      expect(
        screen.getAllByText(dictionary.admin.common.validation.positiveNumber).length,
      ).toBeGreaterThan(10);
    });
    expect(
      screen.getAllByText(dictionary.admin.common.validation.minimumPasswordLength).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(dictionary.admin.common.validation.maximumPasswordLength).length,
    ).toBeGreaterThan(0);
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "PUT", url: "/api/admin/settings/login" }),
    );
  });
});
