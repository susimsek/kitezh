import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { submitAccountAction } from "@/lib/account-actions-api";

import { ForgotPasswordForm, ResetPasswordForm, VerifyEmailView } from "./AccountActionForms";
import { ConsoleUserMenu } from "./ConsoleUserMenu";
import { RegistrationForm } from "./RegistrationForm";

const mockSubmitAccountAction = submitAccountAction as jest.MockedFunction<
  typeof submitAccountAction
>;

jest.mock("@/lib/account-actions-api", () => ({
  submitAccountAction: jest.fn(),
  accountActionError: jest.fn(() => "Operation failed"),
}));

let searchParams = new URLSearchParams();
let pathname = "/verify-email";

const installUnavailableFetch = () => {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: false, json: jest.fn() }),
  });
};

jest.mock("@/routing/navigation", () => ({
  useSearchParams: () => searchParams,
  usePathname: () => pathname,
}));

describe("registration and account action forms", () => {
  const defaultFetch = jest.fn().mockResolvedValue({
    ok: false,
    json: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitAccountAction.mockReset();
    defaultFetch.mockClear();
    globalThis.fetch = defaultFetch as unknown as typeof fetch;
    document.documentElement.lang = "tr";
    searchParams = new URLSearchParams();
    pathname = "/verify-email";
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("validates registration fields and shows the created state", async () => {
    mockSubmitAccountAction.mockResolvedValueOnce(undefined);
    installUnavailableFetch();
    render(<RegistrationForm dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.registration.submit }));
    expect(
      await screen.findAllByText(dictionary.registration.validation.required),
    ).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText(dictionary.registration.username), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.registration.firstName), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.registration.lastName), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.registration.email), {
      target: { value: "ada@example.test" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.registration.password), {
      target: { value: "Change-me12!" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.registration.confirmPassword), {
      target: { value: "Change-me12!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.registration.submit }));

    await waitFor(() =>
      expect(mockSubmitAccountAction).toHaveBeenCalledWith("register", {
        username: "new-user",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.test",
        password: "Change-me12!",
        confirmPassword: "Change-me12!",
        captchaToken: "",
        locale: "tr",
      }),
    );
    expect(await screen.findByText(dictionary.registration.created)).toBeVisible();
    expect(screen.getByRole("link", { name: dictionary.registration.backToLogin })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows registration server errors", async () => {
    mockSubmitAccountAction.mockRejectedValueOnce({ errorCode: "unknown" });
    installUnavailableFetch();
    render(<RegistrationForm dictionary={dictionary} />);

    const values: Record<string, string> = {
      username: "user",
      firstName: "First",
      lastName: "Last",
      email: "user@example.test",
      password: "Change-me12!",
      confirmPassword: "Change-me12!",
    };
    const labels: Record<string, string> = {
      username: dictionary.registration.username,
      firstName: dictionary.registration.firstName,
      lastName: dictionary.registration.lastName,
      email: dictionary.registration.email,
      password: dictionary.registration.password,
      confirmPassword: dictionary.registration.confirmPassword,
    };
    for (const [name, value] of Object.entries(values)) {
      fireEvent.change(screen.getByLabelText(labels[name]), {
        target: { value },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: dictionary.registration.submit }));
    expect(await screen.findByText("Operation failed")).toBeVisible();
  });

  it("submits forgot-password and verify-email actions", async () => {
    mockSubmitAccountAction.mockResolvedValue(undefined);
    const { rerender } = render(<ForgotPasswordForm locale="en" dictionary={dictionary} />);
    fireEvent.change(screen.getByLabelText(dictionary.accountActions.identifier), {
      target: { value: "user" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.accountActions.send }));
    await waitFor(() =>
      expect(mockSubmitAccountAction).toHaveBeenCalledWith("forgot-password", {
        identifier: "user",
        locale: "en",
      }),
    );
    expect(await screen.findByText(dictionary.accountActions.forgotSent)).toBeVisible();

    searchParams = new URLSearchParams("token=token");
    rerender(<VerifyEmailView locale="en" dictionary={dictionary} />);
    fireEvent.click(screen.getByRole("button", { name: dictionary.accountActions.verifyTitle }));
    await waitFor(() =>
      expect(mockSubmitAccountAction).toHaveBeenCalledWith("verify-email", {
        token: "token",
      }),
    );
    expect(await screen.findByText(dictionary.accountActions.verifyDone)).toBeVisible();
  });

  it("opens the user menu, falls back to initials, and handles logout", async () => {
    const onLogout = jest.fn().mockResolvedValue(undefined);
    render(
      <ConsoleUserMenu
        accountHref="/account"
        accountLabel="Account"
        logoutLabel="Sign out"
        onLogout={onLogout}
        signedInAsLabel="Signed in as"
        username=" Ada "
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(screen.getByText("Signed in as")).toBeVisible();
    expect(screen.getAllByText("Ada")[1]).toBeVisible();
    expect(screen.getByText("A")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("handles reset-password validation, OTP configuration, and success", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ passwordResetOtpMode: "required" }),
    }) as typeof fetch;
    searchParams = new URLSearchParams("token=reset-token");
    mockSubmitAccountAction.mockResolvedValueOnce(undefined);

    render(<ResetPasswordForm locale="en" dictionary={dictionary} />);
    await waitFor(() =>
      expect(screen.getByLabelText(dictionary.accountActions.otpCode)).toBeVisible(),
    );

    fireEvent.change(screen.getByLabelText(dictionary.accountActions.newPassword), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.accountActions.confirmPassword), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.accountActions.reset }));
    expect(await screen.findByText(dictionary.account.validation.password)).toBeVisible();
    expect(await screen.findByText(dictionary.accountActions.passwordMismatch)).toBeVisible();
    expect(await screen.findByText(dictionary.accountActions.otpRequired)).toBeVisible();

    fireEvent.change(screen.getByLabelText(dictionary.accountActions.newPassword), {
      target: { value: "Change-me12!" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.accountActions.confirmPassword), {
      target: { value: "Change-me12!" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.accountActions.otpCode), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.accountActions.reset }));
    await waitFor(() =>
      expect(mockSubmitAccountAction).toHaveBeenCalledWith("reset-password", {
        token: "reset-token",
        newPassword: "Change-me12!",
        otpCode: "123456",
      }),
    );
    expect(await screen.findByText(dictionary.accountActions.resetDone)).toBeVisible();
    global.fetch = originalFetch;
  });

  it("renders invalid reset links and maps reset failures", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error("settings unavailable")) as typeof fetch;
    mockSubmitAccountAction.mockRejectedValueOnce({ errorCode: "invalid_token" });
    render(<ResetPasswordForm locale="en" dictionary={dictionary} />);
    expect(screen.getByText(dictionary.accountActions.invalidLink)).toBeVisible();

    searchParams = new URLSearchParams("token=reset-token");
    const { rerender } = render(<ResetPasswordForm locale="en" dictionary={dictionary} />);
    fireEvent.change(screen.getAllByLabelText(dictionary.accountActions.newPassword)[0], {
      target: { value: "Change-me12!" },
    });
    fireEvent.change(screen.getAllByLabelText(dictionary.accountActions.confirmPassword)[0], {
      target: { value: "Change-me12!" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.accountActions.reset })[0]);
    expect(await screen.findByText("Operation failed")).toBeVisible();

    pathname = "/confirm-email";
    mockSubmitAccountAction.mockResolvedValueOnce(undefined);
    rerender(<VerifyEmailView locale="en" dictionary={dictionary} />);
    fireEvent.click(screen.getByRole("button", { name: dictionary.accountActions.verifyTitle }));
    await waitFor(() =>
      expect(mockSubmitAccountAction).toHaveBeenLastCalledWith("confirm-email", {
        token: "reset-token",
      }),
    );
    global.fetch = originalFetch;
  });
});
